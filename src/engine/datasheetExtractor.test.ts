import { describe, it, expect } from 'vitest';
import { extractFromText, summarizeExtraction } from './datasheetExtractor';

describe('datasheetExtractor.extractFromText', () => {
  it('extracts BV, ID, IDM, RDS, Tj_max, RthJC from a typical datasheet excerpt', () => {
    const text = `
      IPW65R080CFD
      Manufacturer: Infineon
      Package: TO-247
      Maximum Ratings:
      VDS = 650 V
      ID = 43.3 A
      IDM = 173 A
      RDS(on) = 80 mOhm
      TJ max = 150 C
      RthJC = 0.45 C/W
    `;
    const r = extractFromText(text);
    expect(r.fields.BV?.value).toBe(650);
    expect(r.fields.ID_max?.value).toBeCloseTo(43.3);
    expect(r.fields.IDM?.value).toBeCloseTo(173);
    expect(r.fields.RDS?.value).toBeCloseTo(0.080, 2);
    expect(r.fields.Tj_max?.value).toBe(150);
    expect(r.fields.Rjc?.value).toBeCloseTo(0.45);
    expect(r.fields.partNumber?.value).toContain('IPW65R080CFD');
    expect(r.fields.manufacturer?.value?.toLowerCase()).toContain('infineon');
  });
  it('flags a warning when nothing matches', () => {
    const r = extractFromText('lorem ipsum dolor sit amet');
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(Object.keys(r.fields)).toHaveLength(0);
  });
  it('summarizeExtraction is human-readable', () => {
    const r = extractFromText('VDS = 100V\nID = 50A');
    const s = summarizeExtraction(r);
    expect(s).toMatch(/BV\s*=/);
    expect(s).toMatch(/ID_max\s*=/);
  });
  it('handles min suffix', () => {
    const r = extractFromText('V(BR)DSS min: 100 V');
    expect(r.fields.BV?.value).toBe(100);
  });
});
