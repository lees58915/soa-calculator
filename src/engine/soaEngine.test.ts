import { describe, it, expect } from 'vitest';
import {
  zthFoster, zthFosterPer, zthInvFoster, fosterRth,
  pmaxAtPulseFoster, soaCurrentAt, soaCurve,
  analyzeSwitching, analyzeLinear,
  combine, parseNum, fnum, fmtTime,
  check_ovp, check_ocp, check_scp, check_otp, check_uvlo, check_desat,
  siCurrentLimit,
  runProtectionSuite, PROTECTION_INFO,
  type FosterStage, type SpiritoInstability,
} from './soaEngine';

describe('parseNum', () => {
  it('parses plain numbers', () => {
    expect(parseNum('400')).toBe(400);
    expect(parseNum('0.020')).toBeCloseTo(0.020);
    expect(parseNum('1.5')).toBeCloseTo(1.5);
  });
  it('parses scientific notation', () => {
    expect(parseNum('1e-3')).toBeCloseTo(0.001);
    expect(parseNum('2.5E-6')).toBeCloseTo(2.5e-6);
  });
  it('parses engineering suffixes', () => {
    expect(parseNum('20m')).toBeCloseTo(0.020);
    expect(parseNum('2.5u')).toBeCloseTo(2.5e-6);
    expect(parseNum('1.2k')).toBeCloseTo(1200);
    expect(parseNum('100n')).toBeCloseTo(100e-9);
  });
  it('handles comma as decimal separator', () => {
    expect(parseNum('3,14')).toBeCloseTo(3.14);
  });
  it('throws on empty / garbage', () => {
    expect(() => parseNum('')).toThrow();
    expect(() => parseNum('abc')).toThrow();
  });
});

describe('fnum / fmtTime', () => {
  it('formats fixed decimals', () => {
    expect(fnum(1.2345, 2)).toBe('1.23');
    expect(fnum(0.000456, 3)).toBe('0.000');
    expect(fnum(0.0004567, 4)).toMatch(/0\.0005/);
  });
  it('handles infinity / NaN', () => {
    expect(fnum(Infinity, 2)).toBe('inf');
    expect(fnum(-Infinity, 2)).toBe('-inf');
    expect(fnum(NaN, 2)).toBe('nan');
  });
  it('formats times in engineering units', () => {
    expect(fmtTime(2e-9)).toMatch(/ns$/);
    expect(fmtTime(1.2e-6)).toMatch(/us$/);
    expect(fmtTime(3.5e-3)).toMatch(/ms$/);
    expect(fmtTime(2.5)).toMatch(/s$/);
    expect(fmtTime(Infinity)).toBe('DC');
  });
});

