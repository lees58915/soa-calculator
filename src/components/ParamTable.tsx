import { memo, useState } from 'react';
import { PARAMS, PARAM_DISPLAY, type ParamMeta } from '../engine/paramMeta';
import { parseNum } from '../engine/soaEngine';

export type ParamValues = Record<string, string>;

interface ParamTableProps {
  keys: readonly string[];
  values: ParamValues;
  onChange: (key: string, value: string) => void;
  errors: Set<string>;
  warnings: Set<string>;
}

const UNIT_DISPLAY: Record<string, string> = {
  V: 'V',
  A: 'A',
  Ohm: 'Ω',
  degC: '°C',
  'degC/W': '°C/W',
  s: 's',
  '%': '%',
  '': '',
};

const ParamTableInner = ({ keys, values, onChange, errors, warnings }: ParamTableProps) => {
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const onBlur = (k: string) => {
    setTouched((prev) => { const next = new Set(prev); next.add(k); return next; });
  };

  const clsFor = (k: string): string => {
    const meta: ParamMeta = PARAMS[k];
    const v = values[k] ?? '';
    const isTouched = touched.has(k);
    if (!isTouched || v.trim() === '') return 'pin';
    try {
      const n = parseNum(v);
      if (!Number.isFinite(n)) return 'pin err';
      if (meta.pos && !(n > 0)) return 'pin err';
      if (meta.nonneg && n < 0) return 'pin err';
    } catch { return 'pin err'; }
    if (errors.has(k)) return 'pin err';
    if (warnings.has(k)) return 'pin warn';
    return 'pin';
  };

  return (
    <table className="ptab">
      <thead>
        <tr>
          <th>Parameter</th>
          <th className="c">Value</th>
          <th className="u">Unit</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const meta: ParamMeta = PARAMS[k];
          return (
            <tr key={k}>
              <td>
                <span className="pname" title={meta.help} dangerouslySetInnerHTML={{ __html: PARAM_DISPLAY[k] ?? k }} />
              </td>
              <td className="vcell">
                <input
                  className={clsFor(k)}
                  type="text"
                  value={values[k] ?? ''}
                  spellCheck={false}
                  inputMode="decimal"
                  placeholder={meta.opt ? 'blank = use default' : ''}
                  onChange={(e) => onChange(k, e.target.value)}
                  onBlur={() => onBlur(k)}
                />
              </td>
              <td className="ucell">
                <span className="punit">{UNIT_DISPLAY[meta.unit] ?? meta.unit}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export const ParamTable = memo(ParamTableInner);
ParamTableInner.displayName = 'ParamTable';
