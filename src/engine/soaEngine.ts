/* ---- SOA engine: pure functions, no DOM ---- */

/* Numeric safety guards */
export function guardPositive(x: number, name: string): asserts x is number {
  if (!(x > 0) || !Number.isFinite(x)) {
    throw new Error(`${name} must be a positive number, got ${JSON.stringify(x)}`);
  }
}

export function guardNonNegative(x: number, name: string): asserts x is number {
  if (!(x >= 0) || !Number.isFinite(x)) {
    throw new Error(`${name} must be >= 0, got ${JSON.stringify(x)}`);
  }
}

export function safeDivide(a: number, b: number, fallback = 0): number {
  return b > 0 && Number.isFinite(a) ? a / b : fallback;
}

function guardFinite(x: unknown, name: string): asserts x is number {
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    throw new Error(`${name} must be a finite number, got ${JSON.stringify(x)}`);
  }
}

/* fixed-decimal format, round-half-to-even */
export function fnum(x: number, nd: number): string {
  if (x === Infinity) return 'inf';
  if (x === -Infinity) return '-inf';
  if (Number.isNaN(x)) return 'nan';
  const neg = x < 0;
  const ax = Math.abs(x);
  const m = Math.pow(10, nd);
  const scaled = ax * m;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let r: number;
  if (Math.abs(diff - 0.5) < 1e-9) {
    r = floor % 2 === 0 ? floor : floor + 1; // banker's rounding
  } else {
    r = Math.round(scaled);
  }
  let out = (r / m).toFixed(nd);
  if (neg && r !== 0) out = '-' + out;
  return out;
}

export interface FosterStage {
  R: number; // °C/W
  tau: number; // s
}

/* Zth(t): single-pole Rjc*(1-e^(-t/tau)); Foster SUM_i Ri*(1-e^(-t/taui)) */
export function zthFoster(stages: FosterStage[], tp: number): number {
  if (!(tp > 0) || !Number.isFinite(tp)) return 0.0;
  let z = 0.0;
  for (const s of stages) {
    if (s.R > 0 && s.tau > 0) {
      z += s.R * (1.0 - Math.exp(-tp / s.tau));
    }
  }
  return z;
}

/* steady-state repetitive rectangular pulses: T = tp/D */
export function zthFosterPer(stages: FosterStage[], tp: number, D: number): number {
  if (!(tp > 0) || !Number.isFinite(tp)) return 0.0;
  if (!(D > 0) || !Number.isFinite(D)) return zthFoster(stages, tp);
  const T = tp / Math.min(D, 1.0);
  if (!(T > 0)) return 0.0;
  let z = 0.0;
  for (const s of stages) {
    if (s.R > 0 && s.tau > 0) {
      const num = Math.expm1(-tp / s.tau);
      const den = Math.expm1(-T / s.tau);
      if (den !== 0) z += s.R * num / den;
    }
  }
  return z;
}

/* Steady-state (DC) thermal resistance of a Foster list = SUM Ri. */
export function fosterRth(stages: FosterStage[]): number {
  let r = 0;
  for (const s of stages) r += s.R;
  return r;
}