describe('Zth thermal model', () => {
  const stages: FosterStage[] = [
    { R: 0.05, tau: 5e-4 },
    { R: 0.12, tau: 5e-3 },
    { R: 0.20, tau: 5e-2 },
    { R: 0.13, tau: 0.5 },
  ];
  it('zth(0) = 0 and zth(infinity) = sum of Ri', () => {
    expect(zthFoster(stages, 0)).toBe(0);
    expect(zthFoster(stages, 1e9)).toBeCloseTo(fosterRth(stages), 6);
  });
  it('Zth is monotonically non-decreasing', () => {
    let prev = -1;
    for (let e = -6; e <= 6; e++) {
      const v = zthFoster(stages, Math.pow(10, e));
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });
  it('repetitive pulse Zth is bounded and >= 0', () => {
    const z = zthFosterPer(stages, 1e-3, 0.5);
    expect(z).toBeGreaterThan(0);
    expect(z).toBeLessThan(fosterRth(stages) + 1e-9);
  });
  it('zthInvFoster inverts zthFosterPer within tolerance', () => {
    const targets = [0.05, 0.1, 0.2, 0.3, 0.4, 0.45];
    for (const z of targets) {
      const t = zthInvFoster(stages, z, 0);
      const back = zthFosterPer(stages, t, 0);
      expect(Math.abs(back - z)).toBeLessThan(1e-4);
    }
  });
  it('zthInvFoster returns Infinity for target above DC', () => {
    expect(zthInvFoster(stages, fosterRth(stages) * 2, 0)).toBe(Infinity);
  });
  it('zthInvFoster returns 0 for below-D*DC target', () => {
    expect(zthInvFoster(stages, 0.01, 0.5)).toBe(0);
  });
});

describe('pmaxAtPulse', () => {
  it('Pmax decreases with longer pulse', () => {
    const stages: FosterStage[] = [{ R: 0.5, tau: 0.05 }];
    const a = pmaxAtPulseFoster(150, 50, stages, 1e-3, 0);
    const b = pmaxAtPulseFoster(150, 50, stages, 1e-2, 0);
    const c = pmaxAtPulseFoster(150, 50, stages, 1, 0);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });
  it('Pmax is 0 when Tc >= Tj_max', () => {
    expect(pmaxAtPulseFoster(150, 150, [{ R: 0.5, tau: 0.05 }], 1e-3, 0)).toBe(0);
  });
});

describe('soaCurrentAt', () => {
  const siOff: SpiritoInstability = { enabled: false, Vk: 0, m: -2 };
  it('is bounded by ID_max at low V when RDS is small', () => {
    expect(soaCurrentAt(0.01, 1000, 50, 0.0001, siOff)).toBeCloseTo(50);
  });
  it('is bounded by P/V at intermediate V', () => {
    // Pmax=100W, V=10V -> 10A
    expect(soaCurrentAt(10, 100, 1000, 0.001, siOff)).toBeCloseTo(10);
  });
  it('is bounded by V/RDS at high V', () => {
    // V=100V, RDS=1 -> 100A
    expect(soaCurrentAt(100, 1e9, 1e9, 1, siOff)).toBeCloseTo(100);
  });
  it('applies instability locus above Vk', () => {
    const si: SpiritoInstability = { enabled: true, Vk: 100, m: -2 };
    // Pmax=200W, Vk=100: at V=100 -> I=2A ; at V=200 with m=-2 -> 2*200^-2 * 100^2 = 0.5 A
    expect(soaCurrentAt(100, 200, 1e9, 0, si)).toBeCloseTo(2);
    expect(soaCurrentAt(200, 200, 1e9, 0, si)).toBeCloseTo(0.5);
    // below Vk, instability doesn't apply (only P/V and V/RDS apply)
    // P=200W, V=50V -> 4A
    expect(soaCurrentAt(50, 200, 1e9, 0, si)).toBeCloseTo(4);
  });
});

describe('soaCurve', () => {
  it('returns 8 default curves', () => {
    const c = soaCurve(650, 50, 0.05, 150, 50, [{ R: 0.5, tau: 0.05 }], { enabled: false, Vk: 0, m: -2 }, null, 0, 0);
    expect(c).toHaveLength(8);
  });
  it('curves monotonically decrease in pmax with time', () => {
    const c = soaCurve(650, 50, 0.05, 150, 50, [{ R: 0.5, tau: 0.05 }], { enabled: false, Vk: 0, m: -2 }, null, 0, 0);
    for (let i = 1; i < c.length; i++) {
      expect(c[i].pmax).toBeLessThanOrEqual(c[i - 1].pmax + 1e-9);
    }
  });
  it('all curve points are finite', () => {
    const c = soaCurve(650, 50, 0.05, 150, 50, [{ R: 0.5, tau: 0.05 }], { enabled: false, Vk: 0, m: -2 }, null, 0, 0);
    c.forEach((cv) => {
      cv.points.forEach((p) => {
        expect(Number.isFinite(p[0])).toBe(true);
        expect(Number.isFinite(p[1])).toBe(true);
      });
    });
  });
});

describe('analyzeSwitching', () => {
  it('returns PASS for typical buck at 400V bus / 20A / Tj=89C', () => {
    const r = analyzeSwitching({
      Vbus: 400, ID: 20, BV: 650, ID_max: 50, RDS: 0.05,
      Ploss: 8, Ta: 25, Rth_ja: 5, Tj_max: 150,
    });
    expect(r.overall).toBe('PASS');
    expect(r.v_state).toBe('PASS');
    expect(r.i_state).toBe('PASS');
    expect(r.t_state).toBe('PASS');
  });
  it('returns FAIL on VDS overshoot above BV', () => {
    const r = analyzeSwitching({
      Vbus: 600, ID: 20, BV: 650, ID_max: 50, RDS: 0.05,
      V_overshoot_pct: 30, Tj_max: 150,
    });
    expect(r.v_state).toBe('FAIL');
  });
  it('returns FAIL on Tj above Tj_max', () => {
    const r = analyzeSwitching({
      Vbus: 400, ID: 20, BV: 650, ID_max: 50, RDS: 0.05,
      Ploss: 50, Ta: 25, Rth_ja: 5, Tj_max: 150,
    });
    expect(r.t_state).toBe('FAIL');
  });
  it('returns WARN when ratio is in the 80-100% band', () => {
    const r = analyzeSwitching({
      Vbus: 400, ID: 50 * 0.9, BV: 650, ID_max: 50, RDS: 0.05,
      Ploss: 0, Ta: 25, Rth_ja: 5, Tj_max: 150,
    });
    expect(r.i_state).toBe('WARN');
  });
});

describe('analyzeLinear', () => {
  it('returns PASS for a hot-swap at VDS=24V, ID=20A, tp=1ms', () => {
    const r = analyzeLinear({
      VDS: 24, ID: 20, t_pulse: 1e-3, BV: 100, ID_max: 50, RDS: 0.005, Tj_max: 150, Tc: 50,
    }, [{ R: 0.4, tau: 0.05 }], { enabled: false, Vk: 0, m: -2 });
    expect(['PASS', 'WARN']).toContain(r.overall);
  });
  it('returns FAIL when Pop > Pmax', () => {
    const r = analyzeLinear({
      VDS: 80, ID: 40, t_pulse: 10, BV: 100, ID_max: 50, RDS: 0.005, Tj_max: 150, Tc: 50,
    }, [{ R: 0.4, tau: 0.05 }], { enabled: false, Vk: 0, m: -2 });
    expect(r.overall).toBe('FAIL');
    expect(r.p_state).toBe('FAIL');
  });
  it('uses IDM as pulsed ceiling when IDM>0 and tp<1s', () => {
    const r = analyzeLinear({
      VDS: 5, ID: 100, t_pulse: 1e-6, BV: 100, ID_max: 50, IDM: 200, RDS: 0.005, Tj_max: 150, Tc: 50,
    }, [{ R: 0.4, tau: 0.05 }], { enabled: false, Vk: 0, m: -2 });
    expect(r.i_lim).toBe(200);
  });
  it('honors instability derating when enabled', () => {
    const r = analyzeLinear({
      VDS: 200, ID: 1, t_pulse: 1, BV: 250, ID_max: 50, RDS: 0.005, Tj_max: 150, Tc: 50,
    }, [{ R: 0.4, tau: 0.05 }], { enabled: true, Vk: 100, m: -2 });
    expect(r.si_state).not.toBeNull();
    expect(r.i_si_limit).toBeLessThan(Infinity);
  });
});

describe('combine', () => {
  it('FAIL beats WARN beats PASS', () => {
    expect(combine(['PASS', 'WARN', 'PASS'])).toBe('WARN');
    expect(combine(['PASS', 'FAIL'])).toBe('FAIL');
    expect(combine(['PASS', 'WARN', 'FAIL'])).toBe('FAIL');
    expect(combine(['PASS'])).toBe('PASS');
    expect(combine([])).toBe('PASS');
  });
});

describe('protection checks', () => {
  it('OVP: FAIL if V_ovp <= Vbus', () => {
    expect(check_ovp(380, 400, 650).state).toBe('FAIL');
  });
  it('OVP: FAIL if Vpeak >= BV', () => {
    expect(check_ovp(550, 400, 650, 30).state).toBe('FAIL');
  });
  it('OVP: PASS with reasonable margins', () => {
    expect(check_ovp(440, 400, 650, 30).state).toBe('PASS');
  });
  it('OCP: FAIL if I_ocp <= Iout', () => {
    expect(check_ocp(15, 20, 50).state).toBe('FAIL');
  });
  it('OCP: FAIL if I_ocp >= ID_max', () => {
    expect(check_ocp(50, 20, 50).state).toBe('FAIL');
  });
  it('SCP: FAIL when tSC_DS is missing', () => {
    expect(check_scp(1e-6, 0).state).toBe('FAIL');
  });
  it('SCP: FAIL when response exceeds datasheet time', () => {
    expect(check_scp(5e-6, 3e-6).state).toBe('FAIL');
  });
  it('SCP: PASS for typical 1.5us response with 3us rating', () => {
    expect(check_scp(1.5e-6, 3e-6).state).toBe('PASS');
  });
  it('OTP: FAIL when T_otp >= Tj_max', () => {
    expect(check_otp(150, 150, 25).state).toBe('FAIL');
  });
  it('OTP: PASS at typical 135C trip', () => {
    expect(check_otp(135, 150, 25).state).toBe('PASS');
  });
  it('UVLO: FAIL when V_uvlo_on <= Miller plateau', () => {
    expect(check_uvlo(6, 7, 15).state).toBe('FAIL');
  });
  it('UVLO: PASS for 11V release vs 7V Miller vs 15V drive', () => {
    expect(check_uvlo(11, 7, 15).state).toBe('PASS');
  });
  it('DESAT: FAIL when threshold is below normal VDS', () => {
    expect(check_desat(0.5, 400, 0.01, 50).state).toBe('FAIL');
  });
  it('DESAT: PASS for 7V threshold', () => {
    expect(check_desat(7, 400, 0.01, 50).state).toBe('PASS');
  });
});

describe('runProtectionSuite', () => {
  const params = {
    V_ovp: 440, Vbus: 400, BV: 650, V_overshoot_pct: 30,
    I_ocp: 30, Iout: 20, ID_max: 50,
    t_response: 1.5e-6, tSC_DS: 3e-6,
    T_otp: 135, Tj_max: 150, Ta: 25,
    V_uvlo_on: 11, V_miller: 7, Vgs_nominal: 15,
    V_desat_th: 7, RDS: 0.05, I_fault: 100,
  };
  it('runs all enabled protections', () => {
    const out = runProtectionSuite(params, ['OVP', 'OCP', 'SCP', 'OTP', 'UVLO', 'DESAT']);
    expect(out).toHaveLength(6);
    out.forEach((r) => expect(['PASS', 'WARN', 'FAIL']).toContain(r.state));
  });
  it('respects enabled list', () => {
    const out = runProtectionSuite(params, ['OVP', 'UVLO']);
    expect(out.map((r) => r.name)).toEqual(['OVP', 'UVLO']);
  });
  it('PROTECTION_INFO covers all names', () => {
    ['OVP', 'OCP', 'SCP', 'OTP', 'UVLO', 'DESAT'].forEach((n) => {
      expect(PROTECTION_INFO[n]).toBeDefined();
    });
  });
  it('throws on NaN inputs', () => {
    expect(() => check_ovp(NaN, 400, 650)).toThrow();
    expect(() => check_ocp(30, 20, NaN)).toThrow();
    expect(() => check_scp(1e-6, NaN)).toThrow();
    expect(() => check_otp(NaN, 150)).toThrow();
    expect(() => check_uvlo(11, 7, NaN)).toThrow();
    expect(() => check_desat(7, NaN, 0.01, 100)).toThrow();
  });
  it('handles null/empty in runProtectionSuite', () => {
    expect(runProtectionSuite(null as any, ['OVP'])).toHaveLength(0);
    expect(runProtectionSuite({} as any, null as any)).toHaveLength(0);
    expect(runProtectionSuite({} as any, [])).toHaveLength(0);
  });
});

describe('siCurrentLimit edge cases', () => {
  const siBase: SpiritoInstability = { enabled: true, Vk: 100, m: -2 };
  it('returns Infinity below Vk', () => {
    expect(siCurrentLimit(50, 200, siBase)).toBe(Infinity);
  });
  it('returns Infinity when si is null', () => {
    expect(siCurrentLimit(150, 200, null as any)).toBe(Infinity);
  });
  it('returns Infinity when Vk is 0', () => {
    const si0 = { ...siBase, Vk: 0 };
    expect(siCurrentLimit(150, 200, si0)).toBe(Infinity);
  });
  it('returns finite value for valid inputs', () => {
    expect(Number.isFinite(siCurrentLimit(200, 200, siBase))).toBe(true);
  });
});
