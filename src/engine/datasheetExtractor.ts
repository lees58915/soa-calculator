import type { DeviceRecord } from './deviceDatabase';
import { fnum, parseNum } from './soaEngine';

type FieldConfidence = 'high' | 'medium' | 'low';

interface ExtractedField<T> {
  value: T;
  confidence: FieldConfidence;
  raw?: string;
}

type ExtractedDevice = {
  [K in keyof Pick<
    DeviceRecord,
    'BV' | 'ID_max' | 'IDM' | 'RDS' | 'Tj_max' | 'Rjc' | 'tSC_DS' | 'V_si_k' | 'm_si' | 'partNumber' | 'manufacturer' | 'package'
  >]?: ExtractedField<DeviceRecord[K]>;
};

export interface ExtractionResult {
  fields: ExtractedDevice;
  /** The full text that was extracted (truncated). */
  text: string;
  /** Number of pages processed. */
  pages: number;
  /** Extractors that hit but with low confidence - surfaced to the user. */
  warnings: string[];
}

const UNIT = {
  voltage: '(?:V|volts?)',
  current: '(?:A|amps?|mA)',
  resistance: '(?:[mMuUnNpP]?[\\u00A0 ]*?[\\u03A9Ω]|[mMuUnNpP]?[\\u00A0 ]*?(?:ohm|Ohm|OHM|milliohms?))',
  temperature: '(?:\\u00B0?C|degC|\\u00B0)',
  time: '(?:s|sec|seconds?|us|\\u00B5s|ms)',
};

const RX = {
  bv: new RegExp(
    `V\\(?[\\s\\u00A0]*\\(?(?:DS\\)?[\\s\\u00A0]*\\(?(?:S\\)?)?|DSS\\)?|br\\)?|d\\)?)[\\s\\u00A0,]*[>=]?[\\s\\u00A0]*([0-9]+(?:\\.[0-9]+)?)[\\s\\u00A0]*(${UNIT.voltage})`,
    'i',
  ),
  bvMin: new RegExp(
    `(?:min(?:imum)?|BV|DSS)[\\s\\u00A0:]+([0-9]+(?:\\.[0-9]+)?)[\\s\\u00A0]*(${UNIT.voltage})`,
    'i',
  ),
  id: new RegExp(
    `I[\\s\\u00A0]*[\\(\\[\\{]?D[\\s\\u00A0]*[\\)\\]\\}]?(?:[\\s\\u00A0,]*at[\\s\\u00A0][^\\n]{0,40})?[\\s\\u00A0:=]+([0-9]+(?:\\.[0-9]+)?)[\\s\\u00A0]*(${UNIT.current})`,
    'i',
  ),
  idM: new RegExp(
    `I[\\s\\u00A0]*[\\(\\[\\{]?DM[\\s\\u00A0]*[\\)\\]\\}]?[\\s\\u00A0:=]+([0-9]+(?:\\.[0-9]+)?)[\\s\\u00A0]*(${UNIT.current})`,
    'i',
  ),
  rds: new RegExp(
    `R[\\s\\u00A0]*DS[\\s\\u00A0]*\\(?(?:on\\)?)?[\\s\\u00A0:=]+([0-9]+(?:\\.[0-9]+)?)[\\s\\u00A0]*(${UNIT.resistance})`,
    'i',
  ),
  tj: new RegExp(
    `(?:T[\\s\\u00A0]*J[\\s\\u00A0,]*[mM]?ax|T[\\s\\u00A0]*J[\\s\\u00A0,]*max)[\\s\\u00A0:=]+([0-9]+(?:\\.[0-9]+)?)[\\s\\u00A0]*(${UNIT.temperature})`,
    'i',
  ),
  rthJC: new RegExp(
    `R[\\s\\u00A0]*(?:th|TH|[\\u03B8\\u0398])?[\\s\\u00A0]*JC[\\s\\u00A0:=]+([0-9]+(?:\\.[0-9]+)?)[\\s\\u00A0]*(${UNIT.temperature}\\/W|\\u00B0[\\s\\u00A0]*C[\\s\\u00A0]*\\/W|degC\\/W)`,
    'i',
  ),
  scTime: new RegExp(
    `(?:t[\\s\\u00A0]*SC|short[\\s\\u00A0-]*circuit[\\s\\u00A0-]*withstand)[\\s\\u00A0:=]+([0-9]+(?:\\.[0-9]+)?)[\\s\\u00A0]*(${UNIT.time})`,
    'i',
  ),
  package: /(?:Package|Package Type|Case)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\s]{1,30}?)(?:\s{2,}|\n|$)/i,
  partNumber: /(?:Part(?:\s+Number)?|Device(?:\s+Number)?|Part\s+No\.?|Type)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{2,30})/i,
  partNumberUnlabeled: /^[ \t]*([A-Z0-9][A-Z0-9\-]{3,30})\s*$/m,
  manufacturer: /(?:Manufacturer|Vendor|Brand)\s*[:\-]?\s*([A-Z][A-Za-z0-9 ]{1,30}?)(?:\s{2,}|\n|$)/,
};

