/* ---- parameter metadata (mirror of original HTML PARAMS) ---- */

type Unit =
  | 'V'
  | 'A'
  | 'W'
  | 'Ohm'
  | 'degC'
  | 'degC/W'
  | 's'
  | '%'
  | '';

export interface ParamMeta {
  key: string;
  help: string;
  min: number;
  max: number;
  typ: string; // typical displayed value
  unit: Unit;
  pos?: boolean; // > 0 required
  nonneg?: boolean; // >= 0 required
  opt?: boolean; // optional / blank allowed
}

export const PARAMS: Record<string, ParamMeta> = {
  BV: {
    key: 'BV',
    help: 'Breakdown voltage BVDSS (datasheet Absolute Max). Pick BV >= 1.25 x Vbus.',
    min: 10, max: 2000, typ: '650', unit: 'V', pos: true,
  },
  ID_max: {
    key: 'ID_max',
    help: 'Max continuous drain current ID (datasheet, package limit).',
    min: 1, max: 2000, typ: '36', unit: 'A', pos: true,
  },
  IDM: {
    key: 'IDM',
    help: 'Pulsed drain current IDM (datasheet). Sets the SOA plateau for pulsed curves; blank = use ID_max.',
    min: 1, max: 20000, typ: '144', unit: 'A', pos: true, opt: true,
  },
  RDS: {
    key: 'RDS',
    help: 'RDS(on) at operating Tj (ohm). 10 mOhm = 0.010.',
    min: 1e-5, max: 10, typ: '0.020', unit: 'Ohm', pos: true,
  },
  Tj_max: {
    key: 'Tj_max',
    help: 'Max rated junction temperature (datasheet abs-max).',
    min: 100, max: 250, typ: '150', unit: 'degC', pos: true,
  },
  Rjc: {
    key: 'Rjc',
    help: 'Thermal resistance junction-to-case (datasheet).',
    min: 0.01, max: 50, typ: '0.5', unit: 'degC/W', pos: true,
  },
  tau: {
    key: 'tau',
    help: 'Thermal time constant (s) of the Zth curve knee.',
    min: 1e-5, max: 100, typ: '0.05', unit: 's', pos: true,
  },
  Vbus: {
    key: 'Vbus',
    help: 'DC bus voltage the switch blocks when OFF.',
    min: 1, max: 2000, typ: '400', unit: 'V', pos: true,
  },
  ID: {
    key: 'ID',
    help: 'Operating drain current (switching: the conducted current; linear: the current while dropping VDS).',
    min: 0.01, max: 2000, typ: '20', unit: 'A', nonneg: true,
  },
  V_overshoot_pct: {
    key: 'V_overshoot_pct',
    help: 'Turn-off voltage overshoot from ringing (%). 30 means peak VDS = 1.3 x Vbus.',
    min: 0, max: 200, typ: '30', unit: '%', nonneg: true,
  },
  Ploss: {
    key: 'Ploss',
    help: 'Average power dissipated in the device (W). From a loss calculation or measurement.',
    min: 0.01, max: 2000, typ: '8', unit: 'W', nonneg: true,
  },
  Ta: {
    key: 'Ta',
    help: 'Ambient temperature (degC).',
    min: -40, max: 125, typ: '25', unit: 'degC',
  },
  Rth_ja: {
    key: 'Rth_ja',
    help: 'Total junction-to-ambient thermal resistance (degC/W) including heatsink.',
    min: 0.1, max: 500, typ: '5', unit: 'degC/W', pos: true,
  },
  VDS: {
    key: 'VDS',
    help: 'Drain-source voltage held across the device WHILE conducting (linear mode).',
    min: 0.1, max: 2000, typ: '48', unit: 'V', nonneg: true,
  },
  t_pulse: {
    key: 't_pulse',
    help: 'Pulse duration the device stays in linear mode (s). 1ms = 1e-3.',
    min: 1e-7, max: 100, typ: '0.001', unit: 's', pos: true,
  },
  Tc: {
    key: 'Tc',
    help: 'Case temperature (degC) - heatsink/case surface.',
    min: -40, max: 200, typ: '50', unit: 'degC',
  },
  V_ovp: {
    key: 'V_ovp',
    help: 'Over-Voltage Protection trip threshold (V). Must sit above Vbus but below BVDSS (incl. ringing).',
    min: 1, max: 2000, typ: '450', unit: 'V',
  },
  Iout: {
    key: 'Iout',
    help: 'Normal load / output current (A) - the OCP must NOT trip here.',
    min: 0.01, max: 2000, typ: '20', unit: 'A',
  },
  I_ocp: {
    key: 'I_ocp',
    help: 'Over-Current Protection trip threshold (A). Above Iout, below ID_max.',
    min: 0.1, max: 2000, typ: '30', unit: 'A',
  },
  t_response: {
    key: 't_response',
    help: 'Total short-circuit protection response time (s) = blank + detect + propagation + soft-off. 2.5us = 2.5e-6.',
    min: 1e-8, max: 1e-4, typ: '2.5e-6', unit: 's', pos: true,
  },
  tSC_DS: {
    key: 'tSC_DS',
    help: 'Datasheet short-circuit withstand time t_SC (s). SiC 2-5us. If absent the device is NOT SC-rated.',
    min: 1e-7, max: 5e-5, typ: '3e-6', unit: 's',
  },
  T_otp: {
    key: 'T_otp',
    help: 'Over-Temperature Protection trip point (degC). Below Tj_max, above ambient.',
    min: 0, max: 250, typ: '135', unit: 'degC',
  },
  V_uvlo_on: {
    key: 'V_uvlo_on',
    help: 'Gate-driver UVLO release voltage (V). Must exceed the Miller plateau so the FET fully enhances.',
    min: 1, max: 30, typ: '11', unit: 'V',
  },
  V_miller: {
    key: 'V_miller',
    help: 'Gate Miller-plateau voltage (V) = Vth + ID/gfs. From the datasheet gate-charge curve.',
    min: 0.5, max: 15, typ: '7', unit: 'V',
  },
  Vgs_nominal: {
    key: 'Vgs_nominal',
    help: 'Nominal gate drive voltage (V).',
    min: 3, max: 25, typ: '15', unit: 'V',
  },
  V_desat_th: {
    key: 'V_desat_th',
    help: 'DESAT comparator threshold (V). Above normal on-state VDS, below the saturated fault VDS.',
    min: 0.5, max: 15, typ: '7', unit: 'V',
  },
  I_fault: {
    key: 'I_fault',
    help: 'Fault (saturation) current used to size DESAT/normal VDS (A).',
    min: 1, max: 2000, typ: '200', unit: 'A',
  },
  V_si_k: {
    key: 'V_si_k',
    help: 'Thermal-instability knee voltage (V). Above this VDS the linear-mode SOA rolls off below the P=V*I hyperbola. Read from the datasheet linear/DC SOA; a first guess is ~10-20% of BVDSS.',
    min: 1, max: 2000, typ: '60', unit: 'V', pos: true,
  },
  m_si: {
    key: 'm_si',
    help: 'Log-log slope of the derated SOA segment (dimensionless, must be < -1). Si linear-mode ~ -2.0; SiC milder (~ -1.3 to -1.6). More negative = harder high-VDS derating.',
    min: -4, max: -1, typ: '-2', unit: '',
  },
  duty: {
    key: 'duty',
    help: 'Repetitive duty ratio D (0 < D ≤ 1). Blank = single pulse. For steady-state repetitive pulses at switching frequency.',
    min: 1e-6, max: 1, typ: '', unit: '', pos: true, opt: true,
  },
};