/* invert Zth(t)=zTarget: monotone, no closed form for >1 stage -> bisect on log(t) */
export function zthInvFoster(stages: FosterStage[], zTarget: number, D: number): number {
  const zfloor = D > 0 ? Math.min(D, 1.0) * fosterRth(stages) : 0.0;
  if (zTarget <= zfloor) return 0.0;
  if (zTarget >= fosterRth(stages) - 1e-15) return Infinity;
  let lo = 1e-9,
    hi = 1.0;
  while (zthFosterPer(stages, hi, D) < zTarget && hi < 1e6) hi *= 10;
  for (let i = 0; i < 100; i++) {
    const mid = Math.sqrt(lo * hi);
    if (zthFosterPer(stages, mid, D) < zTarget) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

/* Maximum allowable power dissipation for a given pulse width tp. */
export function pmaxAtPulseFoster(Tj_max: number, Tc: number, stages: FosterStage[], tp: number, D: number): number {
  if (Tj_max <= Tc) return 0;
  const z = zthFosterPer(stages, tp, D);
  if (z <= 0) return Infinity;
  return (Tj_max - Tc) / z;
}

export interface SpiritoInstability {
  enabled: boolean;
  Vk: number;
  m: number;
}

/* Linear-mode (Spirito) derating */
export function siCurrentLimit(V: number, pmax: number, si: SpiritoInstability): number {
  if (!si || !si.enabled) return Infinity;
  if (!(si.Vk > 0) || !Number.isFinite(si.Vk)) return Infinity;
  if (!(V >= si.Vk) || !Number.isFinite(V)) return Infinity;
  if (!Number.isFinite(pmax)) return Infinity;
  const m = Number.isFinite(si.m) ? si.m : -2;
  const C = safeDivide(pmax, si.Vk * Math.pow(si.Vk, m), 0);
  return C * Math.pow(V, m);
}

/* binding limit at (V, pulse): min of ID_max, P/V, V/RDS, instability locus */
export function soaCurrentAt(V: number, pmax: number, ID_max: number, RDS: number, si: SpiritoInstability): number {
  let lim = ID_max;
  if (V > 0) lim = Math.min(lim, pmax / V);
  if (RDS > 0) lim = Math.min(lim, V / RDS);
  lim = Math.min(lim, siCurrentLimit(V, pmax, si));
  return lim;
}

export interface SoaCurvePoint {
  t: number;
  pmax: number;
  points: Array<[number, number]>;
}

export function soaCurve(
  BV: number,
  ID_max: number,
  RDS: number,
  Tj_max: number,
  Tc: number,
  stages: FosterStage[],
  si: SpiritoInstability,
  pulseTimes: number[] | null,
  D: number,
  IDM: number,
): SoaCurvePoint[] {
  if (!pulseTimes) pulseTimes = [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0, 10.0];
  const curves: SoaCurvePoint[] = [];
  for (const tp of pulseTimes) {
    const iceil = IDM > 0 && tp < 1 && !(D >= 1) ? IDM : ID_max;
    const pmax = pmaxAtPulseFoster(Tj_max, Tc, stages, tp, D);
    const v_lo = Math.max(iceil * RDS * 0.1, 1e-3);
    const v_hi = BV;
    const pts: Array<[number, number]> = [];
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const v = v_lo * Math.pow(v_hi / v_lo, i / N);
      pts.push([v, soaCurrentAt(v, pmax, iceil, RDS, si)]);
    }
    curves.push({ t: tp, pmax, points: pts });
  }
  return curves;
}

export type Verdict = 'PASS' | 'WARN' | 'FAIL';

export function combine(states: Verdict[]): Verdict {
  if (!states.length) return 'PASS';
  if (states.includes('FAIL')) return 'FAIL';
  if (states.includes('WARN')) return 'WARN';
  return 'PASS';
}

export interface SwitchingResult {
  mode: 'switching';
  VDS_peak: number;
  v_ratio: number;
  v_state: Verdict;
  i_ratio: number;
  i_state: Verdict;
  /** The current limit used (IDM if available, else ID_max) */
  i_lim: number;
  Tj: number;
  t_ratio: number;
  t_state: Verdict;
  BV: number;
  ID_max: number;
  IDM: number;
  Tj_max: number;
  RDS: number;
  Vbus: number;
  overall: Verdict;
}

export function analyzeSwitching(p: Record<string, number>): SwitchingResult {
  guardPositive(p.Vbus, 'Vbus');
  guardPositive(p.BV, 'BV');
  guardPositive(p.ID_max, 'ID_max');
  guardPositive(p.RDS, 'RDS');
  guardNonNegative(p.ID, 'ID');
  const Vbus = p.Vbus,
    ID = p.ID,
    BV = p.BV,
    ID_max = p.ID_max,
    RDS = p.RDS;
  const IDM = p.IDM ?? 0;
  const overshoot = 1.0 + (p.V_overshoot_pct ?? 30.0) / 100.0;
  const Ploss = p.Ploss ?? 0.0;
  const Ta = p.Ta ?? 25.0;
  const Rth_ja = p.Rth_ja ?? 40.0;
  guardPositive(p.Tj_max, 'Tj_max');
  const Tj_max = p.Tj_max;

  const VDS_peak = Vbus * overshoot;
  const v_ratio = BV > 0 ? VDS_peak / BV : Infinity;
  const v_state: Verdict = VDS_peak > BV ? 'FAIL' : v_ratio > 0.8 ? 'WARN' : 'PASS';

  const i_lim = IDM > 0 ? IDM : ID_max;
  const i_ratio = i_lim > 0 ? ID / i_lim : Infinity;
  const i_state: Verdict = ID > i_lim ? 'FAIL' : i_ratio > 0.8 ? 'WARN' : 'PASS';

  const Tj = Ta + Ploss * Rth_ja;
  const t_ratio = Tj_max > 0 ? Tj / Tj_max : Infinity;
  const t_state: Verdict = Tj > Tj_max ? 'FAIL' : Tj > Tj_max - 20 ? 'WARN' : 'PASS';

  const overall = combine([v_state, i_state, t_state]);
  return {
    mode: 'switching',
    VDS_peak,
    v_ratio,
    v_state,
    i_ratio,
    i_state,
    i_lim,
    Tj,
    t_ratio,
    t_state,
    BV,
    ID_max,
    IDM,
    Tj_max,
    RDS,
    Vbus,
    overall,
  };
}

export interface LinearResult {
  mode: 'linear';
  Pop: number;
  pmax: number;
  p_ratio: number;
  p_state: Verdict;
  v_state: Verdict;
  i_state: Verdict;
  i_lim: number;
  rds_ok: boolean;
  i_rds_limit: number;
  i_si_limit: number;
  si_ratio: number | null;
  si_state: Verdict | null;
  t_pulse: number;
  t_allow: number;
  duty: number;
  VDS: number;
  ID: number;
  BV: number;
  ID_max: number;
  IDM: number;
  RDS: number;
  Tj_max: number;
  Tc: number;
  stages: FosterStage[];
  si: SpiritoInstability;
  overall: Verdict;
}

export function analyzeLinear(p: Record<string, number>, stages: FosterStage[] | null, si: SpiritoInstability | null): LinearResult {
  guardPositive(p.t_pulse, 't_pulse');
  guardPositive(p.BV, 'BV');
  guardPositive(p.ID_max, 'ID_max');
  guardPositive(p.RDS, 'RDS');
  guardNonNegative(p.VDS, 'VDS');
  guardNonNegative(p.ID, 'ID');
  if (p.Tc != null) guardNonNegative(p.Tc, 'Tc');
  guardPositive(p.Tj_max, 'Tj_max');
  const VDS = p.VDS,
    ID = p.ID,
    tp = p.t_pulse,
    BV = p.BV;
  const ID_max = p.ID_max,
    RDS = p.RDS,
    Tj_max = p.Tj_max,
    Tc = p.Tc ?? 25;
  const IDM = p.IDM ?? 0;

  if (!stages || !stages.length) stages = [{ R: p.Rjc ?? 0.5, tau: p.tau ?? 0.05 }];
  si = si || { enabled: false, Vk: 0, m: -2 };

  const rawDuty = p.duty ?? 0;
  const D = rawDuty > 0 ? Math.min(rawDuty, 1.0) : 0;
  const Pop = VDS * ID;
  const pmax = pmaxAtPulseFoster(Tj_max, Tc, stages, tp, D);

  const p_ratio = pmax > 0 ? Pop / pmax : Infinity;
  const p_state: Verdict = Pop > pmax ? 'FAIL' : p_ratio > 0.8 ? 'WARN' : 'PASS';

  const v_state: Verdict = VDS > BV ? 'FAIL' : VDS > 0.8 * BV ? 'WARN' : 'PASS';
  const i_lim = IDM > 0 && tp < 1 && D < 1 ? IDM : ID_max;
  const i_state: Verdict = ID > i_lim ? 'FAIL' : ID > 0.8 * i_lim ? 'WARN' : 'PASS';

  const i_rds_limit = RDS > 0 ? VDS / RDS : Infinity;
  const rds_ok = ID <= i_rds_limit;

  const i_si_limit = siCurrentLimit(VDS, pmax, si);
  let si_ratio: number | null = null,
    si_state: Verdict | null = null;
  if (si.enabled && Number.isFinite(i_si_limit)) {
    si_ratio = i_si_limit > 0 ? ID / i_si_limit : Infinity;
    si_state = ID > i_si_limit ? 'FAIL' : (si_ratio ?? 0) > 0.8 ? 'WARN' : 'PASS';
  }

  const states: Verdict[] = [p_state, v_state, i_state];
  if (si_state) states.push(si_state);
  const overall = combine(states);

  const z_needed = Pop > 0 ? (Tj_max - Tc) / Pop : Infinity;
  const t_allow = zthInvFoster(stages, z_needed, D);

  return {
    mode: 'linear',
    Pop,
    pmax,
    p_ratio,
    p_state,
    v_state,
    i_state,
    i_lim,
    rds_ok,
    i_rds_limit,
    i_si_limit,
    si_ratio,
    si_state,
    t_pulse: tp,
    t_allow,
    duty: D,
    VDS,
    ID,
    BV,
    ID_max,
    IDM,
    RDS,
    Tj_max,
    Tc,
    stages,
    si,
    overall,
  };
}

/* ---- protection-threshold checks ---- */
export interface ProtectionResult {
  name: string;
  value: number;
  state: Verdict;
  msg: string;
}

export function check_ovp(V_ovp: number, Vbus: number, BV: number, overshoot_pct = 30.0): ProtectionResult {
  guardFinite(V_ovp, 'V_ovp'); guardFinite(Vbus, 'Vbus'); guardFinite(BV, 'BV'); guardFinite(overshoot_pct, 'overshoot_pct');
  const Vpeak = V_ovp * (1.0 + overshoot_pct / 100.0);
  if (V_ovp <= Vbus)
    return {
      name: 'OVP',
      value: V_ovp,
      state: 'FAIL',
      msg: `V_OVP ${fnum(V_ovp, 0)}V <= Vbus ${fnum(Vbus, 0)}V: nuisance trips during normal operation.`,
    };
  if (Vpeak >= BV)
    return {
      name: 'OVP',
      value: V_ovp,
      state: 'FAIL',
      msg: `V_OVP + overshoot ${fnum(Vpeak, 0)}V >= BVDSS ${fnum(BV, 0)}V: device avalanches before OVP acts.`,
    };
  const m_low = ((V_ovp - Vbus) / Vbus) * 100;
  const m_high = ((BV - Vpeak) / BV) * 100;
  const state: Verdict = m_high < 10 || m_low < 10 ? 'WARN' : 'PASS';
  return {
    name: 'OVP',
    value: V_ovp,
    state,
    msg: `Trips ${fnum(m_low, 0)}% above Vbus, ${fnum(m_high, 0)}% below BVDSS.` + (state === 'WARN' ? ' Margin tight.' : ''),
  };
}

export function check_ocp(I_ocp: number, Iout: number, ID_max: number): ProtectionResult {
  guardFinite(I_ocp, 'I_ocp'); guardFinite(Iout, 'Iout'); guardFinite(ID_max, 'ID_max');
  if (I_ocp <= Iout)
    return {
      name: 'OCP',
      value: I_ocp,
      state: 'FAIL',
      msg: `I_OCP ${fnum(I_ocp, 1)}A <= Iout ${fnum(Iout, 1)}A: trips at normal load.`,
    };
  if (I_ocp >= ID_max)
    return {
      name: 'OCP',
      value: I_ocp,
      state: 'FAIL',
      msg: `I_OCP ${fnum(I_ocp, 1)}A >= ID_max ${fnum(ID_max, 1)}A: device over-current before OCP acts.`,
    };
  const m_low = ((I_ocp - Iout) / Iout) * 100;
  const m_high = ((ID_max - I_ocp) / ID_max) * 100;
  const state: Verdict = m_low < 20 || m_high < 15 ? 'WARN' : 'PASS';
  return {
    name: 'OCP',
    value: I_ocp,
    state,
    msg: `Trips ${fnum(m_low, 0)}% above Iout, ${fnum(m_high, 0)}% below ID_max.` + (state === 'WARN' ? ' Margin tight.' : ''),
  };
}

export function check_scp(t_response: number, tSC_DS: number, margin_req = 1e-6): ProtectionResult {
  guardFinite(t_response, 't_response'); guardFinite(tSC_DS, 'tSC_DS'); guardFinite(margin_req, 'margin_req');
  if (tSC_DS <= 0)
    return { name: 'SCP', value: t_response, state: 'FAIL', msg: 'No datasheet t_SC: device not short-circuit rated.' };
  const margin = tSC_DS - t_response;
  if (t_response >= tSC_DS)
    return {
      name: 'SCP',
      value: t_response,
      state: 'FAIL',
      msg: `Response ${fnum(t_response * 1e6, 2)}us >= t_SC ${fnum(tSC_DS * 1e6, 2)}us: device destroyed first!`,
    };
  const state: Verdict = margin < margin_req ? 'WARN' : 'PASS';
  return {
    name: 'SCP',
    value: t_response,
    state,
    msg: `Response ${fnum(t_response * 1e6, 2)}us < t_SC ${fnum(tSC_DS * 1e6, 2)}us (margin ${fnum(margin * 1e6, 2)}us).` + (state === 'WARN' ? ' Below 1us.' : ''),
  };
}

export function check_otp(T_otp: number, Tj_max: number, Ta = 25.0): ProtectionResult {
  guardFinite(T_otp, 'T_otp'); guardFinite(Tj_max, 'Tj_max'); guardFinite(Ta, 'Ta');
  if (T_otp >= Tj_max)
    return {
      name: 'OTP',
      value: T_otp,
      state: 'FAIL',
      msg: `T_OTP ${fnum(T_otp, 0)}C >= Tj_max ${fnum(Tj_max, 0)}C: junction overheats before OTP acts.`,
    };
  if (T_otp <= Ta)
    return {
      name: 'OTP',
      value: T_otp,
      state: 'FAIL',
      msg: `T_OTP ${fnum(T_otp, 0)}C <= ambient ${fnum(Ta, 0)}C: nuisance trips.`,
    };
  const margin = Tj_max - T_otp;
  const state: Verdict = margin < 15 ? 'WARN' : 'PASS';
  return {
    name: 'OTP',
    value: T_otp,
    state,
    msg: `Trips ${fnum(margin, 0)}C below Tj_max.` + (state === 'WARN' ? ' Margin tight.' : ''),
  };
}

export function check_uvlo(V_uvlo_on: number, V_miller: number, Vgs_nominal: number): ProtectionResult {
  guardFinite(V_uvlo_on, 'V_uvlo_on'); guardFinite(V_miller, 'V_miller'); guardFinite(Vgs_nominal, 'Vgs_nominal');
  if (V_uvlo_on <= V_miller)
    return {
      name: 'UVLO',
      value: V_uvlo_on,
      state: 'FAIL',
      msg: `UVLO release ${fnum(V_uvlo_on, 1)}V <= Miller plateau ${fnum(V_miller, 1)}V: FET not fully on, high RDS, overheats.`,
    };
  if (V_uvlo_on >= Vgs_nominal)
    return {
      name: 'UVLO',
      value: V_uvlo_on,
      state: 'FAIL',
      msg: `UVLO release ${fnum(V_uvlo_on, 1)}V >= nominal Vgs ${fnum(Vgs_nominal, 1)}V: driver never enables.`,
    };
  const margin = V_uvlo_on - V_miller;
  const state: Verdict = margin < 1.0 ? 'WARN' : 'PASS';
  return {
    name: 'UVLO',
    value: V_uvlo_on,
    state,
    msg: `Release ${fnum(margin, 1)}V above Miller plateau.` + (state === 'WARN' ? ' Margin tight.' : ''),
  };
}

export function check_desat(V_desat_th: number, Vbus: number, RDS: number, I_fault: number): ProtectionResult {
  guardFinite(V_desat_th, 'V_desat_th'); guardFinite(Vbus, 'Vbus'); guardFinite(RDS, 'RDS'); guardFinite(I_fault, 'I_fault');
  const Vds_normal = I_fault * RDS;
  if (V_desat_th <= Vds_normal)
    return {
      name: 'DESAT',
      value: V_desat_th,
      state: 'FAIL',
      msg: `DESAT threshold ${fnum(V_desat_th, 1)}V <= normal VDS ${fnum(Vds_normal, 2)}V: false desaturation trips.`,
    };
  const state: Verdict = V_desat_th > 0.5 * Vbus ? 'WARN' : 'PASS';
  return {
    name: 'DESAT',
    value: V_desat_th,
    state,
    msg: `Above normal VDS ${fnum(Vds_normal, 2)}V.` + (state === 'WARN' ? ' High vs Vbus.' : ''),
  };
}

export const PROTECTION_INFO: Record<string, string> = {
  OVP: 'Over-Voltage Protection - trips when bus voltage too high',
  OCP: 'Over-Current Protection - trips when load current too high',
  SCP: 'Short-Circuit Protection - must act within t_SC',
  OTP: 'Over-Temperature Protection - trips before Tj_max',
  UVLO: 'Under-Voltage Lockout - gate driver disables if Vgs too low',
  DESAT: 'Desaturation detection - senses VDS rise during a fault',
};

export function runProtectionSuite(p: Record<string, number>, enabled: string[]): ProtectionResult[] {
  const out: ProtectionResult[] = [];
  if (!p || typeof p !== 'object') return out;
  if (!Array.isArray(enabled)) return out;
  if (enabled.includes('OVP')) out.push(check_ovp(p.V_ovp, p.Vbus, p.BV, p.V_overshoot_pct ?? 30.0));
  if (enabled.includes('OCP')) out.push(check_ocp(p.I_ocp, p.Iout, p.ID_max));
  if (enabled.includes('SCP')) out.push(check_scp(p.t_response, p.tSC_DS));
  if (enabled.includes('OTP')) out.push(check_otp(p.T_otp, p.Tj_max, p.Ta ?? 25.0));
  if (enabled.includes('UVLO')) out.push(check_uvlo(p.V_uvlo_on, p.V_miller, p.Vgs_nominal));
  if (enabled.includes('DESAT')) out.push(check_desat(p.V_desat_th, p.Vbus, p.RDS, p.I_fault));
  return out;
}

/* ---- engineering-notation parse: 400, 20m, 2.5u, 1e-3 ---- */
const RE_NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const MULT: Record<string, number> = {
  p: 1e-12, P: 1e-12, n: 1e-9, N: 1e-9, u: 1e-6, U: 1e-6,
  m: 1e-3, k: 1e3, K: 1e3, M: 1e6,
};
export function parseNum(raw: string): number {
  let t = String(raw).trim().replace(/,/g, '.');
  if (t === '') throw new Error('empty');
  const last = t[t.length - 1];
  if (last in MULT && !t.toLowerCase().endsWith('e')) {
    const body = t.slice(0, -1);
    if (RE_NUM.test(body)) return parseFloat(body) * MULT[last];
    throw new Error('bad');
  }
  if (RE_NUM.test(t)) return parseFloat(t);
  throw new Error('bad');
}

export function fmtTime(t: number): string {
  if (!isFinite(t)) return 'DC';
  if (t >= 1) return fnum(t, 2) + 's';
  if (t >= 1e-3) return fnum(t * 1e3, 1) + 'ms';
  if (t >= 1e-6) return fnum(t * 1e6, 1) + 'us';
  return fnum(t * 1e9, 0) + 'ns';
}
