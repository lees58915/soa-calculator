import { useEffect, useState, useCallback, useRef } from 'react';
import {
  PARAMS, DEV_KEYS, OP_SW_KEYS, OP_LIN_KEYS, PROT_KEYS,
  type ParamMeta,
} from './engine/paramMeta';
import {
  fnum, parseNum,
  analyzeSwitching, analyzeLinear,
  runProtectionSuite, combine, PROTECTION_INFO,
  type LinearResult, type SwitchingResult, type FosterStage, type SpiritoInstability,
} from './engine/soaEngine';
import type { DeviceRecord } from './engine/deviceDatabase';
import { getDeviceDatabase } from './engine/deviceDatabase';
import { ParamTable, type ParamValues } from './components/ParamTable';
import { SoaChart } from './components/SoaChart';
import { SoaResultDetail } from './components/SoaResultDetail';
import { ProtectionResults } from './components/ProtectionResults';
import { DevicePicker } from './components/DevicePicker';
import { DatasheetImport } from './components/DatasheetImport';
import { FosterStages } from './components/FosterStages';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useToast } from './components/Toast';

type Mode = 'switching' | 'linear';
type ThermalMode = 'single' | 'foster';
type Tab = 'soa' | 'prot';

const DEFAULT_FOSTER: Array<{ R: string; tau: string }> = [
  { R: '0.05', tau: '5e-4' },
  { R: '0.12', tau: '5e-3' },
  { R: '0.20', tau: '5e-2' },
  { R: '0.13', tau: '0.5' },
];

function defaultValues(keys: readonly string[]): ParamValues {
  const out: ParamValues = {};
  keys.forEach((k) => { out[k] = PARAMS[k].typ; });
  return out;
}

const DEFAULT_PROT_ENABLED: Record<string, boolean> = {
  OVP: true, OCP: true, SCP: true, OTP: true, UVLO: true, DESAT: true,
};

