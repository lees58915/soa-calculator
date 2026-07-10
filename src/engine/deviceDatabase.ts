import type { FosterStage } from './soaEngine';

export interface DeviceRecord {
  /** Unique stable id, e.g. "infineon-ipw65r080cfd" */
  id: string;
  /** Manufacturer */
  manufacturer: string;
  /** Part number as displayed */
  partNumber: string;
  /** Technology: Si, SiC, GaN */
  technology: 'Si' | 'SiC' | 'GaN';
  /** Package (e.g. "TO-247") */
  package?: string;
  /** Short marketing description / use case */
  description?: string;
  /** BVDSS, V */
  BV: number;
  /** Continuous drain current, A (package-limited) */
  ID_max: number;
  /** Pulsed drain current, A */
  IDM?: number;
  /** RDS(on) at 25C, ohm */
  RDS: number;
  /** Max junction temperature, degC */
  Tj_max: number;
  /** Thermal resistance junction-to-case, degC/W */
  Rjc: number;
  /** Short-circuit withstand time, s (omit if not rated) */
  tSC_DS?: number;
  /** Optional default Foster network */
  foster?: FosterStage[];
  /** Optional default thermal-instability knee */
  V_si_k?: number;
  m_si?: number;
  /** Data source URL (datasheet) */
  datasheetUrl?: string;
  /** ISO timestamp of when this record was last verified */
  verifiedAt?: string;
}

interface DeviceDatabaseAdapter {
  list(): Promise<DeviceRecord[]>;
  search(query: string): Promise<DeviceRecord[]>;
  get(id: string): Promise<DeviceRecord | null>;
  upsert(record: DeviceRecord): Promise<DeviceRecord>;
  remove(id: string): Promise<void>;
}

const RjcEst = (pkg: string, RDS: number) => {
  if (pkg.includes('TO-247')) return RDS < 0.01 ? 0.35 : RDS < 0.05 ? 0.4 : RDS < 0.1 ? 0.5 : 0.6;
  if (pkg.includes('TO-220')) return RDS < 0.05 ? 0.6 : RDS < 0.15 ? 1.0 : 2.0;
  if (pkg.includes('DPAK') || pkg.includes('TO-252')) return 3.0;
  if (pkg.includes('PQFN') || pkg.includes('SuperSO8')) return RDS < 0.005 ? 0.5 : 1.0;
  if (pkg.includes('SOT')) return 20;
  return 1.0;
};

const SI_SI = (v: number) => ({ V_si_k: v, m_si: -2.0 });