function parseResistance(token: string, unit: string): number {
  // token is e.g. "80", "0.080", "80m"
  let mult = 1;
  const lower = unit.toLowerCase().replace('ω', 'ohm').replace('μ', 'u');
  if (lower.includes('m') && (lower.includes('ohm') || lower.includes('ω'))) mult = 1e-3;
  else if (lower.includes('k') && (lower.includes('ohm') || lower.includes('ω'))) mult = 1e3;
  // Try numeric suffix on token (80m, 1.5k)
  const m = /^([0-9.]+)\s*([a-zA-Z]+)?$/.exec(token.trim());
  if (m) {
    const base = parseFloat(m[1]);
    const sfx = (m[2] || '').toLowerCase();
    if (sfx === 'm') mult *= 1e-3;
    else if (sfx === 'u' || sfx === 'µ') mult *= 1e-6;
    else if (sfx === 'n') mult *= 1e-9;
    else if (sfx === 'k') mult *= 1e3;
    return base * mult;
  }
  return parseNum(token) * mult;
}

const V_MULT: Record<string, number> = { '': 1, m: 1e-3, k: 1e3 };
function parseVoltage(token: string, unit: string): number {
  const m = /^([0-9.]+)\s*([a-zA-Z]+)?$/.exec(token.trim());
  if (!m) return parseNum(token);
  const base = parseFloat(m[1]);
  const sfx = (m[2] || '').toLowerCase();
  return base * (V_MULT[sfx] ?? 1);
}

const C_MULT: Record<string, number> = { '': 1, m: 1e-3, k: 1e3 };
function parseCurrent(token: string): number {
  const m = /^([0-9.]+)\s*([a-zA-Z]+)?$/.exec(token.trim());
  if (!m) return parseNum(token);
  const base = parseFloat(m[1]);
  const sfx = (m[2] || '').toLowerCase();
  return base * (C_MULT[sfx] ?? 1);
}

function parseTime(token: string, unit: string): number {
  const base = parseFloat(token);
  const u = unit.toLowerCase().replace(/[\s\u00A0]/g, '');
  if (u === 's' || u === 'sec' || u === 'seconds') return base;
  if (u === 'ms') return base * 1e-3;
  if (u === 'us' || u === 'µs' || u === 'μs') return base * 1e-6;
  if (u === 'ns') return base * 1e-9;
  return base;
}

function pickFirst(text: string, rx: RegExp): RegExpExecArray | null {
  return rx.exec(text);
}

