import { memo } from 'react';
import { fnum, fmtTime, type LinearResult, type SwitchingResult } from '../engine/soaEngine';

interface SoaResultDetailProps {
  result: SwitchingResult | LinearResult;
}

function Chip({ state, children }: { state: string; children?: React.ReactNode }) {
  return <span className={'chip ' + state}>{children ?? state}</span>;
}

const ROW_HELP: Record<string, string> = {
  VDS: 'Drain-source voltage stress relative to BVDSS rating',
  ID: 'Drain current stress relative to ID(max) / IDM rating',
  Tj: 'Junction temperature rise relative to TJ(max) rating',
  Power: 'Dissipated power vs the SOA power limit at the given pulse/duty',
  Derating: 'Spirito thermal-instability derating — current limit at this VDS',
};

function Row({ label, helpKey, value, state }: { label: React.ReactNode; helpKey: string; value: React.ReactNode; state: string }) {
  return (
    <div className="crow" title={ROW_HELP[helpKey] ?? ''}>
      <span className="c-lab">{label}</span>
      <span className="c-val">{value}</span>
      <Chip state={state} />
    </div>
  );
}

export const SoaResultDetail = memo(function SoaResultDetail({ result }: SoaResultDetailProps) {
  if (result.mode === 'switching') {
    const r = result;
    return (
      <>
        <Row
          label={<>V<sub>DS</sub></>}
          helpKey="VDS"
          state={r.v_state}
          value={
            <>peak {fnum(r.VDS_peak, 0)}V <span className="sub">({fnum(r.v_ratio * 100, 0)}% of BVDSS {fnum(r.BV, 0)}V)</span></>
          }
        />
        <Row
          label={<>I<sub>D</sub></>}
          helpKey="ID"
          state={r.i_state}
          value={
            <>{fnum(r.i_ratio * r.i_lim, 1)}A <span className="sub">({fnum(r.i_ratio * 100, 0)}% of {r.IDM > 0 ? 'IDM' : 'ID(max)'} {fnum(r.i_lim, 0)}A)</span></>
          }
        />
        <Row
          label={<>T<sub>J</sub></>}
          helpKey="Tj"
          state={r.t_state}
          value={
            <>{fnum(r.Tj, 0)}°C <span className="sub">({fnum(r.t_ratio * 100, 0)}% of TJ(max) {fnum(r.Tj_max, 0)}°C)</span></>
          }
        />
        <div className="d-overall">
          <span>OVERALL</span>
          <Chip state={r.overall} />
        </div>
      </>
    );
  }
  const r = result;
  const ta = r.t_allow === Infinity ? '∞ (DC)' : fmtTime(r.t_allow);
  return (
    <>
      <div className="d-op">V<sub>DS</sub>={fnum(r.VDS, 0)}V × I<sub>D</sub>={fnum(r.ID, 1)}A = {fnum(r.Pop, 1)} W</div>
      <Row
        label="Power"
        helpKey="Power"
        state={r.p_state}
        value={
          <>{fnum(r.Pop, 0)}W <span className="sub">vs Pmax({fmtTime(r.t_pulse)}{r.duty > 0 ? `, D=${r.duty}` : ''}) = {fnum(r.pmax, 0)}W</span></>
        }
      />
      <Row
        label={<>V<sub>DS</sub></>}
        helpKey="VDS"
        state={r.v_state}
        value={          <>{fnum(r.VDS, 0)} V <span className="sub">vs BVDSS {fnum(r.BV, 0)}V</span></>}
      />
      <Row
        label={<>I<sub>D</sub></>}
        helpKey="ID"
        state={r.i_state}
        value={
          <>{fnum(r.ID, 1)} A <span className="sub">vs {r.i_lim !== r.ID_max ? 'IDM ' : 'ID(max) '}{fnum(r.i_lim, 0)}A{r.i_lim !== r.ID_max ? ' (pulsed)' : ''}</span></>
        }
      />
      {r.si_state && (
        <Row
          label="Derating"
          helpKey="Derating"
          state={r.si_state}
          value={<>{fnum(r.i_si_limit, 1)} A <span className="sub">instability locus at {fnum(r.VDS, 0)}V</span></>}
        />
      )}
      <div className="d-maxpulse">{(r.duty > 0 ? `Max on-time at D=${r.duty}: ` : 'Max pulse: ') + ta}</div>
      <div className="d-overall">
        <span>OVERALL</span>
        <Chip state={r.overall} />
      </div>
    </>
  );
});