export default function App() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('switching');
  const [tab, setTab] = useState<Tab>('soa');

  const [devVals, setDevVals] = useState<ParamValues>(defaultValues(DEV_KEYS));
  const [opVals, setOpVals] = useState<ParamValues>(defaultValues(OP_SW_KEYS));
  const [protVals, setProtVals] = useState<ParamValues>(defaultValues(PROT_KEYS));

  const [thermalMode, setThermalMode] = useState<ThermalMode>('single');
  const [singleVals, setSingleVals] = useState<ParamValues>(() => {
    const o: ParamValues = {};
    o['Rjc'] = PARAMS['Rjc'].typ;
    o['tau'] = PARAMS['tau'].typ;
    return o;
  });
  const [fosterStages, setFosterStages] = useState<Array<{ R: string; tau: string }>>(DEFAULT_FOSTER);

  const [siEnabled, setSiEnabled] = useState(false);
  const [siVals, setSiVals] = useState<ParamValues>(() => {
    const o: ParamValues = {};
    o['V_si_k'] = PARAMS['V_si_k'].typ;
    o['m_si'] = PARAMS['m_si'].typ;
    return o;
  });

  const [protEnabled, setProtEnabled] = useState<Record<string, boolean>>(DEFAULT_PROT_ENABLED);

  const [soaResult, setSoaResult] = useState<SwitchingResult | LinearResult | null>(null);
  const [protResults, setProtResults] = useState<Array<import('./engine/soaEngine').ProtectionResult>>([]);
  const [protOverall, setProtOverall] = useState<string>('IDLE');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [importerOpen, setImporterOpen] = useState(false);
  const [pickedDevice, setPickedDevice] = useState<DeviceRecord | null>(null);
  const configInputRef = useRef<HTMLInputElement>(null);

  const [err, setErr] = useState<string | null>(null);
  const [protErr, setProtErr] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  const recomputeTimer = useRef<number | null>(null);

  const [devWarnings, setDevWarnings] = useState<Set<string>>(new Set());
  const [opWarnings, setOpWarnings] = useState<Set<string>>(new Set());
  const [singleWarnings, setSingleWarnings] = useState<Set<string>>(new Set());
  const [siWarnings, setSiWarnings] = useState<Set<string>>(new Set());
  const [protWarnings, setProtWarnings] = useState<Set<string>>(new Set());

  const [devErrors, setDevErrors] = useState<Set<string>>(new Set());
  const [opErrors, setOpErrors] = useState<Set<string>>(new Set());
  const [protFieldErrors, setProtFieldErrors] = useState<Set<string>>(new Set());

  const gatherAndCompute = useCallback(() => {
    setErr(null);

    const devParsed: Record<string, number> = {};
    const devErrs: string[] = [];
    const devWarnKeys = new Set<string>();
    for (const k of DEV_KEYS) {
      const meta: ParamMeta = PARAMS[k];
      const raw = devVals[k] ?? '';
      if (meta.opt && raw.trim() === '') {
        devParsed[k] = 0;
        continue;
      }
      try {
        const v = parseNum(raw);
        if (!Number.isFinite(v)) throw new Error('nan');
        if (meta.pos && !(v > 0)) throw new Error('pos');
        if (meta.nonneg && v < 0) throw new Error('neg');
        devParsed[k] = v;
        if (v < meta.min || v > meta.max) devWarnKeys.add(k);
      } catch {
        devErrs.push(k);
      }
    }
    const opKeys = mode === 'switching' ? OP_SW_KEYS : OP_LIN_KEYS;
    const opParsed: Record<string, number> = {};
    const opErrs: string[] = [];
    const opWarnKeys = new Set<string>();
    for (const k of opKeys) {
      const meta = PARAMS[k];
      const raw = opVals[k] ?? '';
      if (meta.opt && raw.trim() === '') {
        opParsed[k] = 0;
        continue;
      }
      try {
        const v = parseNum(raw);
        if (!Number.isFinite(v)) throw new Error('nan');
        if (meta.pos && !(v > 0)) throw new Error('pos');
        if (meta.nonneg && v < 0) throw new Error('neg');
        opParsed[k] = v;
        if (v < meta.min || v > meta.max) opWarnKeys.add(k);
      } catch {
        opErrs.push(k);
      }
    }
    setDevWarnings(devWarnKeys);
    setOpWarnings(opWarnKeys);
    setDevErrors(new Set(devErrs));
    setOpErrors(new Set(opErrs));
    if (devErrs.length || opErrs.length) {
      const parts: string[] = [];
      if (devErrs.length) parts.push('Device: ' + devErrs.join(', '));
      if (opErrs.length) parts.push('Operating: ' + opErrs.join(', '));
      const detail = devErrs.map((k) => {
        const meta = PARAMS[k];
        return `• ${k}: enter a${meta.pos ? ' positive' : ''} number${meta.opt ? ' (or leave blank)' : ''}`;
      }).concat(opErrs.map((k) => {
        const meta = PARAMS[k];
        return `• ${k}: enter a${meta.pos ? ' positive' : ''} number${meta.opt ? ' (or leave blank)' : ''}`;
      })).join('\n');
      setErr(detail);
      setSoaResult(null);
      return;
    }

    let stages: FosterStage[] = [{ R: 0.5, tau: 0.05 }];
    if (mode === 'linear') {
      if (thermalMode === 'single') {
        const singleWarn = new Set<string>();
        let RjcOk = false, tauOk = false;
        try {
          const v = parseNum(singleVals['Rjc'] ?? '');
          if (v > 0) { devParsed['Rjc'] = v; RjcOk = true; }
          if (v < PARAMS['Rjc'].min || v > PARAMS['Rjc'].max) singleWarn.add('Rjc');
        } catch { /* ignore */ }
        try {
          const v = parseNum(singleVals['tau'] ?? '');
          if (v > 0) { devParsed['tau'] = v; tauOk = true; }
          if (v < PARAMS['tau'].min || v > PARAMS['tau'].max) singleWarn.add('tau');
        } catch { /* ignore */ }
        setSingleWarnings(singleWarn);
        if (!RjcOk || !tauOk) {
          setErr('RθJC and τ must both be positive.');
          setSoaResult(null);
          return;
        }
        stages = [{ R: devParsed['Rjc'], tau: devParsed['tau'] }];
      } else {
        const stagesNew: FosterStage[] = [];
        for (const s of fosterStages) {
          try {
            const R = parseNum(s.R);
            const tau = parseNum(s.tau);
            if (R > 0 && tau > 0) stagesNew.push({ R, tau });
          } catch { /* skip */ }
        }
        if (!stagesNew.length) {
          setErr('Foster stages need positive Ri and τi.');
          setSoaResult(null);
          return;
        }
        stages = stagesNew;
      }
    }
    setErr(null);

    let si: SpiritoInstability = { enabled: false, Vk: 0, m: -2 };
    if (mode === 'linear' && siEnabled) {
      try {
        const Vk = parseNum(siVals['V_si_k'] ?? '');
        const m = parseNum(siVals['m_si'] ?? '');
        if (!(Vk > 0)) throw new Error('Vk');
        si = { enabled: true, Vk, m };
        const siWarn = new Set<string>();
        if (Vk < PARAMS['V_si_k'].min || Vk > PARAMS['V_si_k'].max) siWarn.add('V_si_k');
        if (m < PARAMS['m_si'].min || m > PARAMS['m_si'].max) siWarn.add('m_si');
        setSiWarnings(siWarn);
      } catch {
        setErr('V_knee must be > 0.');
        setSoaResult(null);
        return;
      }
    }

    try {
      const p = { ...devParsed, ...opParsed };
      let r: SwitchingResult | LinearResult;
      if (mode === 'switching') {
        r = analyzeSwitching(p);
      } else {
        r = analyzeLinear(p, stages, si);
      }
      setSoaResult(r);
    } catch (e: unknown) {
      setErr('Calculation error: ' + (e instanceof Error ? e.message : String(e)));
      setSoaResult(null);
    } finally {
      setComputing(false);
    }
  }, [mode, devVals, opVals, singleVals, fosterStages, siEnabled, siVals, thermalMode]);

  const runProtectionCheck = useCallback(() => {
    setProtErr(null);
    const p: Record<string, number> = {};
    const errs: string[] = [];
    const warnKeys = new Set<string>();
    for (const k of PROT_KEYS) {
      const meta = PARAMS[k];
      try {
        const v = parseNum(protVals[k] ?? '');
        if (!Number.isFinite(v)) throw new Error('nan');
        if (meta.pos && !(v > 0)) throw new Error('pos');
        if (meta.nonneg && v < 0) throw new Error('neg');
        p[k] = v;
        if (v < meta.min || v > meta.max) warnKeys.add(k);
      } catch {
        errs.push(k);
      }
    }
    setProtWarnings(warnKeys);
    setProtFieldErrors(new Set(errs));
    if (errs.length) {
      const detail = errs.map((k) => {
        const meta = PARAMS[k];
        return `• ${k}: enter a${meta.pos ? ' positive' : ''} number`;
      }).join('\n');
      setProtErr(detail);
      setProtResults([]);
      setProtOverall('IDLE');
      return;
    }
    const enabled = Object.keys(protEnabled).filter((n) => protEnabled[n]);
    if (!enabled.length) {
      setProtErr('Tick at least one protection to test.');
      setProtResults([]);
      setProtOverall('IDLE');
      return;
    }
    try {
      const results = runProtectionSuite(p, enabled);
      setProtResults(results);
      const states = results.map((r) => r.state);
      setProtOverall(combine(states));
    } catch (e: unknown) {
      setProtErr('Calculation error: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [protVals, protEnabled]);

  const handleRun = useCallback(() => {
    setComputing(true);
    setTimeout(() => {
      gatherAndCompute();
      runProtectionCheck();
    }, 30);
  }, [gatherAndCompute, runProtectionCheck]);

  useEffect(() => {
    if (recomputeTimer.current) window.clearTimeout(recomputeTimer.current);
    recomputeTimer.current = window.setTimeout(() => {
      recomputeAndProt();
    }, 30);
    return () => {
      if (recomputeTimer.current) window.clearTimeout(recomputeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode, devVals, opVals, singleVals, fosterStages, siEnabled, siVals, thermalMode,
    protVals, protEnabled,
  ]);

  const recomputeAndProt = useCallback(() => {
    gatherAndCompute();
    runProtectionCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatherAndCompute, runProtectionCheck]);

  useEffect(() => {
    recomputeAndProt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setOpVals(defaultValues(mode === 'switching' ? OP_SW_KEYS : OP_LIN_KEYS));
  }, [mode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        if (tab === 'soa') gatherAndCompute();
        else runProtectionCheck();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tab, gatherAndCompute, runProtectionCheck]);

  const onDevChange = (k: string, v: string) => setDevVals((p) => ({ ...p, [k]: v }));
  const onOpChange = (k: string, v: string) => setOpVals((p) => ({ ...p, [k]: v }));
  const onProtChange = (k: string, v: string) => setProtVals((p) => ({ ...p, [k]: v }));

  const applyDevice = (dev: DeviceRecord) => {
    setPickedDevice(dev);
    const next: ParamValues = { ...devVals };
    next['BV'] = String(dev.BV);
    next['ID_max'] = String(dev.ID_max);
    next['RDS'] = String(dev.RDS);
    next['Tj_max'] = String(dev.Tj_max);
    if (dev.IDM) next['IDM'] = String(dev.IDM); else next['IDM'] = '';
    setDevVals(next);
    setSingleVals((p) => ({ ...p, Rjc: String(dev.Rjc), tau: PARAMS['tau'].typ }));
    if (dev.foster && dev.foster.length) {
      setThermalMode('foster');
      setFosterStages(dev.foster.map((s) => ({ R: String(s.R), tau: String(s.tau) })));
    }
    if (typeof dev.V_si_k === 'number') {
      setSiEnabled(true);
      setSiVals((p) => ({ ...p, V_si_k: String(dev.V_si_k) }));
    }
    if (typeof dev.m_si === 'number') {
      setSiVals((p) => ({ ...p, m_si: String(dev.m_si) }));
    }
  };

  const applyExtracted = (dev: Partial<DeviceRecord>) => {
    const next: ParamValues = { ...devVals };
    if (typeof dev.BV === 'number') next['BV'] = String(dev.BV);
    if (typeof dev.ID_max === 'number') next['ID_max'] = String(dev.ID_max);
    if (typeof dev.RDS === 'number') next['RDS'] = String(dev.RDS);
    if (typeof dev.Tj_max === 'number') next['Tj_max'] = String(dev.Tj_max);
    if (typeof dev.IDM === 'number') next['IDM'] = String(dev.IDM); else if ('IDM' in dev) next['IDM'] = '';
    if (typeof dev.Rjc === 'number') {
      setSingleVals((p) => ({ ...p, Rjc: String(dev.Rjc) }));
    }
    if (dev.foster && dev.foster.length) {
      setThermalMode('foster');
      setFosterStages(dev.foster.map((s) => ({ R: String(s.R), tau: String(s.tau) })));
    }
    if (typeof dev.V_si_k === 'number') {
      setSiEnabled(true);
      setSiVals((p) => ({ ...p, V_si_k: String(dev.V_si_k) }));
    }
    if (typeof dev.m_si === 'number') {
      setSiVals((p) => ({ ...p, m_si: String(dev.m_si) }));
    }
    setDevVals(next);
    if (dev.partNumber) setPickedDevice({ ...(dev as DeviceRecord), id: dev.id ?? 'imported' });
  };

  const saveCurrentAsDevice = async () => {
    try {
      const idBase = (pickedDevice?.partNumber ?? 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const id = `custom-${idBase}-${Date.now().toString(36)}`;
      const dev: DeviceRecord = {
        id,
        manufacturer: pickedDevice?.manufacturer ?? 'Custom',
        partNumber: pickedDevice?.partNumber ?? idBase,
        technology: pickedDevice?.technology ?? 'Si',
        package: pickedDevice?.package,
        description: pickedDevice?.description,
        BV: parseNum(devVals['BV']),
        ID_max: parseNum(devVals['ID_max']),
        IDM: devVals['IDM'] && devVals['IDM'].trim() !== '' ? parseNum(devVals['IDM']) : undefined,
        RDS: parseNum(devVals['RDS']),
        Tj_max: parseNum(devVals['Tj_max']),
        Rjc: parseNum(singleVals['Rjc'] ?? PARAMS['Rjc'].typ),
        tSC_DS: protVals['tSC_DS'] && protVals['tSC_DS'].trim() !== '' ? parseNum(protVals['tSC_DS']) : undefined,
        foster: thermalMode === 'foster' ? fosterStages.map((s) => ({ R: parseNum(s.R), tau: parseNum(s.tau) })) : pickedDevice?.foster,
        V_si_k: siEnabled ? parseNum(siVals['V_si_k'] ?? PARAMS['V_si_k'].typ) : undefined,
        m_si: siEnabled ? parseNum(siVals['m_si'] ?? PARAMS['m_si'].typ) : undefined,
        datasheetUrl: pickedDevice?.datasheetUrl,
        verifiedAt: new Date().toISOString(),
      };
      await getDeviceDatabase().upsert(dev);
      setPickedDevice(dev);
      toast(`Saved "${dev.partNumber}" to local device database.`, 'success');
    } catch (e: unknown) {
      toast('Failed to save device: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  const saveConfig = () => {
    const config = {
      mode, thermalMode, devVals, opVals, protVals,
      singleVals, fosterStages, siEnabled, siVals, protEnabled,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soa-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Configuration saved.', 'success');
  };

  const loadConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const cfg = JSON.parse(ev.target?.result as string);
        if (!cfg || typeof cfg !== 'object' || !cfg.mode) {
          throw new Error('Invalid config structure');
        }
        if (typeof cfg.devVals !== 'object' || typeof cfg.opVals !== 'object') {
          throw new Error('Config missing device/operating values');
        }
        if (cfg.fosterStages && !Array.isArray(cfg.fosterStages)) {
          throw new Error('Config fosterStages must be an array');
        }
        setMode(cfg.mode);
        setThermalMode(cfg.thermalMode);
        setDevVals(cfg.devVals);
        setOpVals(cfg.opVals);
        setProtVals(cfg.protVals);
        setSingleVals(cfg.singleVals);
        setFosterStages(cfg.fosterStages ?? DEFAULT_FOSTER);
        setSiEnabled(cfg.siEnabled);
        setSiVals(cfg.siVals);
        setProtEnabled(cfg.protEnabled);
        toast('Configuration loaded.', 'success');
      } catch (e: unknown) {
        toast('Failed to load config: ' + (e instanceof Error ? e.message : String(e)), 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const soaOverall = soaResult?.overall ?? 'IDLE';

  const copyResults = useCallback(() => {
    if (!soaResult) return;
    const lines: string[] = [`SOA Result: ${soaResult.overall}`];
    if (soaResult.mode === 'switching') {
      const r = soaResult;
      lines.push(`VDS: ${r.v_state} (peak ${fnum(r.VDS_peak, 0)}V / ${fnum(r.BV, 0)}V)`);
      lines.push(`ID: ${r.i_state} (${fnum(r.i_ratio * r.i_lim, 1)}A / ${fnum(r.i_lim, 0)}A)`);
      lines.push(`Tj: ${r.t_state} (${fnum(r.Tj, 0)}°C / ${fnum(r.Tj_max, 0)}°C)`);
    } else {
      const r = soaResult;
      lines.push(`Power: ${r.p_state} (${fnum(r.Pop, 0)}W / ${fnum(r.pmax, 0)}W)`);
      lines.push(`VDS: ${r.v_state} (${fnum(r.VDS, 0)}V / ${fnum(r.BV, 0)}V)`);
      lines.push(`ID: ${r.i_state} (${fnum(r.ID, 1)}A / ${fnum(r.i_lim, 0)}A)`);
      if (r.si_state) lines.push(`Derating: ${r.si_state}`);
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      toast('Results copied to clipboard.', 'success');
    });
  }, [soaResult]);

  const copyProtResults = useCallback(() => {
    if (!protResults.length) return;
    const lines = [`Protection Suite: ${protOverall}`];
    protResults.forEach((r) => lines.push(`${r.name}: ${r.state} — ${r.msg}`));
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      toast('Protection results copied to clipboard.', 'success');
    });
  }, [protResults, protOverall]);

  const showBanner = (overall: string) => {
    if (overall === 'IDLE') {
      return { cls: 'banner idle', text: 'Enter values and press Check SOA' };
    }
    if (overall === 'PASS') return { cls: 'banner pass', text: 'PASS' };
    if (overall === 'WARN') return { cls: 'banner warn', text: 'MARGINAL' };
    return { cls: 'banner fail', text: 'FAIL' };
  };
  const sb = showBanner(soaOverall);

  const protBanner = (() => {
    if (protOverall === 'IDLE') return { cls: 'banner idle', text: 'Select protections and press Run' };
    if (protOverall === 'PASS') return { cls: 'banner pass', text: 'ALL PASS' };
    if (protOverall === 'WARN') return { cls: 'banner warn', text: 'PASS WITH WARNINGS' };
    return { cls: 'banner fail', text: 'PROTECTION FAIL' };
  })();

  return (
    <div className="app">
      <header className="topbar">
        <h1><img src="./magnachip-logo.jpg" alt="MagnaChip" />Safe Operating Area Calculator</h1>
        <div className="topbar-actions">
          <button className="topbtn" onClick={() => setPickerOpen(true)}>Device DB</button>
          <button className="topbtn" onClick={() => setImporterOpen(true)}>Import</button>
          <button className="topbtn" onClick={saveConfig}>Save</button>
          <button className="topbtn" onClick={() => configInputRef.current?.click()}>Load</button>
          <input ref={configInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={loadConfig} />
        </div>
      </header>

      <nav className="tabs" onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          setTab((t) => t === 'soa' ? 'prot' : 'soa');
        }
      }}>
        <button className={'tab' + (tab === 'soa' ? ' active' : '')} onClick={() => setTab('soa')}>
          SOA Check
        </button>
        <button className={'tab' + (tab === 'prot' ? ' active' : '')} onClick={() => setTab('prot')}>
          Protection
        </button>
      </nav>

      <main>
        {tab === 'soa' ? (
          <section className="layout">
            <aside className="panel inputs">
              <div className="group">
                <div className="group-h">Mode</div>
                <div className="group-b">
                  <div className="modes">
                    <button
                      className={'mode-opt' + (mode === 'switching' ? ' sel' : '')}
                      onClick={() => setMode('switching')}
                    >
                      Switching
                    </button>
                    <button
                      className={'mode-opt' + (mode === 'linear' ? ' sel' : '')}
                      onClick={() => setMode('linear')}
                    >
                      Linear
                    </button>
                  </div>
                </div>
              </div>

              <div className="group">
                <div className="group-h">Device Parameters</div>
                <div className="group-b">
                  <ParamTable
                    keys={DEV_KEYS}
                    values={devVals}
                    onChange={onDevChange}
                    errors={devErrors}
                    warnings={devWarnings}
                  />
                </div>
              </div>

              {mode === 'linear' && (
                <div className="group">
                  <div className="group-h">Thermal Model</div>
                  <div className="group-b">
                    <div className="tmodes">
                      <button
                        className={'tmode' + (thermalMode === 'single' ? ' sel' : '')}
                        onClick={() => setThermalMode('single')}
                      >
                        Single-pole
                      </button>
                      <button
                        className={'tmode' + (thermalMode === 'foster' ? ' sel' : '')}
                        onClick={() => setThermalMode('foster')}
                      >
                        Foster
                      </button>
                    </div>
                    {thermalMode === 'single' ? (
                      <ParamTable
                        keys={['Rjc', 'tau']}
                        values={singleVals}
                        onChange={(k, v) => setSingleVals((p) => ({ ...p, [k]: v }))}
                        errors={new Set()}
                        warnings={singleWarnings}
                      />
                    ) : (
                      <FosterStages stages={fosterStages} onChange={setFosterStages} />
                    )}
                    <div className="si-wrap">
                      <label className="si-en">
                        <input
                          type="checkbox"
                          checked={siEnabled}
                          onChange={(e) => setSiEnabled(e.target.checked)}
                        />
                        <span>SOA derating (instability)</span>
                      </label>
                      {siEnabled && (
                        <div className="si-fields">
                          <div className="sif">
                            <div className="sif-h">
                              <span>V<sub>knee</sub> (V)</span>
                            </div>
                            <input
                              className={'pin' + (siWarnings.has('V_si_k') ? ' warn' : '')}
                              type="text"
                              value={siVals['V_si_k']}
                              spellCheck={false}
                              inputMode="decimal"
                              onChange={(e) => setSiVals((p) => ({ ...p, V_si_k: e.target.value }))}
                            />
                          </div>
                          <div className="sif">
                            <div className="sif-h">
                              <span>slope m</span>
                            </div>
                            <input
                              className={'pin' + (siWarnings.has('m_si') ? ' warn' : '')}
                              type="text"
                              value={siVals['m_si']}
                              spellCheck={false}
                              inputMode="decimal"
                              onChange={(e) => setSiVals((p) => ({ ...p, m_si: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="group">
                <div className="group-h">Operating Point — {mode === 'switching' ? 'Switching' : 'Linear'}</div>
                <div className="group-b">
                  <ParamTable
                    keys={mode === 'switching' ? OP_SW_KEYS : OP_LIN_KEYS}
                    values={opVals}
                    onChange={onOpChange}
                    errors={opErrors}
                    warnings={opWarnings}
                  />
                </div>
              </div>

              {err && (
                <div className="err-msg show">
                  <span style={{ whiteSpace: 'pre-line' }}>{err}</span>
                  <button className="err-dismiss" onClick={() => setErr(null)} aria-label="Dismiss error">×</button>
                </div>
              )}
              <button className="run-btn" onClick={handleRun} disabled={computing}>
                {computing ? 'Running…' : 'Run SOA Check'}
              </button>
            </aside>

            <section className="results">
              <div className={sb.cls}>
                <span>{sb.text}</span>
                {soaResult && (
                  <button className="banner-copy" onClick={copyResults} title="Copy results to clipboard" aria-label="Copy results to clipboard">📋</button>
                )}
              </div>

              <div className="detail">
                <ErrorBoundary key={soaResult ? 'detail-has-data' : 'detail-empty'} label="SoaResultDetail">
                  {soaResult ? <SoaResultDetail result={soaResult} /> : <div className="muted">Awaiting valid inputs.</div>}
                </ErrorBoundary>
              </div>

              <div className="card">
                <div className="card-h">SOA Diagram</div>
                <ErrorBoundary key={soaResult ? 'chart-has-data' : 'chart-empty'} label="SoaChart">
                  {soaResult ? <SoaChart result={soaResult} /> : (
                    <div className="chart-empty">Enter parameters to render the SOA curve.</div>
                  )}
                </ErrorBoundary>
              </div>
            </section>
          </section>
        ) : (
          <section className="layout">
            <aside className="panel inputs">
              <div className="group">
                <div className="group-h">Protections</div>
                <div className="group-b">
                  <div className="prot-list">
                    {Object.entries(PROTECTION_INFO).map(([name]) => {
                      return (
                        <label className="prot-chk" key={name}>
                          <input
                            type="checkbox"
                            checked={protEnabled[name] ?? false}
                            onChange={(e) => setProtEnabled((p) => ({ ...p, [name]: e.target.checked }))}
                          />
                          <span className="pc-t"><b>{name}</b></span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="group">
                <div className="group-h">Parameters</div>
                <div className="group-b">
                  <div className="scrollbox">
                    <ParamTable
                      keys={PROT_KEYS}
                      values={protVals}
                      onChange={onProtChange}
                      errors={protFieldErrors}
                      warnings={protWarnings}
                    />
                  </div>
                </div>
              </div>
              {protErr && (
                <div className="err-msg show">
                  <span>{protErr}</span>
                  <button className="err-dismiss" onClick={() => setProtErr(null)} aria-label="Dismiss error">×</button>
                </div>
              )}
              <button className="run-btn" onClick={runProtectionCheck} disabled={computing}>
                {computing ? 'Running…' : 'Run Protection Check'}
              </button>
            </aside>

            <section className="results">
              <div className={protBanner.cls}>
                <span>{protBanner.text}</span>
                {protResults.length > 0 && (
                  <button className="banner-copy" onClick={copyProtResults} title="Copy protection results to clipboard" aria-label="Copy protection results to clipboard">📋</button>
                )}
              </div>
              {protWarnings.size > 0 && (
                <div className="advisory show">
                  <div className="adv-h">⚠ Out of typical range</div>
                  <ul>
                    {Array.from(protWarnings).map((k) => {
                      const m = PARAMS[k];
                      return <li key={k}>{k} is outside the typical range [{m.min}, {m.max}]</li>;
                    })}
                  </ul>
                </div>
              )}
              <ErrorBoundary key={`prot-${protResults.length}`} label="ProtectionResults">
                <ProtectionResults results={protResults} />
              </ErrorBoundary>
            </section>
          </section>
        )}
      </main>

      <footer>
        MOSFET SOA Calculator · all computation is local.
      </footer>

      <DevicePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(d) => { applyDevice(d); setPickerOpen(false); }}
      />
      <DatasheetImport
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        onApply={applyExtracted}
      />
    </div>
  );
}