/* ---- Built-in seed catalog ---- */
const SEED: DeviceRecord[] = [
  /* ── MagnaChip ── */
  {
    id: 'magnachip-mmft65r090rth', manufacturer: 'MagnaChip', partNumber: 'MMFT65R090RTH',
    technology: 'Si', package: 'TO-220FT', description: '650V 0.09Ω Super-Junction MOSFET, Gen6.',
    BV: 650, ID_max: 35, IDM: 105, RDS: 0.09, Tj_max: 150, Rjc: 3.21, ...SI_SI(80),
    datasheetUrl: 'https://www.magnachip.com/',
  },
  {
    id: 'magnachip-mmft65r115rth', manufacturer: 'MagnaChip', partNumber: 'MMFT65R115RTH',
    technology: 'Si', package: 'TO-220FT', description: '650V 0.115Ω Super-Junction MOSFET, Gen6.',
    BV: 650, ID_max: 30, IDM: 90, RDS: 0.115, Tj_max: 150, Rjc: 3.5, ...SI_SI(80),
    datasheetUrl: 'https://www.magnachip.com/',
  },
  {
    id: 'magnachip-mmq65r099rfth', manufacturer: 'MagnaChip', partNumber: 'MMQ65R099RFTH',
    technology: 'Si', package: 'TO-247', description: '650V 0.099Ω Super-Junction MOSFET, Gen6.',
    BV: 650, ID_max: 35, IDM: 105, RDS: 0.099, Tj_max: 150, Rjc: 0.6, ...SI_SI(80),
    datasheetUrl: 'https://www.magnachip.com/',
  },
  {
    id: 'magnachip-mmtb65r099rfrhn', manufacturer: 'MagnaChip', partNumber: 'MMTB65R099RFRH',
    technology: 'Si', package: 'TOLL', description: '650V 0.099Ω Super-Junction MOSFET, Gen6, TOLL.',
    BV: 650, ID_max: 35, IDM: 105, RDS: 0.099, Tj_max: 150, Rjc: 0.55, ...SI_SI(80),
    datasheetUrl: 'https://www.magnachip.com/',
  },
  {
    id: 'magnachip-mmft65r190s6zth', manufacturer: 'MagnaChip', partNumber: 'MMFT65R190S6ZTH',
    technology: 'Si', package: 'TO-220FT', description: '650V 0.19Ω Super-Junction MOSFET, Gen6.',
    BV: 650, ID_max: 18, IDM: 54, RDS: 0.19, Tj_max: 150, Rjc: 4.5, ...SI_SI(80),
    datasheetUrl: 'https://www.magnachip.com/',
  },
  {
    id: 'magnachip-mmd65r280s6zrh', manufacturer: 'MagnaChip', partNumber: 'MMD65R280S6ZRH',
    technology: 'Si', package: 'DPAK', description: '650V 0.28Ω Super-Junction MOSFET, DPAK.',
    BV: 650, ID_max: 12, IDM: 36, RDS: 0.28, Tj_max: 150, Rjc: 5.0, ...SI_SI(80),
    datasheetUrl: 'https://www.magnachip.com/',
  },
  {
    id: 'magnachip-mmhs70r1k6rz', manufacturer: 'MagnaChip', partNumber: 'MMHS70R1K6RZ',
    technology: 'Si', package: 'SOT-223', description: '700V 1.69Ω Super-Junction MOSFET, SOT-223.',
    BV: 700, ID_max: 5.4, IDM: 16.2, RDS: 1.69, Tj_max: 150, Rjc: 22, ...SI_SI(80),
    datasheetUrl: 'https://www.magnachip.com/',
  },
  {
    id: 'magnachip-mmft65r310s6zth', manufacturer: 'MagnaChip', partNumber: 'MMFT65R310S6ZTH',
    technology: 'Si', package: 'TO-220FT', description: '650V 0.31Ω Super-Junction MOSFET, Gen6.',
    BV: 650, ID_max: 11, IDM: 33, RDS: 0.31, Tj_max: 150, Rjc: 6.5, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmft65r520s6zth', manufacturer: 'MagnaChip', partNumber: 'MMFT65R520S6ZTH',
    technology: 'Si', package: 'TO-220FT', description: '650V 0.52Ω Super-Junction MOSFET, Gen6.',
    BV: 650, ID_max: 7.5, IDM: 22.5, RDS: 0.52, Tj_max: 150, Rjc: 8.0, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmft70r380s6zth', manufacturer: 'MagnaChip', partNumber: 'MMFT70R380S6ZTH',
    technology: 'Si', package: 'TO-220FT', description: '700V 0.38Ω Super-Junction MOSFET, Gen6.',
    BV: 700, ID_max: 9.5, IDM: 28.5, RDS: 0.38, Tj_max: 150, Rjc: 7.0, ...SI_SI(80),
  },
  /* ── MagnaChip 600V Gen6 SJ MOSFETs ── */
  {
    id: 'magnachip-mmft60r180s6zth', manufacturer: 'MagnaChip', partNumber: 'MMFT60R180S6ZTH',
    technology: 'Si', package: 'TO-220FT', description: '600V 0.18Ω Gen6 Super-Junction MOSFET.',
    BV: 600, ID_max: 18, IDM: 54, RDS: 0.18, Tj_max: 150, Rjc: 1.0, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmd60r180s6zrh', manufacturer: 'MagnaChip', partNumber: 'MMD60R180S6ZRH',
    technology: 'Si', package: 'DPAK', description: '600V 0.18Ω Gen6 Super-Junction MOSFET, DPAK.',
    BV: 600, ID_max: 18, IDM: 54, RDS: 0.18, Tj_max: 150, Rjc: 3.0, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmd60r195s6fzrh', manufacturer: 'MagnaChip', partNumber: 'MMD60R195S6FZRH',
    technology: 'Si', package: 'DPAK', description: '600V 0.195Ω Gen6 Super-Junction MOSFET, fast diode, DPAK.',
    BV: 600, ID_max: 18, IDM: 54, RDS: 0.195, Tj_max: 150, Rjc: 3.0, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmp60r260s6zth', manufacturer: 'MagnaChip', partNumber: 'MMP60R260S6ZTH',
    technology: 'Si', package: 'TO-220', description: '600V 0.26Ω Gen6 Super-Junction MOSFET.',
    BV: 600, ID_max: 12, IDM: 36, RDS: 0.26, Tj_max: 150, Rjc: 1.5, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmd60r260s6zrh', manufacturer: 'MagnaChip', partNumber: 'MMD60R260S6ZRH',
    technology: 'Si', package: 'DPAK', description: '600V 0.26Ω Gen6 Super-Junction MOSFET, DPAK.',
    BV: 600, ID_max: 12, IDM: 36, RDS: 0.26, Tj_max: 150, Rjc: 3.0, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmfa60r330s6zth', manufacturer: 'MagnaChip', partNumber: 'MMFA60R330S6ZTH',
    technology: 'Si', package: 'TO-220FA', description: '600V 0.33Ω Gen6 Super-Junction MOSFET.',
    BV: 600, ID_max: 9, IDM: 27, RDS: 0.33, Tj_max: 150, Rjc: 2.0, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmd60r330s6zrh', manufacturer: 'MagnaChip', partNumber: 'MMD60R330S6ZRH',
    technology: 'Si', package: 'DPAK', description: '600V 0.33Ω Gen6 Super-Junction MOSFET, DPAK.',
    BV: 600, ID_max: 9, IDM: 27, RDS: 0.33, Tj_max: 150, Rjc: 3.0, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmhs60r330s6zurh', manufacturer: 'MagnaChip', partNumber: 'MMHS60R330S6ZURH',
    technology: 'Si', package: 'SOT-223', description: '600V 0.33Ω Gen6 Super-Junction MOSFET, SOT-223.',
    BV: 600, ID_max: 9, IDM: 27, RDS: 0.33, Tj_max: 150, Rjc: 20, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmd60r360s6fzrh', manufacturer: 'MagnaChip', partNumber: 'MMD60R360S6FZRH',
    technology: 'Si', package: 'DPAK', description: '600V 0.36Ω Gen6 Super-Junction MOSFET, fast diode, DPAK.',
    BV: 600, ID_max: 9, IDM: 27, RDS: 0.36, Tj_max: 150, Rjc: 3.0, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmhs60r360s6fzurh', manufacturer: 'MagnaChip', partNumber: 'MMHS60R360S6FZURH',
    technology: 'Si', package: 'SOT-223', description: '600V 0.36Ω Gen6 Super-Junction MOSFET, fast diode, SOT-223.',
    BV: 600, ID_max: 9, IDM: 27, RDS: 0.36, Tj_max: 150, Rjc: 20, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmfa60r550s6zth', manufacturer: 'MagnaChip', partNumber: 'MMFA60R550S6ZTH',
    technology: 'Si', package: 'TO-220FA', description: '600V 0.55Ω Gen6 Super-Junction MOSFET.',
    BV: 600, ID_max: 6, IDM: 18, RDS: 0.55, Tj_max: 150, Rjc: 2.5, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmd60r550s6zrh', manufacturer: 'MagnaChip', partNumber: 'MMD60R550S6ZRH',
    technology: 'Si', package: 'DPAK', description: '600V 0.55Ω Gen6 Super-Junction MOSFET, DPAK.',
    BV: 600, ID_max: 6, IDM: 18, RDS: 0.55, Tj_max: 150, Rjc: 3.0, ...SI_SI(80),
  },
  /* ── MagnaChip 650V additional variants ── */
  {
    id: 'magnachip-mmtb65r130rfrhn', manufacturer: 'MagnaChip', partNumber: 'MMTB65R130RFRH',
    technology: 'Si', package: 'TOLL', description: '650V 0.13Ω Super-Junction MOSFET, TOLL with Kelvin source.',
    BV: 650, ID_max: 30, IDM: 90, RDS: 0.13, Tj_max: 150, Rjc: 0.6, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmub65r090rurh', manufacturer: 'MagnaChip', partNumber: 'MMUB65R090RURH',
    technology: 'Si', package: 'PDFN88', description: '650V 0.09Ω Super-Junction MOSFET, PDFN88.',
    BV: 650, ID_max: 35, IDM: 105, RDS: 0.09, Tj_max: 150, Rjc: 0.65, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmub65r115rurh', manufacturer: 'MagnaChip', partNumber: 'MMUB65R115RURH',
    technology: 'Si', package: 'PDFN88', description: '650V 0.115Ω Super-Junction MOSFET, PDFN88.',
    BV: 650, ID_max: 30, IDM: 90, RDS: 0.115, Tj_max: 150, Rjc: 0.7, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmub65r190s6zurh', manufacturer: 'MagnaChip', partNumber: 'MMUB65R190S6ZURH',
    technology: 'Si', package: 'PDFN88', description: '650V 0.19Ω Gen6 Super-Junction MOSFET, PDFN88.',
    BV: 650, ID_max: 18, IDM: 54, RDS: 0.19, Tj_max: 150, Rjc: 1.0, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmsfa65r280s6zth', manufacturer: 'MagnaChip', partNumber: 'MMSFA65R280S6ZTH',
    technology: 'Si', package: 'TO-220SFA', description: '650V 0.28Ω Gen6 Super-Junction MOSFET, TO-220SFA.',
    BV: 650, ID_max: 12, IDM: 36, RDS: 0.28, Tj_max: 150, Rjc: 3.5, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmsfa65r380s6zth', manufacturer: 'MagnaChip', partNumber: 'MMSFA65R380S6ZTH',
    technology: 'Si', package: 'TO-220SFA', description: '650V 0.38Ω Gen6 Super-Junction MOSFET, TO-220SFA.',
    BV: 650, ID_max: 9, IDM: 27, RDS: 0.38, Tj_max: 150, Rjc: 4.0, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmft65r600s6zth', manufacturer: 'MagnaChip', partNumber: 'MMFT65R600S6ZTH',
    technology: 'Si', package: 'TO-220FT', description: '650V 0.60Ω Gen6 Super-Junction MOSFET.',
    BV: 650, ID_max: 6, IDM: 18, RDS: 0.60, Tj_max: 150, Rjc: 6.5, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmd65r600s6zrh', manufacturer: 'MagnaChip', partNumber: 'MMD65R600S6ZRH',
    technology: 'Si', package: 'DPAK', description: '650V 0.60Ω Gen6 Super-Junction MOSFET, DPAK.',
    BV: 650, ID_max: 6, IDM: 18, RDS: 0.60, Tj_max: 150, Rjc: 5.0, ...SI_SI(80),
  },
  /* ── MagnaChip 700V Gen6 SJ MOSFETs ── */
  {
    id: 'magnachip-mmft70r360s6zth', manufacturer: 'MagnaChip', partNumber: 'MMFT70R360S6ZTH',
    technology: 'Si', package: 'TO-220FT', description: '700V 0.36Ω Gen6 Super-Junction MOSFET.',
    BV: 700, ID_max: 12.5, IDM: 37.5, RDS: 0.36, Tj_max: 150, Rjc: 4.5, ...SI_SI(80),
  },
  {
    id: 'magnachip-mme70r360s6zrh', manufacturer: 'MagnaChip', partNumber: 'MME70R360S6ZRH',
    technology: 'Si', package: 'D2PAK', description: '700V 0.36Ω Gen6 Super-Junction MOSFET, D2PAK.',
    BV: 700, ID_max: 12.5, IDM: 37.5, RDS: 0.36, Tj_max: 150, Rjc: 1.5, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmd70r360s6zrh', manufacturer: 'MagnaChip', partNumber: 'MMD70R360S6ZRH',
    technology: 'Si', package: 'DPAK', description: '700V 0.36Ω Gen6 Super-Junction MOSFET, DPAK.',
    BV: 700, ID_max: 12.5, IDM: 37.5, RDS: 0.36, Tj_max: 150, Rjc: 5.0, ...SI_SI(80),
  },
  /* ── MagnaChip legacy fast-diode SJ MOSFETs ── */
  {
    id: 'magnachip-mmq60r044rfth', manufacturer: 'MagnaChip', partNumber: 'MMQ60R044RFTH',
    technology: 'Si', package: 'TO-247', description: '600V 0.044Ω Super-Junction MOSFET, fast diode.',
    BV: 600, ID_max: 60, IDM: 180, RDS: 0.044, Tj_max: 150, Rjc: 0.35, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmq60r078rfth', manufacturer: 'MagnaChip', partNumber: 'MMQ60R078RFTH',
    technology: 'Si', package: 'TO-247', description: '600V 0.078Ω Super-Junction MOSFET, fast diode.',
    BV: 600, ID_max: 50, IDM: 150, RDS: 0.078, Tj_max: 150, Rjc: 0.45, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmft60r190qth', manufacturer: 'MagnaChip', partNumber: 'MMFT60R190QTH',
    technology: 'Si', package: 'TO-220FT', description: '600V 0.19Ω Super-Junction MOSFET, legacy.',
    BV: 600, ID_max: 20, IDM: 60, RDS: 0.19, Tj_max: 150, Rjc: 1.2, ...SI_SI(80),
  },
  {
    id: 'magnachip-mmft60r280qth', manufacturer: 'MagnaChip', partNumber: 'MMFT60R280QTH',
    technology: 'Si', package: 'TO-220FT', description: '600V 0.28Ω Super-Junction MOSFET, legacy.',
    BV: 600, ID_max: 13.8, IDM: 41.4, RDS: 0.28, Tj_max: 150, Rjc: 1.8, ...SI_SI(80),
  },
  /* ── MagnaChip MXT low-voltage MOSFETs ── */
  {
    id: 'magnachip-mdf10n055th', manufacturer: 'MagnaChip', partNumber: 'MDF10N055TH',
    technology: 'Si', package: 'TO-220F', description: '100V 5.5mΩ MXT eXtreme Trench MOSFET.',
    BV: 100, ID_max: 80, IDM: 240, RDS: 0.0055, Tj_max: 150, Rjc: 0.6, ...SI_SI(20),
  },
  {
    id: 'magnachip-mdht10n1k1urh', manufacturer: 'MagnaChip', partNumber: 'MDHT10N1K1URH',
    technology: 'Si', package: 'SOT-223', description: '100V 115mΩ MXT eXtreme Trench MOSFET, SOT-223.',
    BV: 100, ID_max: 16, IDM: 48, RDS: 0.115, Tj_max: 150, Rjc: 20, ...SI_SI(20),
  },
  /* ── MagnaChip 500V SJ MOSFET ── */
  {
    id: 'magnachip-mmf50r280pth', manufacturer: 'MagnaChip', partNumber: 'MMF50R280PTH',
    technology: 'Si', package: 'TO-220F', description: '500V 0.28Ω Super-Junction MOSFET.',
    BV: 500, ID_max: 13, IDM: 39, RDS: 0.28, Tj_max: 150, Rjc: 1.8, ...SI_SI(70),
  },

  /* ── Infineon (CoolMOS CFD7 / P7 / C7, OptiMOS) ── */
  {
    id: 'infineon-ipw65r041cfd', manufacturer: 'Infineon', partNumber: 'IPW65R041CFD',
    technology: 'Si', package: 'TO-247', description: '650V 41mΩ CoolMOS CFD2, fast diode.',
    BV: 650, ID_max: 64, IDM: 256, RDS: 0.041, Tj_max: 150, Rjc: 0.35,
    tSC_DS: 5e-6, foster: [{R:0.012,tau:3e-4},{R:0.06,tau:3e-3},{R:0.15,tau:3e-2},{R:0.14,tau:0.4}], ...SI_SI(80),
    datasheetUrl: 'https://www.infineon.com/',
  },
  {
    id: 'infineon-ipw60r040cfd7', manufacturer: 'Infineon', partNumber: 'IPW60R040CFD7',
    technology: 'Si', package: 'TO-247', description: '600V 40mΩ CoolMOS CFD7, fast diode.',
    BV: 600, ID_max: 61, IDM: 244, RDS: 0.04, Tj_max: 150, Rjc: 0.35,
    tSC_DS: 5e-6, foster: [{R:0.01,tau:2e-4},{R:0.05,tau:2e-3},{R:0.13,tau:2e-2},{R:0.14,tau:0.3}], ...SI_SI(80),
  },
  {
    id: 'infineon-ipw65r065cfd', manufacturer: 'Infineon', partNumber: 'IPW65R065CFD',
    technology: 'Si', package: 'TO-247', description: '650V 65mΩ CoolMOS CFD2, fast diode.',
    BV: 650, ID_max: 49, IDM: 196, RDS: 0.065, Tj_max: 150, Rjc: 0.4,
    tSC_DS: 5e-6, foster: [{R:0.02,tau:4e-4},{R:0.08,tau:4e-3},{R:0.14,tau:4e-2},{R:0.15,tau:0.5}], ...SI_SI(80),
  },
  {
    id: 'infineon-ipw65r080cfd', manufacturer: 'Infineon', partNumber: 'IPW65R080CFD',
    technology: 'Si', package: 'TO-247', description: '650V CoolMOS CFD2 power MOSFET for HF SMPS.',
    BV: 650, ID_max: 43.3, IDM: 173, RDS: 0.08, Tj_max: 150, Rjc: 0.45,
    tSC_DS: 5e-6, foster: [{R:0.03,tau:5e-4},{R:0.09,tau:5e-3},{R:0.18,tau:5e-2},{R:0.15,tau:0.5}], ...SI_SI(80),
    datasheetUrl: 'https://www.infineon.com/',
  },
  {
    id: 'infineon-ipp65r110cfd', manufacturer: 'Infineon', partNumber: 'IPP65R110CFD',
    technology: 'Si', package: 'TO-220', description: '650V 110mΩ CoolMOS CFD2, fast diode.',
    BV: 650, ID_max: 35, IDM: 140, RDS: 0.11, Tj_max: 150, Rjc: 0.65,
    tSC_DS: 5e-6, ...SI_SI(80),
  },
  {
    id: 'infineon-ipw60r045cp', manufacturer: 'Infineon', partNumber: 'IPW60R045CP',
    technology: 'Si', package: 'TO-247', description: '600V 45mΩ CoolMOS CP, telecom.',
    BV: 600, ID_max: 58, IDM: 232, RDS: 0.045, Tj_max: 150, Rjc: 0.35, ...SI_SI(80),
  },
  {
    id: 'infineon-ipp60r099cp', manufacturer: 'Infineon', partNumber: 'IPP60R099CP',
    technology: 'Si', package: 'TO-220', description: '600V 99mΩ CoolMOS CP.',
    BV: 600, ID_max: 31, IDM: 124, RDS: 0.099, Tj_max: 150, Rjc: 0.7, ...SI_SI(80),
  },
  {
    id: 'infineon-ipp60r125cp', manufacturer: 'Infineon', partNumber: 'IPP60R125CP',
    technology: 'Si', package: 'TO-220', description: '600V 125mΩ CoolMOS CP.',
    BV: 600, ID_max: 25, IDM: 100, RDS: 0.125, Tj_max: 150, Rjc: 0.85, ...SI_SI(80),
  },
  {
    id: 'infineon-ipp65r190cfd', manufacturer: 'Infineon', partNumber: 'IPP65R190CFD',
    technology: 'Si', package: 'TO-220', description: '650V 190mΩ CoolMOS CFD2, fast diode.',
    BV: 650, ID_max: 18, IDM: 72, RDS: 0.19, Tj_max: 150, Rjc: 1.1, ...SI_SI(80),
  },
  {
    id: 'infineon-ipw60r160p6', manufacturer: 'Infineon', partNumber: 'IPW60R160P6',
    technology: 'Si', package: 'TO-247', description: '600V 160mΩ CoolMOS P6.',
    BV: 600, ID_max: 23, IDM: 92, RDS: 0.16, Tj_max: 150, Rjc: 0.8, ...SI_SI(80),
  },
  {
    id: 'infineon-ipp60r280p6', manufacturer: 'Infineon', partNumber: 'IPP60R280P6',
    technology: 'Si', package: 'TO-220', description: '600V 280mΩ CoolMOS P6.',
    BV: 600, ID_max: 15, IDM: 60, RDS: 0.28, Tj_max: 150, Rjc: 1.4, ...SI_SI(80),
  },
  {
    id: 'infineon-ipp60r380p6', manufacturer: 'Infineon', partNumber: 'IPP60R380P6',
    technology: 'Si', package: 'TO-220', description: '600V 380mΩ CoolMOS P6.',
    BV: 600, ID_max: 11, IDM: 44, RDS: 0.38, Tj_max: 150, Rjc: 1.8, ...SI_SI(80),
  },
  /* ── Infineon OptiMOS (low voltage) ── */
  {
    id: 'infineon-bsc070n10ns5', manufacturer: 'Infineon', partNumber: 'BSC070N10NS5',
    technology: 'Si', package: 'SuperSO8', description: '100V 7mΩ OptiMOS 5, for synchronous rectification.',
    BV: 100, ID_max: 90, IDM: 360, RDS: 0.007, Tj_max: 150, Rjc: 0.6,
    tSC_DS: 3e-6, ...SI_SI(20),
  },
  {
    id: 'infineon-bsc026n10ns5', manufacturer: 'Infineon', partNumber: 'BSC026N10NS5',
    technology: 'Si', package: 'SuperSO8', description: '100V 2.6mΩ OptiMOS 5.',
    BV: 100, ID_max: 140, IDM: 560, RDS: 0.0026, Tj_max: 150, Rjc: 0.5, ...SI_SI(20),
  },
  {
    id: 'infineon-bsc014n04ls', manufacturer: 'Infineon', partNumber: 'BSC014N04LS',
    technology: 'Si', package: 'SuperSO8', description: '40V 1.4mΩ OptiMOS 5, for high-current POL.',
    BV: 40, ID_max: 200, IDM: 800, RDS: 0.0014, Tj_max: 150, Rjc: 0.35, ...SI_SI(12),
  },
  {
    id: 'infineon-bsc030n03ms', manufacturer: 'Infineon', partNumber: 'BSC030N03MS',
    technology: 'Si', package: 'SuperSO8', description: '30V 3mΩ OptiMOS 5, for OR-ing.',
    BV: 30, ID_max: 160, IDM: 640, RDS: 0.003, Tj_max: 150, Rjc: 0.4, ...SI_SI(10),
  },
  {
    id: 'infineon-ipb180n04s4', manufacturer: 'Infineon', partNumber: 'IPB180N04S4',
    technology: 'Si', package: 'DPAK', description: '40V 1.8mΩ OptiMOS 4, automotive-grade.',
    BV: 40, ID_max: 180, IDM: 720, RDS: 0.0018, Tj_max: 175, Rjc: 0.5, ...SI_SI(12),
  },
  /* ── Infineon CoolGaN ── */
  {
    id: 'infineon-igt60r070d1', manufacturer: 'Infineon', partNumber: 'IGT60R070D1',
    technology: 'GaN', package: 'PG-HDSOP-22', description: '600V 70mΩ CoolGaN enhancement-mode HEMT.',
    BV: 600, ID_max: 24, IDM: 72, RDS: 0.07, Tj_max: 150, Rjc: 0.8,
    V_si_k: 150, m_si: -1.2,
  },
  {
    id: 'infineon-igt60r035d1', manufacturer: 'Infineon', partNumber: 'IGT60R035D1',
    technology: 'GaN', package: 'PG-HDSOP-22', description: '600V 35mΩ CoolGaN enhancement-mode HEMT.',
    BV: 600, ID_max: 40, IDM: 120, RDS: 0.035, Tj_max: 150, Rjc: 0.6,
    V_si_k: 150, m_si: -1.2,
  },

  /* ── Infineon SiC ── */
  {
    id: 'infineon-imbf170r1k0m1', manufacturer: 'Infineon', partNumber: 'IMBF170R1K0M1',
    technology: 'SiC', package: 'SOT-227', description: '1700V 1Ω CoolSiC MOSFET, for auxiliary PSU.',
    BV: 1700, ID_max: 11, IDM: 33, RDS: 1.0, Tj_max: 175, Rjc: 1.2,
    tSC_DS: 3e-6, V_si_k: 200, m_si: -1.4,
  },
  {
    id: 'infineon-imw120r030m1h', manufacturer: 'Infineon', partNumber: 'IMW120R030M1H',
    technology: 'SiC', package: 'TO-247', description: '1200V 30mΩ CoolSiC MOSFET, Easy-DIODE.',
    BV: 1200, ID_max: 100, IDM: 300, RDS: 0.03, Tj_max: 175, Rjc: 0.29,
    tSC_DS: 3e-6, V_si_k: 200, m_si: -1.4,
  },
  {
    id: 'infineon-imw120r060m1h', manufacturer: 'Infineon', partNumber: 'IMW120R060M1H',
    technology: 'SiC', package: 'TO-247', description: '1200V 60mΩ CoolSiC MOSFET.',
    BV: 1200, ID_max: 60, IDM: 180, RDS: 0.06, Tj_max: 175, Rjc: 0.36,
    tSC_DS: 3e-6, V_si_k: 200, m_si: -1.4,
  },
  {
    id: 'infineon-imw120r090m1h', manufacturer: 'Infineon', partNumber: 'IMW120R090M1H',
    technology: 'SiC', package: 'TO-247', description: '1200V 90mΩ CoolSiC MOSFET.',
    BV: 1200, ID_max: 39, IDM: 117, RDS: 0.09, Tj_max: 175, Rjc: 0.44,
    tSC_DS: 3e-6, V_si_k: 200, m_si: -1.4,
  },

  /* ── STMicroelectronics (MDmesh M5 / M6 / M2, STripFET) ── */
  {
    id: 'st-stw88n65m5', manufacturer: 'STMicroelectronics', partNumber: 'STW88N65M5',
    technology: 'Si', package: 'TO-247', description: '650V MDmesh M5, 29mΩ, for high-power converters.',
    BV: 650, ID_max: 82, IDM: 320, RDS: 0.029, Tj_max: 150, Rjc: 0.35,
    tSC_DS: 5e-6, foster: [{R:0.01,tau:2e-4},{R:0.04,tau:2e-3},{R:0.12,tau:2e-2},{R:0.12,tau:0.3}], ...SI_SI(80),
  },
  {
    id: 'st-stw56n65m5', manufacturer: 'STMicroelectronics', partNumber: 'STW56N65M5',
    technology: 'Si', package: 'TO-247', description: '650V MDmesh M5, 49mΩ.',
    BV: 650, ID_max: 56, IDM: 224, RDS: 0.049, Tj_max: 150, Rjc: 0.4,
    tSC_DS: 5e-6, ...SI_SI(80),
  },
  {
    id: 'st-stw40n65m5', manufacturer: 'STMicroelectronics', partNumber: 'STW40N65M5',
    technology: 'Si', package: 'TO-247', description: '650V MDmesh M5, 69mΩ.',
    BV: 650, ID_max: 40, IDM: 160, RDS: 0.069, Tj_max: 150, Rjc: 0.45, ...SI_SI(80),
  },
  {
    id: 'st-stw34n65m5', manufacturer: 'STMicroelectronics', partNumber: 'STW34N65M5',
    technology: 'Si', package: 'TO-247', description: '650V MDmesh M5, 99mΩ.',
    BV: 650, ID_max: 34, IDM: 136, RDS: 0.099, Tj_max: 150, Rjc: 0.5, ...SI_SI(80),
  },
  {
    id: 'st-stw70n60m2', manufacturer: 'STMicroelectronics', partNumber: 'STW70N60M2',
    technology: 'Si', package: 'TO-247', description: '600V MDmesh M2, 38mΩ.',
    BV: 600, ID_max: 66, IDM: 260, RDS: 0.038, Tj_max: 150, Rjc: 0.4, ...SI_SI(70),
  },
  {
    id: 'st-stw48n60m2', manufacturer: 'STMicroelectronics', partNumber: 'STW48N60M2',
    technology: 'Si', package: 'TO-247', description: '600V MDmesh M2, 66mΩ.',
    BV: 600, ID_max: 46, IDM: 184, RDS: 0.066, Tj_max: 150, Rjc: 0.45, ...SI_SI(70),
  },
  {
    id: 'st-stw24n60m2', manufacturer: 'STMicroelectronics', partNumber: 'STW24N60M2',
    technology: 'Si', package: 'TO-247', description: '600V MDmesh M2, 160mΩ.',
    BV: 600, ID_max: 24, IDM: 96, RDS: 0.16, Tj_max: 150, Rjc: 0.6, ...SI_SI(70),
  },
  {
    id: 'st-stw45nm50', manufacturer: 'STMicroelectronics', partNumber: 'STW45NM50',
    technology: 'Si', package: 'TO-247', description: '500V MDmesh power MOSFET.',
    BV: 500, ID_max: 45, IDM: 180, RDS: 0.06, Tj_max: 150, Rjc: 0.5,
    tSC_DS: 5e-6, ...SI_SI(70),
  },
  {
    id: 'st-stb18nm60', manufacturer: 'STMicroelectronics', partNumber: 'STB18NM60',
    technology: 'Si', package: 'DPAK', description: '600V MDmesh, 250mΩ, for SMPS.',
    BV: 600, ID_max: 16, IDM: 64, RDS: 0.25, Tj_max: 150, Rjc: 1.5, ...SI_SI(70),
  },
  {
    id: 'st-stp10nk60', manufacturer: 'STMicroelectronics', partNumber: 'STP10NK60',
    technology: 'Si', package: 'TO-220', description: '600V SuperMESH, 750mΩ, for flyback.',
    BV: 600, ID_max: 10, IDM: 40, RDS: 0.75, Tj_max: 150, Rjc: 1.8, ...SI_SI(70),
  },
  /* ── ST STripFET (low voltage) ── */
  {
    id: 'st-stl80n10f7', manufacturer: 'STMicroelectronics', partNumber: 'STL80N10F7',
    technology: 'Si', package: 'PowerFLAT', description: '100V STripFET F7, 5.7mΩ, for DC-DC.',
    BV: 100, ID_max: 80, IDM: 320, RDS: 0.0057, Tj_max: 150, Rjc: 0.55, ...SI_SI(20),
  },
  {
    id: 'st-stp220n6f7', manufacturer: 'STMicroelectronics', partNumber: 'STP220N6F7',
    technology: 'Si', package: 'TO-220', description: '60V STripFET F7, 3.2mΩ, for motor drive.',
    BV: 60, ID_max: 220, IDM: 880, RDS: 0.0032, Tj_max: 150, Rjc: 0.45, ...SI_SI(15),
  },
  {
    id: 'st-sth270n8f7', manufacturer: 'STMicroelectronics', partNumber: 'STH270N8F7',
    technology: 'Si', package: 'H2PAK', description: '80V STripFET F7, 2.2mΩ, for electric vehicles.',
    BV: 80, ID_max: 270, IDM: 1080, RDS: 0.0022, Tj_max: 150, Rjc: 0.4, ...SI_SI(18),
  },

  /* ── Wolfspeed SiC (C3M / C2M) ── */
  {
    id: 'wolfspeed-c3m0015065k', manufacturer: 'Wolfspeed', partNumber: 'C3M0015065K',
    technology: 'SiC', package: 'TO-247-4', description: '650V 15mΩ SiC MOSFET, 3rd gen, best-in-class RDS.',
    BV: 650, ID_max: 120, IDM: 360, RDS: 0.015, Tj_max: 175, Rjc: 0.23,
    tSC_DS: 3e-6, foster: [{R:0.01,tau:5e-4},{R:0.06,tau:5e-3},{R:0.14,tau:5e-2},{R:0.12,tau:0.8}], V_si_k: 100, m_si: -1.3,
  },
  {
    id: 'wolfspeed-c3m0025065k', manufacturer: 'Wolfspeed', partNumber: 'C3M0025065K',
    technology: 'SiC', package: 'TO-247-4', description: '650V 25mΩ SiC MOSFET, 3rd gen.',
    BV: 650, ID_max: 80, IDM: 240, RDS: 0.025, Tj_max: 175, Rjc: 0.3,
    tSC_DS: 3e-6, V_si_k: 100, m_si: -1.3,
  },
  {
    id: 'wolfspeed-c3m0060065k', manufacturer: 'Wolfspeed', partNumber: 'C3M0060065K',
    technology: 'SiC', package: 'TO-247-4', description: '650V 60mΩ SiC MOSFET, 3rd gen.',
    BV: 650, ID_max: 37, IDM: 110, RDS: 0.06, Tj_max: 175, Rjc: 0.6,
    tSC_DS: 3e-6, foster: [{R:0.04,tau:1e-3},{R:0.12,tau:1e-2},{R:0.24,tau:0.1},{R:0.20,tau:1.0}], V_si_k: 100, m_si: -1.4,
  },
  {
    id: 'wolfspeed-c3m0030090k', manufacturer: 'Wolfspeed', partNumber: 'C3M0030090K',
    technology: 'SiC', package: 'TO-247-4', description: '900V 30mΩ SiC MOSFET, 3rd gen.',
    BV: 900, ID_max: 94, IDM: 282, RDS: 0.03, Tj_max: 175, Rjc: 0.3,
    tSC_DS: 3e-6, V_si_k: 150, m_si: -1.4,
  },
  {
    id: 'wolfspeed-c3m0075120k', manufacturer: 'Wolfspeed', partNumber: 'C3M0075120K',
    technology: 'SiC', package: 'TO-247-4', description: '1200V 75mΩ SiC MOSFET, 3rd gen.',
    BV: 1200, ID_max: 50, IDM: 150, RDS: 0.075, Tj_max: 175, Rjc: 0.38,
    tSC_DS: 3e-6, V_si_k: 200, m_si: -1.4,
  },
  {
    id: 'wolfspeed-c3m0120090j', manufacturer: 'Wolfspeed', partNumber: 'C3M0120090J',
    technology: 'SiC', package: 'TO-263-7', description: '900V 120mΩ SiC MOSFET, 3rd gen, surface-mount.',
    BV: 900, ID_max: 35, IDM: 105, RDS: 0.12, Tj_max: 175, Rjc: 0.8,
    tSC_DS: 3e-6, V_si_k: 150, m_si: -1.5,
  },
  {
    id: 'wolfspeed-c2m0025120d', manufacturer: 'Wolfspeed', partNumber: 'C2M0025120D',
    technology: 'SiC', package: 'TO-247', description: '1200V 25mΩ SiC MOSFET, 2nd gen.',
    BV: 1200, ID_max: 108, IDM: 324, RDS: 0.025, Tj_max: 150, Rjc: 0.21,
    tSC_DS: 3e-6, V_si_k: 200, m_si: -1.4,
  },
  {
    id: 'wolfspeed-c2m0080120d', manufacturer: 'Wolfspeed', partNumber: 'C2M0080120D',
    technology: 'SiC', package: 'TO-247', description: '1200V 80mΩ SiC MOSFET, 2nd gen.',
    BV: 1200, ID_max: 36, IDM: 108, RDS: 0.08, Tj_max: 150, Rjc: 0.56,
    tSC_DS: 3e-6, V_si_k: 200, m_si: -1.4,
  },

  /* ── ROHM SiC ── */
  {
    id: 'rohm-sct3022al', manufacturer: 'ROHM', partNumber: 'SCT3022AL',
    technology: 'SiC', package: 'TO-247', description: '650V 22mΩ SiC trench MOSFET, low RDS.',
    BV: 650, ID_max: 93, IDM: 279, RDS: 0.022, Tj_max: 175, Rjc: 0.26,
    tSC_DS: 2.5e-6, V_si_k: 120, m_si: -1.3,
  },
  {
    id: 'rohm-sct3060al', manufacturer: 'ROHM', partNumber: 'SCT3060AL',
    technology: 'SiC', package: 'TO-247', description: '650V 60mΩ SiC trench MOSFET.',
    BV: 650, ID_max: 39, IDM: 117, RDS: 0.06, Tj_max: 175, Rjc: 0.46,
    tSC_DS: 2.5e-6, V_si_k: 120, m_si: -1.4,
  },
  {
    id: 'rohm-sct3080al', manufacturer: 'ROHM', partNumber: 'SCT3080AL',
    technology: 'SiC', package: 'TO-247', description: '650V 80mΩ SiC trench MOSFET.',
    BV: 650, ID_max: 30, IDM: 90, RDS: 0.08, Tj_max: 175, Rjc: 0.55,
    tSC_DS: 2.5e-6, V_si_k: 120, m_si: -1.5,
  },
  {
    id: 'rohm-sct3040kl', manufacturer: 'ROHM', partNumber: 'SCT3040KL',
    technology: 'SiC', package: 'TO-247', description: '1200V 40mΩ SiC trench MOSFET.',
    BV: 1200, ID_max: 73, IDM: 219, RDS: 0.04, Tj_max: 175, Rjc: 0.3,
    tSC_DS: 2.5e-6, V_si_k: 200, m_si: -1.4,
  },
  {
    id: 'rohm-sct3080kl', manufacturer: 'ROHM', partNumber: 'SCT3080KL',
    technology: 'SiC', package: 'TO-247', description: '1200V 80mΩ SiC trench MOSFET.',
    BV: 1200, ID_max: 38, IDM: 114, RDS: 0.08, Tj_max: 175, Rjc: 0.42,
    tSC_DS: 2.5e-6, V_si_k: 200, m_si: -1.4,
  },
  {
    id: 'rohm-sct3105kl', manufacturer: 'ROHM', partNumber: 'SCT3105KL',
    technology: 'SiC', package: 'TO-247', description: '1200V 105mΩ SiC trench MOSFET.',
    BV: 1200, ID_max: 29, IDM: 87, RDS: 0.105, Tj_max: 175, Rjc: 0.55,
    tSC_DS: 2.5e-6, V_si_k: 200, m_si: -1.5,
  },

  /* ── GaN Systems ── */
  {
    id: 'gan-systems-gs0650112l', manufacturer: 'GaN Systems', partNumber: 'GS-065-011-2-L',
    technology: 'GaN', package: 'GaNPX', description: '650V 11mΩ GaN HEMT, highest power density.',
    BV: 650, ID_max: 80, IDM: 160, RDS: 0.011, Tj_max: 150, Rjc: 0.18,
    V_si_k: 150, m_si: -1.1,
  },
  {
    id: 'gan-systems-gs0650301l', manufacturer: 'GaN Systems', partNumber: 'GS-065-030-1-L',
    technology: 'GaN', package: 'GaNPX', description: '650V 30mΩ GaN HEMT.',
    BV: 650, ID_max: 45, IDM: 90, RDS: 0.03, Tj_max: 150, Rjc: 0.25,
    V_si_k: 150, m_si: -1.2,
  },
  {
    id: 'gan-systems-gs0650601l', manufacturer: 'GaN Systems', partNumber: 'GS-065-060-1-L',
    technology: 'GaN', package: 'GaNPX', description: '650V 60mΩ GaN HEMT.',
    BV: 650, ID_max: 25, IDM: 50, RDS: 0.06, Tj_max: 150, Rjc: 0.35,
    V_si_k: 150, m_si: -1.2,
  },
  {
    id: 'gan-systems-gs065650wsa', manufacturer: 'GaN Systems', partNumber: 'GS-065-650-1-W',
    technology: 'GaN', package: 'GaNPX', description: '650V enhancement-mode GaN HEMT, low RDS.',
    BV: 650, ID_max: 30, IDM: 60, RDS: 0.05, Tj_max: 150, Rjc: 0.3,
    V_si_k: 150, m_si: -1.2,
  },
  /* ── Navitas GaNFast ── */
  {
    id: 'navitas-nv6127', manufacturer: 'Navitas', partNumber: 'NV6127',
    technology: 'GaN', package: 'QFN-8', description: '650V 70mΩ GaNFast power IC, integrated drive.',
    BV: 650, ID_max: 20, IDM: 60, RDS: 0.07, Tj_max: 150, Rjc: 0.55,
    V_si_k: 150, m_si: -1.2,
  },
  {
    id: 'navitas-nv6125', manufacturer: 'Navitas', partNumber: 'NV6125',
    technology: 'GaN', package: 'QFN-8', description: '650V 125mΩ GaNFast power IC.',
    BV: 650, ID_max: 13, IDM: 39, RDS: 0.125, Tj_max: 150, Rjc: 0.8,
    V_si_k: 150, m_si: -1.2,
  },
  {
    id: 'navitas-nv6117', manufacturer: 'Navitas', partNumber: 'NV6117',
    technology: 'GaN', package: 'QFN-8', description: '650V 170mΩ GaNFast power IC.',
    BV: 650, ID_max: 10, IDM: 30, RDS: 0.17, Tj_max: 150, Rjc: 1.0,
    V_si_k: 150, m_si: -1.2,
  },

  /* ── Texas Instruments NexFET ── */
  {
    id: 'ti-csd19536kcs', manufacturer: 'Texas Instruments', partNumber: 'CSD19536KCS',
    technology: 'Si', package: 'TO-220', description: '100V 2.4mΩ NexFET, for motor drive & hot-swap.',
    BV: 100, ID_max: 150, IDM: 600, RDS: 0.0024, Tj_max: 150, Rjc: 0.4,
    tSC_DS: 5e-6, ...SI_SI(20),
  },
  {
    id: 'ti-csd19531kcs', manufacturer: 'Texas Instruments', partNumber: 'CSD19531KCS',
    technology: 'Si', package: 'TO-220', description: '100V NexFET power MOSFET, low RDS for hot-swap.',
    BV: 100, ID_max: 100, IDM: 400, RDS: 0.005, Tj_max: 150, Rjc: 0.4,
    tSC_DS: 5e-6, ...SI_SI(20),
  },
  {
    id: 'ti-csd19533kcs', manufacturer: 'Texas Instruments', partNumber: 'CSD19533KCS',
    technology: 'Si', package: 'TO-220', description: '100V 5.6mΩ NexFET, for e-fuse and OR-ing.',
    BV: 100, ID_max: 80, IDM: 320, RDS: 0.0056, Tj_max: 150, Rjc: 0.55,
    tSC_DS: 5e-6, ...SI_SI(20),
  },
  {
    id: 'ti-csd19501kcs', manufacturer: 'Texas Instruments', partNumber: 'CSD19501KCS',
    technology: 'Si', package: 'TO-220', description: '100V 12.5mΩ NexFET, general-purpose.',
    BV: 100, ID_max: 50, IDM: 200, RDS: 0.0125, Tj_max: 150, Rjc: 0.7, ...SI_SI(20),
  },
  {
    id: 'ti-csd18533q5a', manufacturer: 'Texas Instruments', partNumber: 'CSD18533Q5A',
    technology: 'Si', package: 'VSON-Clip', description: '60V 4.6mΩ NexFET, small-footprint DC-DC.',
    BV: 60, ID_max: 60, IDM: 240, RDS: 0.0046, Tj_max: 150, Rjc: 0.9, ...SI_SI(15),
  },
  {
    id: 'ti-csd18540q5b', manufacturer: 'Texas Instruments', partNumber: 'CSD18540Q5B',
    technology: 'Si', package: 'VSON-Clip', description: '60V 1.9mΩ NexFET, high-efficiency buck.',
    BV: 60, ID_max: 100, IDM: 400, RDS: 0.0019, Tj_max: 150, Rjc: 0.5, ...SI_SI(15),
  },
  {
    id: 'ti-csd17573q5b', manufacturer: 'Texas Instruments', partNumber: 'CSD17573Q5B',
    technology: 'Si', package: 'VSON-Clip', description: '30V 1.9mΩ NexFET, for load switch.',
    BV: 30, ID_max: 100, IDM: 400, RDS: 0.0019, Tj_max: 150, Rjc: 0.5, ...SI_SI(10),
  },

  /* ── ON Semiconductor / onsemi ── */
  {
    id: 'onsemi-ntmfs5c670nl', manufacturer: 'onsemi', partNumber: 'NTMFS5C670NL',
    technology: 'Si', package: 'SO-8FL', description: '60V 1.3mΩ N-channel Power MOSFET, for DC-DC.',
    BV: 60, ID_max: 148, IDM: 592, RDS: 0.0013, Tj_max: 150, Rjc: 0.4, ...SI_SI(15),
  },
  {
    id: 'onsemi-nvmfs6h842n', manufacturer: 'onsemi', partNumber: 'NVMFS6H842N',
    technology: 'Si', package: 'SO-8FL', description: '60V 3.3mΩ automotive Power MOSFET.',
    BV: 60, ID_max: 90, IDM: 360, RDS: 0.0033, Tj_max: 175, Rjc: 0.65, ...SI_SI(15),
  },
  {
    id: 'onsemi-nthl100n65s3hf', manufacturer: 'onsemi', partNumber: 'NTHL100N65S3HF',
    technology: 'Si', package: 'TO-247', description: '650V 30mΩ SuperFET3, for high-efficiency SMPS.',
    BV: 650, ID_max: 100, IDM: 400, RDS: 0.03, Tj_max: 150, Rjc: 0.25,
    tSC_DS: 5e-6, ...SI_SI(80),
  },
  {
    id: 'onsemi-fch023n65s3', manufacturer: 'onsemi', partNumber: 'FCH023N65S3',
    technology: 'Si', package: 'TO-247', description: '650V 23mΩ SuperFET3, lowest RDS.',
    BV: 650, ID_max: 120, IDM: 480, RDS: 0.023, Tj_max: 150, Rjc: 0.2,
    tSC_DS: 5e-6, ...SI_SI(80),
  },

  /* ── Toshiba (DTMOSIV) ── */
  {
    id: 'toshiba-tkh16e65f', manufacturer: 'Toshiba', partNumber: 'TKH16E65F',
    technology: 'Si', package: 'TO-247', description: '650V 85mΩ DTMOSIV, fast diode.',
    BV: 650, ID_max: 32, IDM: 96, RDS: 0.085, Tj_max: 175, Rjc: 0.45, ...SI_SI(80),
  },
  {
    id: 'toshiba-tkh8e65f', manufacturer: 'Toshiba', partNumber: 'TKH8E65F',
    technology: 'Si', package: 'TO-247', description: '650V 300mΩ DTMOSIV, for LLC.',
    BV: 650, ID_max: 12, IDM: 36, RDS: 0.3, Tj_max: 175, Rjc: 1.0, ...SI_SI(80),
  },
  {
    id: 'toshiba-tph4r00anl', manufacturer: 'Toshiba', partNumber: 'TPH4R00ANL',
    technology: 'Si', package: 'SOP-Adv', description: '100V 3.9mΩ U-MOSIX-H, high-efficiency DC-DC.',
    BV: 100, ID_max: 65, IDM: 260, RDS: 0.0039, Tj_max: 175, Rjc: 0.8, ...SI_SI(20),
  },
  {
    id: 'toshiba-tph2r00anl', manufacturer: 'Toshiba', partNumber: 'TPH2R00ANL',
    technology: 'Si', package: 'SOP-Adv', description: '100V 1.8mΩ U-MOSIX-H, best-in-class.',
    BV: 100, ID_max: 120, IDM: 480, RDS: 0.0018, Tj_max: 175, Rjc: 0.5, ...SI_SI(20),
  },
];

