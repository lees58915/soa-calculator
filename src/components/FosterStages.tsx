import { memo, useMemo } from 'react';
import { fnum, parseNum } from '../engine/soaEngine';

interface FosterStagesProps {
  stages: Array<{ R: string; tau: string }>;
  onChange: (stages: Array<{ R: string; tau: string }>) => void;
}

const FosterStagesInner = ({ stages, onChange }: FosterStagesProps) => {
  const sum = useMemo(() => {
    let total = 0;
    let ok = true;
    for (const s of stages) {
      try {
        total += parseNum(s.R);
      } catch {
        ok = false;
      }
    }
    return ok ? total : null;
  }, [stages]);

  const update = (idx: number, field: 'R' | 'tau', value: string) => {
    const next = stages.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
    onChange(next);
  };
  const remove = (idx: number) => {
    if (stages.length <= 1) return;
    onChange(stages.filter((_, i) => i !== idx));
  };
  const add = () => {
    onChange([...stages, { R: '0.05', tau: '0.01' }]);
  };

  return (
    <div className="foster">
      <div className="foster-head">
        <span className="fh1">#</span>
        <span className="fh2">Ri (°C/W)</span>
        <span className="fh2">τi (s)</span>
        <span style={{ width: 24 }} />
      </div>
      {stages.map((s, i) => (
        <div className="foster-row" key={i}>
          <span className="fr-lab">R{i + 1}</span>
          <input
            className="pin"
            type="text"
            value={s.R}
            spellCheck={false}
            inputMode="decimal"
            onChange={(e) => update(i, 'R', e.target.value)}
          />
          <input
            className="pin"
            type="text"
            value={s.tau}
            spellCheck={false}
            inputMode="decimal"
            onChange={(e) => update(i, 'tau', e.target.value)}
          />
          <button
            className="fr-x"
            type="button"
            title="remove stage"
            onClick={() => remove(i)}
            disabled={stages.length <= 1}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="mini-btn" onClick={add}>+ add stage</button>
      <div className="foster-sum">
        ΣRᵢ = {sum === null ? <b>?</b> : <b>{fnum(sum, 3)} °C/W</b>} (= RθJC, DC)
      </div>
    </div>
  );
};

export const FosterStages = memo(FosterStagesInner);
FosterStagesInner.displayName = 'FosterStages';