export const DEV_KEYS = ['BV', 'ID_max', 'IDM', 'RDS', 'Tj_max'] as const;
export const OP_SW_KEYS = ['Vbus', 'ID', 'V_overshoot_pct', 'Ploss', 'Ta', 'Rth_ja'] as const;
export const OP_LIN_KEYS = ['VDS', 'ID', 't_pulse', 'Tc', 'duty'] as const;
/** Display names using proper subscript / Greek-letter notation */
export const PARAM_DISPLAY: Record<string, string> = {
  BV: 'BV<sub>DSS</sub>',
  ID_max: 'I<sub>D</sub>(max)',
  IDM: 'I<sub>DM</sub>',
  RDS: 'R<sub>DS</sub>(on)',
  Tj_max: 'T<sub>J</sub>(max)',
  Rjc: 'R<sub>θJC</sub>',
  tau: 'τ',
  Vbus: 'V<sub>Bus</sub>',
  ID: 'I<sub>D</sub>',
  V_overshoot_pct: 'V<sub>OS</sub>%',
  Ploss: 'P<sub>loss</sub>',
  Ta: 'T<sub>A</sub>',
  Rth_ja: 'R<sub>θJA</sub>',
  VDS: 'V<sub>DS</sub>',
  t_pulse: 't<sub>p</sub>',
  Tc: 'T<sub>C</sub>',
  V_ovp: 'V<sub>OVP</sub>',
  Iout: 'I<sub>OUT</sub>',
  I_ocp: 'I<sub>OCP</sub>',
  t_response: 't<sub>resp</sub>',
  tSC_DS: 't<sub>SC</sub>',
  T_otp: 'T<sub>OTP</sub>',
  V_uvlo_on: 'V<sub>UVLO</sub>',
  V_miller: 'V<sub>Miller</sub>',
  Vgs_nominal: 'V<sub>GS,nom</sub>',
  V_desat_th: 'V<sub>DESAT</sub>',
  I_fault: 'I<sub>FAULT</sub>',
  V_si_k: 'V<sub>knee</sub>',
  m_si: 'm',
  duty: 'Duty D',
};

export const PROT_KEYS = [
  'Vbus', 'BV', 'V_overshoot_pct', 'V_ovp', 'Iout', 'ID_max', 'I_ocp',
  't_response', 'tSC_DS', 'T_otp', 'Tj_max', 'Ta', 'V_uvlo_on',
  'V_miller', 'Vgs_nominal', 'V_desat_th', 'RDS', 'I_fault',
] as const;