/* ---- In-memory adapter (default) ----
 * Persists to localStorage so user-added devices survive a reload. */
const STORAGE_KEY = 'soa-calc:device-db:v1';

class InMemoryAdapter implements DeviceDatabaseAdapter {
  private records: DeviceRecord[] = [];
  private loaded = false;

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        let stored: DeviceRecord[];
        try {
          stored = JSON.parse(raw) as DeviceRecord[];
          if (!Array.isArray(stored)) throw new Error('not an array');
        } catch {
          // Corrupted storage; wipe and fall through to seed
          localStorage.removeItem(STORAGE_KEY);
          stored = [];
        }
        // Merge: stored overrides seed by id
        const map = new Map<string, DeviceRecord>();
        SEED.forEach((r) => map.set(r.id, r));
        stored.forEach((r) => {
          if (r && typeof r.id === 'string' && typeof r.BV === 'number') {
            map.set(r.id, r);
          }
        });
        this.records = Array.from(map.values());
      } else {
        this.records = [...SEED];
        this.persist();
      }
    } catch {
      this.records = [...SEED];
    }
  }

  private persist() {
    try {
      // Persist only user-edited records (those not in the seed)
      const seedIds = new Set(SEED.map((r) => r.id));
      const userOnly = this.records.filter((r) => !seedIds.has(r.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
    } catch {
      /* quota / private mode - ignore */
    }
  }

  async list(): Promise<DeviceRecord[]> {
    await this.ensureLoaded();
    return [...this.records].sort((a, b) => {
      // MagnaChip always first
      if (a.manufacturer === 'MagnaChip' && b.manufacturer !== 'MagnaChip') return -1;
      if (b.manufacturer === 'MagnaChip' && a.manufacturer !== 'MagnaChip') return 1;
      return a.manufacturer === b.manufacturer
        ? a.partNumber.localeCompare(b.partNumber)
        : a.manufacturer.localeCompare(b.manufacturer);
    });
  }

  async search(query: string): Promise<DeviceRecord[]> {
    await this.ensureLoaded();
    const q = query.trim().toLowerCase();
    if (!q) return this.list();
    return this.records.filter(
      (r) =>
        r.partNumber.toLowerCase().includes(q) ||
        r.manufacturer.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        r.technology.toLowerCase().includes(q),
    );
  }

  async get(id: string): Promise<DeviceRecord | null> {
    await this.ensureLoaded();
    return this.records.find((r) => r.id === id) ?? null;
  }

  async upsert(record: DeviceRecord): Promise<DeviceRecord> {
    await this.ensureLoaded();
    const idx = this.records.findIndex((r) => r.id === record.id);
    if (idx >= 0) this.records[idx] = record;
    else this.records.push(record);
    this.persist();
    return record;
  }

  async remove(id: string): Promise<void> {
    await this.ensureLoaded();
    this.records = this.records.filter((r) => r.id !== id);
    this.persist();
  }
}

let _adapter = new InMemoryAdapter();

export function getDeviceDatabase(): DeviceDatabaseAdapter {
  return _adapter;
}

export const SEED_DEVICES = SEED;