function extractFields(text: string): { fields: ExtractedDevice; warnings: string[] } {
  const fields: ExtractedDevice = {};
  const warnings: string[] = [];

  // BVDSS - prefer "VDS = 650V" pattern
  let m = pickFirst(text, RX.bv);
  if (!m) m = pickFirst(text, RX.bvMin);
  if (m) {
    const raw = m[0];
    const v = parseVoltage(m[1], m[2]);
    fields.BV = { value: v, confidence: 'high', raw };
  }

  m = pickFirst(text, RX.id);
  if (m) {
    const raw = m[0];
    const v = parseCurrent(m[1]);
    fields.ID_max = { value: v, confidence: 'high', raw };
  }

  m = pickFirst(text, RX.idM);
  if (m) {
    const raw = m[0];
    const v = parseCurrent(m[1]);
    fields.IDM = { value: v, confidence: 'high', raw };
  }

  m = pickFirst(text, RX.rds);
  if (m) {
    const raw = m[0];
    const v = parseResistance(m[1], m[2]);
    fields.RDS = { value: v, confidence: 'high', raw };
  }

  m = pickFirst(text, RX.tj);
  if (m) {
    const raw = m[0];
    const v = parseFloat(m[1]);
    fields.Tj_max = { value: v, confidence: 'high', raw };
  }

  m = pickFirst(text, RX.rthJC);
  if (m) {
    const raw = m[0];
    const v = parseFloat(m[1]);
    fields.Rjc = { value: v, confidence: 'high', raw };
  }

  m = pickFirst(text, RX.scTime);
  if (m) {
    const raw = m[0];
    const v = parseTime(m[1], m[2]);
    fields.tSC_DS = { value: v, confidence: 'medium', raw };
  }

  m = pickFirst(text, RX.partNumber);
  if (!m) m = pickFirst(text, RX.partNumberUnlabeled);
  if (m) fields.partNumber = { value: m[1].trim(), confidence: 'medium', raw: m[0] };

  m = pickFirst(text, RX.manufacturer);
  if (m) fields.manufacturer = { value: m[1].trim(), confidence: 'medium', raw: m[0] };

  m = pickFirst(text, RX.package);
  if (m) fields.package = { value: m[1].trim(), confidence: 'low', raw: m[0] };

  // Thermal-instability defaults: only fill if we can be confident (V/knee ~10-20% of BV)
  if (fields.BV) {
    const bv = fields.BV.value;
    // common heuristic: knee ~ 0.15 * BV
    fields.V_si_k = { value: bv * 0.15, confidence: 'low' };
  }

  if (Object.keys(fields).length === 0) {
    warnings.push('No SOA-relevant parameters were detected. Make sure the text contains the absolute-maximum table.');
  }
  if (!fields.BV) warnings.push('BVDSS not found - check that the text contains a line like "VDS = 650V".');
  if (!fields.RDS) warnings.push('RDS(on) not found - check the static-drain-source on-resistance line.');
  if (!fields.Tj_max) warnings.push('Tj_max not found - look for "TJ max = 150C".');

  return { fields, warnings };
}

export function extractFromText(text: string, maxLen = 200_000): ExtractionResult {
  const trimmed = text.length > maxLen ? text.slice(0, maxLen) : text;
  const { fields, warnings } = extractFields(trimmed);
  return { fields, text: trimmed, pages: 0, warnings };
}

export async function extractFromPdf(file: File): Promise<ExtractionResult> {
  // Dynamic import keeps the worker only loaded when actually used.
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  // Vite-specific worker wiring
  const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  let text = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    text += tc.items.map((it: any) => 'str' in it ? it.str : '').join(' ') + '\n';
  }
  const { fields, warnings } = extractFields(text);
  return { fields, text, pages: doc.numPages, warnings };
}

/** Pretty-print the extraction result for the review UI. */
export function summarizeExtraction(res: ExtractionResult): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(res.fields)) {
    if (v == null) continue;
    const value = v.value;
    const display = typeof value === 'number' ? fnum(value, 3) : String(value);
    lines.push(`${k} = ${display}  [${v.confidence}]`);
  }
  if (res.warnings.length) {
    lines.push('', 'Warnings:');
    res.warnings.forEach((w) => lines.push('  - ' + w));
  }
  return lines.join('\n');
}
