import { memo } from 'react';
import type { ProtectionResult } from '../engine/soaEngine';

interface ProtectionResultsProps {
  results: ProtectionResult[];
}

const ICONS: Record<string, string> = {
  PASS: '✓',
  WARN: '⚠',
  FAIL: '✗',
};

const ProtectionResultsInner = ({ results }: ProtectionResultsProps) => {
  if (results.length === 0) {
    return <div className="muted center">No protection tests have been run yet.</div>;
  }
  try {
    return (
      <div className="cards">
        {results.map((r) => (
          <div key={r.name} className={'pcard ' + r.state}>
            <div className="tag">
              <span className="tg-ico">{ICONS[r.state]}</span>
              <span>{r.state}</span>
            </div>
            <div className="body">
              <div className="nm">{r.name}</div>
              <div className="ms">{r.msg}</div>
            </div>
          </div>
        ))}
      </div>
    );
  } catch {
    return <div className="muted center">Failed to render protection results.</div>;
  }
};

export const ProtectionResults = memo(ProtectionResultsInner);
ProtectionResultsInner.displayName = 'ProtectionResults';
