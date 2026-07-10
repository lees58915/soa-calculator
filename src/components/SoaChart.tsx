import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { fnum, fmtTime, soaCurve, type SoaCurvePoint, type LinearResult, type SwitchingResult } from '../engine/soaEngine';

interface SoaChartProps {
  result: SwitchingResult | LinearResult | null;
}

const MARGIN = { t: 24, r: 24, b: 52, l: 72 };
const PULSE = [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0, 10.0];
const LABELS = ['1µs', '10µs', '100µs', '1ms', '10ms', '100ms', '1s', '10s'];

const COLORS = ['#E03131', '#2F9E44', '#1971C2', '#E8590C', '#9C36B5', '#0C8599', '#F08C00', '#2B8A3E'];
const WARN_COLOR = '#EAB308';
const FAIL_COLOR = '#DC2626';
const PASS_COLOR = '#16A34A';
const GRID_COLOR = '#C8CDD6';
const MAJOR_GRID_COLOR = '#9CA3AF';
const AXIS_COLOR = '#6B7280';

function logTickVals(domain: [number, number]): number[] {
  const [mn, mx] = domain;
  const lo = Math.ceil(Math.log10(mn));
  const hi = Math.floor(Math.log10(mx));
  const out: number[] = [];
  for (let k = lo; k <= hi; k++) {
    const p = Math.pow(10, k);
    if (p >= mn && p <= mx) out.push(p);
    if (k < hi) {
      const t2 = 2 * p, t5 = 5 * p;
      if (t2 >= mn && t2 <= mx) out.push(t2);
      if (t5 >= mn && t5 <= mx) out.push(t5);
    }
  }
  return out;
}

function logGridVals(domain: [number, number], decades: number, plotPx: number): number[] {
  const [mn, mx] = domain;
  const out: number[] = [];
  const lo = Math.floor(Math.log10(mn));
  const hi = Math.ceil(Math.log10(mx));
  const targetPx = 14;
  const targetPerDecade = Math.max(2, Math.round(plotPx / targetPx / Math.max(decades, 0.01)));
  let step: number;
  if (targetPerDecade <= 3) step = 0.5;
  else if (targetPerDecade <= 5) step = 0.2;
  else if (targetPerDecade <= 10) step = 0.1;
  else if (targetPerDecade <= 20) step = 0.05;
  else step = 0.02;
  const mults: number[] = [];
  for (let v = step; v < 1; v += step) mults.push(v);
  mults.push(1);
  for (let k = lo; k <= hi; k++) {
    const base = Math.pow(10, k);
    for (const m of mults) {
      const v = base * m;
      if (v >= mn && v <= mx) out.push(v);
    }
  }
  return out;
}

function sciLabel(v: number): string {
  const e = Math.floor(Math.log10(v));
  if (v === Math.pow(10, e)) return `10^${e}`;
  const m = v / Math.pow(10, e);
  return `${m}·10^${e}`;
}

function triPoints(x: number, y: number, s: number): string {
  return `${x},${y - s} ${x + s},${y + s} ${x - s},${y + s}`;
}

function fmtTick(v: number): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1000) return String(Math.round(v));
  if (a >= 1) return Number.isInteger(v) ? String(v) : String(+v.toFixed(2));
  if (a >= 0.001) return String(+v.toFixed(3));
  return v.toExponential(1);
}

export function SoaChart({ result }: SoaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const scalesRef = useRef({ x: null as any, y: null as any });
  const curvesRef = useRef<SoaCurvePoint[] | null>(null);

  const [dim, setDim] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width } = e.contentRect;
        setDim({ w: Math.max(width, 300), h: Math.max(Math.round(width * 0.56), 240) });
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const { w, h } = dim;
  const pw = w - MARGIN.l - MARGIN.r;
  const ph = h - MARGIN.t - MARGIN.b;

  const { curves, activeIdx, switchingData } = useMemo(() => {
    if (!result) return { curves: null, activeIdx: -1, switchingData: null };
    if (result.mode === 'switching') {
      return { curves: null, activeIdx: -1, switchingData: result };
    }
    const r = result;
    const all = soaCurve(r.BV, r.ID_max, r.RDS, r.Tj_max, r.Tc, r.stages, r.si, null, r.duty, r.IDM);
    const tp = r.t_pulse;
    let best = Infinity, active = 0;
    for (let i = 0; i < PULSE.length; i++) {
      const d = Math.abs(Math.log10(PULSE[i]) - Math.log10(Math.max(tp, 1e-9)));
      if (d < best) { best = d; active = i; }
    }
    return { curves: all, activeIdx: active, switchingData: null };
  }, [result]);

  const xScale = useMemo(() => {
    if (!result) return null;
    if (result.mode === 'switching') {
      const s = result;
      const xmax = Math.max(s.BV * 1.2, s.VDS_peak * 1.15);
      return d3.scaleLinear().domain([0, xmax]).range([0, pw]);
    }
    if (!curves) return null;
    let xmn = Infinity, xmx = -Infinity;
    curves.forEach((cv) => cv.points.forEach((p) => {
      if (p[0] > 0) { xmn = Math.min(xmn, p[0]); xmx = Math.max(xmx, p[0]); }
    }));
    if (!Number.isFinite(xmx) || xmx <= 0) xmx = 100;
    const r = result;
    xmn = Math.min(xmn, r.VDS);
    xmx = Math.max(xmx, r.VDS, r.BV);
    const lo = Math.max(1e-3, xmn * 0.8);
    return d3.scaleLog().domain([lo, xmx * 1.2]).range([0, pw]);
  }, [result, curves, pw]);

  const yScale = useMemo(() => {
    if (!result) return null;
    if (result.mode === 'switching') {
      const s = result;
      const ymax = Math.max(s.i_lim * 1.2, (s.i_ratio * s.i_lim) * 1.15);
      return d3.scaleLinear().domain([0, ymax]).range([ph, 0]);
    }
    if (!curves) return null;
    let ymn = Infinity, ymx = -Infinity;
    curves.forEach((cv) => cv.points.forEach((p) => {
      if (p[1] > 0) { ymn = Math.min(ymn, p[1]); ymx = Math.max(ymx, p[1]); }
    }));
    if (!Number.isFinite(ymn)) ymn = 0.1;
    if (!Number.isFinite(ymx) || ymx <= 0) ymx = 10;
    const r = result;
    ymn = Math.min(ymn, r.ID);
    ymx = Math.max(ymx, r.ID, r.ID_max, r.IDM || 0);
    if (!Number.isFinite(ymn)) ymn = 0.1;
    if (!Number.isFinite(ymx) || ymx <= 0) ymx = 10;
    return d3.scaleLog().domain([Math.max(ymn * 0.6, 1e-2), ymx * 2]).range([ph, 0]);
  }, [result, curves, ph]);

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current!);
    const tooltip = d3.select(tooltipRef.current);
    svg.selectAll('*').remove();
    tooltip.style('display', 'none');

    if (!result || !xScale || !yScale) return;

    const isLog = result.mode === 'linear';
    const chartBg = '#FAFBFC';

    const g = svg.append('g').attr('transform', `translate(${MARGIN.l},${MARGIN.t})`);
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');

    // Clip path
    defs.append('clipPath').attr('id', 'plot-clip')
      .append('rect').attr('width', pw).attr('height', ph);

    // Gradient fill for active SOA area
    const overall = result.overall;
    const gradRGB = overall === 'FAIL' ? '220,38,38' : overall === 'WARN' ? '234,179,8' : '30,142,62';
    const grad = defs.append('linearGradient').attr('id', 'soa-fill').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', `rgba(${gradRGB},0.1)`);
    grad.append('stop').attr('offset', '100%').attr('stop-color', `rgba(${gradRGB},0)`);

    // Background
    g.append('rect').attr('width', pw).attr('height', ph).attr('fill', chartBg).attr('rx', 4);

    // Keep refs current for crosshair snap
    scalesRef.current = { x: xScale, y: yScale };
    curvesRef.current = curves;

    // Clipped content — grid + content (bottom) + overlay (top)
    const clipped = g.append('g').attr('clip-path', 'url(#plot-clip)');
    const gridG = clipped.append('g');
    const contentG = clipped.append('g');
    const overlayG = clipped.append('g');

    drawGrid(gridG, xScale, yScale, pw, ph, isLog);

    // Axes
    const xDomain = xScale.domain() as [number, number];
    const yDomain = yScale.domain() as [number, number];
    const xAxisGen = isLog
      ? d3.axisBottom(xScale).tickValues(logTickVals(xDomain)).tickFormat(sciLabel as any)
      : d3.axisBottom(xScale).ticks(6);

    const yAxisGen = isLog
      ? d3.axisLeft(yScale).tickValues(logTickVals(yDomain)).tickFormat(sciLabel as any)
      : d3.axisLeft(yScale).ticks(6);

    const xAxisG = g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${ph})`).call(xAxisGen);
    const yAxisG = g.append('g').attr('class', 'y-axis').call(yAxisGen);

    [xAxisG, yAxisG].forEach((ag) => {
      ag.selectAll('.domain').attr('stroke', '#D0D6DE').attr('stroke-width', 1);
      ag.selectAll('.tick line').attr('stroke', '#D0D6DE').attr('stroke-width', 1);
    });

    styleTickLabels(g);

    // Axis labels
    const xLabel = svg.append('text').attr('x', MARGIN.l + pw / 2).attr('y', h - 8)
      .attr('text-anchor', 'middle').attr('fill', '#000')
      .style('font-family', 'var(--ui)')
      .attr('font-size', '12px').attr('font-weight', '600');
    xLabel.append('tspan').text('V');
    xLabel.append('tspan').attr('dy', '4').attr('font-size', '0.65em').text('DS');
    xLabel.append('tspan').attr('dy', '-4').text(' (V)');

    const yLabel = svg.append('text').attr('x', 14).attr('y', MARGIN.t + ph / 2)
      .attr('text-anchor', 'middle').attr('fill', '#000')
      .style('font-family', 'var(--ui)')
      .attr('font-size', '12px').attr('font-weight', '600')
      .attr('transform', `rotate(-90,14,${MARGIN.t + ph / 2})`);
    yLabel.append('tspan').text('I');
    yLabel.append('tspan').attr('dy', '4').attr('font-size', '0.65em').text('D');
    yLabel.append('tspan').attr('dy', '-4').text(' (A)');

    // Draw mode-specific content into content layer
    if (result.mode === 'switching') {
      drawSwitchingD3(contentG, result, xScale, yScale, pw, ph);
    } else {
      drawLinearD3(contentG, result, curves!, activeIdx, xScale, yScale, pw, ph, 'soa-fill');
    }

    // Crosshair lines (overlay layer)
    const crossX = overlayG.append('line').attr('class', 'crosshair-x')
      .attr('y1', 0).attr('y2', ph)
      .attr('stroke', '#6B7280').attr('stroke-width', 0.8).attr('opacity', 0).style('pointer-events', 'none');
    const crossY = overlayG.append('line').attr('class', 'crosshair-y')
      .attr('x1', 0).attr('x2', pw)
      .attr('stroke', '#6B7280').attr('stroke-width', 0.8).attr('opacity', 0).style('pointer-events', 'none');
    const snapDot = overlayG.append('circle')
      .attr('r', 5).attr('fill', '#fff').attr('stroke', '#0064FF').attr('stroke-width', 2.5)
      .attr('opacity', 0).style('pointer-events', 'none');

    // Overlay rect captures mouse (overlay layer)
    const overlay = overlayG.append('rect')
      .attr('width', pw).attr('height', ph)
      .attr('fill', 'none').style('pointer-events', 'all').style('cursor', 'crosshair');

    // Crosshair interaction
    overlay.on('mousemove', function (event: MouseEvent) {
      const [mx, my] = d3.pointer(event, this);
      const { x: sx, y: sy } = scalesRef.current;
      const vds = sx.invert(mx);
      const idVal = sy.invert(my);
      const rect = svgRef.current!.getBoundingClientRect();
      const isLinear = result.mode === 'linear';

      // Snap to nearest curve point
      const snapped = snapToNearest(curvesRef.current, sx, sy, mx, my, 14);

      let label: string;
      let cx = mx, cy = my;
      if (snapped) {
        cx = snapped.px;
        cy = snapped.py;
        label = `${snapped.label}: ${fmtTick(snapped.vds)}V, ${fmtTick(snapped.id)}A`;
        snapDot.attr('cx', cx).attr('cy', cy).attr('opacity', 1);
      } else {
        snapDot.attr('opacity', 0);
        label = isLinear
          ? `${fmtTick(vds)}V, ${fmtTick(idVal)}A`
          : `${fmtTick(vds)}V, ${fmtTick(idVal)}A`;
      }

      crossX.attr('x1', cx).attr('x2', cx).attr('opacity', 0.5);
      crossY.attr('y1', cy).attr('y2', cy).attr('opacity', 0.5);
      tooltip.style('display', 'block')
        .style('left', `${event.clientX - rect.left + 16}px`)
        .style('top', `${event.clientY - rect.top - 14}px`)
        .text(label);
    }).on('mouseleave', function () {
      crossX.attr('opacity', 0);
      crossY.attr('opacity', 0);
      snapDot.attr('opacity', 0);
      tooltip.style('display', 'none');
    });

    // Setup zoom (only for linear mode)
    if (result.mode === 'linear') {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 40])
        .translateExtent([[-pw * 0.3, -ph * 0.3], [pw * 1.3, ph * 1.3]])
        .on('zoom', (event) => {
          const t = event.transform;
          const newX = d3.scaleLog().domain(xScale.domain()).range(xScale.range().map((r) => t.applyX(r)));
          const newY = d3.scaleLog().domain(yScale.domain()).range(yScale.range().map((r) => t.applyY(r)));

          // Redraw grid with new scales
          drawGrid(gridG, newX, newY, pw, ph, true);

          // Redraw axes with new scales
          xAxisG.call(d3.axisBottom(newX).tickValues(logTickVals(newX.domain() as [number, number])).tickFormat(sciLabel as any));
          yAxisG.call(d3.axisLeft(newY).tickValues(logTickVals(newY.domain() as [number, number])).tickFormat(sciLabel as any));

          [xAxisG, yAxisG].forEach((ag) => {
            ag.selectAll('.domain').attr('stroke', '#D0D6DE').attr('stroke-width', 1);
            ag.selectAll('.tick line').attr('stroke', '#D0D6DE').attr('stroke-width', 1);
          });
          styleTickLabels(g);

          // Redraw curves into content layer (overlay layer stays untouched)
          contentG.selectAll('*').remove();
          drawLinearD3CurvesOnly(contentG, result, curves!, activeIdx, newX, newY, pw, ph, 'soa-fill');
          drawLinearD3Markers(contentG, result, newX, newY);
          scalesRef.current = { x: newX, y: newY };
        });

      svg.call(zoom);
      zoomRef.current = zoom;
    }

  }, [result, curves, activeIdx, xScale, yScale, pw, ph, w, h]);

  useEffect(() => {
    draw();
  }, [draw]);

  const exportSvg = useCallback(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soa-chart-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!result) {
    return (
      <div ref={containerRef} className="chart-wrap">
        <div className="chart-empty">Enter parameters to render the SOA curve.</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="chart-wrap">
      <button className="chart-export" onClick={exportSvg} title="Export SVG" aria-label="Export SVG">
        <svg viewBox="0 0 16 16"><path d="M8 1v9l3-3 1 1-5 5-5-5 1-1 3 3V1h2z"/><path d="M1 13v2h14v-2"/></svg>
        SVG
      </button>
      <svg ref={svgRef} className="soa-svg" width={w} height={h} />
      <div ref={tooltipRef} className="chart-tooltip" />
    </div>
  );
}

/* ---- Switching mode ---- */
function drawSwitchingD3(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  r: SwitchingResult,
  x: any, y: any,
  pw: number, ph: number,
) {
  g.append('rect').attr('x', 0).attr('y', y(r.i_lim))
    .attr('width', x(r.BV)).attr('height', y(0) - y(r.i_lim))
    .attr('fill', 'rgba(22,163,74,.04)');

  g.append('line').attr('x1', x(0.8 * r.BV)).attr('x2', x(0.8 * r.BV))
    .attr('y1', 0).attr('y2', ph)
    .attr('stroke', WARN_COLOR).attr('stroke-dasharray', '4,4').attr('stroke-width', 1.2);

  const idLabel = r.IDM > 0 ? 'IDM' : 'ID(max)';
  g.append('line').attr('x1', 0).attr('x2', pw)
    .attr('y1', y(0.8 * r.i_lim)).attr('y2', y(0.8 * r.i_lim))
    .attr('stroke', WARN_COLOR).attr('stroke-dasharray', '4,4').attr('stroke-width', 1.2);

  g.append('line').attr('x1', x(r.BV)).attr('x2', x(r.BV))
    .attr('y1', 0).attr('y2', ph)
    .attr('stroke', FAIL_COLOR).attr('stroke-dasharray', '6,3').attr('stroke-width', 1.5);
  g.append('line').attr('x1', 0).attr('x2', pw)
    .attr('y1', y(r.i_lim)).attr('y2', y(r.i_lim))
    .attr('stroke', '#6B7280').attr('stroke-dasharray', '6,3').attr('stroke-width', 1.5);

  const sc = (s: string) => s === 'FAIL' ? FAIL_COLOR : s === 'WARN' ? WARN_COLOR : PASS_COLOR;
  const ID_op = r.i_ratio * r.i_lim;

  // Op point circle
  g.append('circle').attr('cx', x(0.01 * r.BV)).attr('cy', y(ID_op)).attr('r', 7)
    .attr('fill', '#fff').attr('stroke', sc(r.i_state)).attr('stroke-width', 2.5);
  g.append('circle').attr('cx', x(0.01 * r.BV)).attr('cy', y(ID_op)).attr('r', 4)
    .attr('fill', sc(r.i_state));

  // VDS peak marker
  const vx = x(r.VDS_peak);
  const vy = y(Math.max(0.3, 0.01 * r.ID_max));
  g.append('polygon').attr('points', triPoints(vx, vy, 7))
    .attr('fill', '#fff').attr('stroke', sc(r.v_state)).attr('stroke-width', 2.5);
  g.append('polygon').attr('points', triPoints(vx, vy, 4))
    .attr('fill', sc(r.v_state));

  addLegend(g, [
    { t: `BVDSS = ${fnum(r.BV, 0)}V`, c: FAIL_COLOR, dash: '6,3' },
    { t: `${idLabel} = ${fnum(r.i_lim, 0)}A`, c: '#6B7280', dash: '6,3' },
    { t: '80% derating', c: WARN_COLOR, dash: '4,4' },
  ], pw, ph);
}

/* ---- Linear mode ---- */
function drawLinearD3(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  r: LinearResult,
  curves: SoaCurvePoint[],
  active: number,
  x: any, y: any,
  pw: number, ph: number,
  gradId: string,
) {
  drawLinearD3CurvesOnly(g, r, curves, active, x, y, pw, ph, gradId);
  drawLinearD3Markers(g, r, x, y);
}

function drawLinearD3CurvesOnly(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  r: LinearResult,
  curves: SoaCurvePoint[],
  active: number,
  x: any, y: any,
  pw: number, ph: number,
  gradId: string,
) {
  const lineGen = d3.line<[number, number]>()
    .x((d) => x(d[0])).y((d) => y(d[1]))
    .curve(d3.curveMonotoneX);

  const areaGen = d3.area<[number, number]>()
    .x((d) => x(d[0])).y0(ph).y1((d) => y(d[1]))
    .curve(d3.curveMonotoneX);

  // Active curve area fill
  g.selectAll('[data-soa-fill]').remove();
  if (curves[active]) {
    g.append('path').datum(curves[active].points)
      .attr('data-soa-fill', '')
      .attr('d', areaGen).attr('fill', `url(#${gradId})`);
  }

  const lpData: { i: number; y: number; origY: number }[] = [];

  curves.forEach((cv, i) => {
    const isActive = i === active;
    const color = COLORS[i % COLORS.length];

    g.append('path').datum(cv.points)
      .attr('data-curve', i)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 3)
      .attr('opacity', 1);

    if (cv.points.length) {
      const p = cv.points[cv.points.length - 1];
      lpData.push({ i, y: y(p[1]), origY: y(p[1]) });
    }
  });

  lpData.sort((a, b) => a.y - b.y);
  const gap = 19;
  for (let j = 1; j < lpData.length; j++) {
    const minY = lpData[j - 1].y + gap;
    if (lpData[j].y < minY) lpData[j].y = minY;
  }

  const bx = x(r.BV);
  lpData.forEach((lp) => {
    const isActive = lp.i === active;
    if (Math.abs(lp.y - lp.origY) > 2) {
      g.append('line').attr('data-label', '').attr('x1', bx).attr('y1', lp.origY)
        .attr('x2', bx + 4).attr('y2', lp.y)
        .attr('stroke', COLORS[lp.i % COLORS.length]).attr('stroke-width', 0.8).attr('opacity', 0.3);
    }
    g.append('text').attr('data-label', '').attr('x', bx + 6).attr('y', lp.y)
      .attr('text-anchor', 'start')
      .attr('fill', isActive ? COLORS[lp.i % COLORS.length] : '#6B7280')
      .style('font-family', 'var(--ui)')
      .attr('font-size', '10px')
      .attr('font-weight', isActive ? '700' : '400')
      .attr('opacity', isActive ? 1 : 0.5)
      .text(LABELS[lp.i]);
  });

  // BV line
  g.append('line').attr('data-bv-line', '').attr('x1', x(r.BV)).attr('x2', x(r.BV))
    .attr('y1', 0).attr('y2', ph)
    .attr('stroke', FAIL_COLOR).attr('stroke-dasharray', '6,3').attr('stroke-width', 1.5);

  // IDM / ID_max line
  const idmLine = r.IDM > 0 ? r.IDM : r.ID_max;
  g.append('line').attr('data-idm-line', '').attr('x1', 0).attr('x2', pw)
    .attr('y1', y(idmLine)).attr('y2', y(idmLine))
    .attr('stroke', '#6B7280').attr('stroke-dasharray', '6,3').attr('stroke-width', 1.5);
}

function drawLinearD3Markers(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  r: LinearResult,
  x: any, y: any,
) {
  const ok = r.overall === 'PASS';
  const warn = r.overall === 'WARN';
  const col = ok ? PASS_COLOR : warn ? WARN_COLOR : FAIL_COLOR;
  const cx = x(r.VDS), cy = y(r.ID);
  const host = g.append('g').attr('data-op-point', '');

  if (ok) {
    host.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 9)
      .attr('fill', '#fff').attr('stroke', col).attr('stroke-width', 2.5);
    host.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 5)
      .attr('fill', col);
  } else if (warn) {
    host.append('polygon').attr('points', triPoints(cx, cy, 9))
      .attr('fill', '#fff').attr('stroke', col).attr('stroke-width', 2.5);
    host.append('polygon').attr('points', triPoints(cx, cy, 5))
      .attr('fill', col);
  } else {
    const s = 8;
    host.append('line').attr('x1', cx - s).attr('y1', cy - s)
      .attr('x2', cx + s).attr('y2', cy + s)
      .attr('stroke', col).attr('stroke-width', 3.5).attr('stroke-linecap', 'round');
    host.append('line').attr('x1', cx - s).attr('y1', cy + s)
      .attr('x2', cx + s).attr('y2', cy - s)
      .attr('stroke', col).attr('stroke-width', 3.5).attr('stroke-linecap', 'round');
  }
}

/* ---- Legend ---- */
function addLegend(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  items: Array<{ t: string; c: string; dash?: string }>,
  pw: number, ph: number,
) {
  const pad = 8, lh = 16, sw = 22;
  const temp = g.append('text').style('font-family', 'var(--ui)').attr('font-size', '11px');
  let maxW = 0;
  items.forEach((it) => { maxW = Math.max(maxW, (temp.text(it.t).node() as any)?.getComputedTextLength() ?? 0); });
  temp.remove();

  const boxW = maxW + sw + pad * 2 + 6;
  const boxH = items.length * lh + pad * 2 - 2;
  const bx = pw - boxW - 8;
  const by = ph - boxH - 8;

  g.append('rect').attr('x', bx).attr('y', by).attr('width', boxW).attr('height', boxH)
    .attr('rx', 7).attr('fill', 'rgba(255,255,255,.92)')
    .attr('stroke', '#d0d0d0').attr('stroke-width', 1);

  items.forEach((it, i) => {
    const yy = by + pad + i * lh + lh / 2 + 4;
    const x0 = bx + pad;
    g.append('line').attr('x1', x0).attr('y1', yy).attr('x2', x0 + sw).attr('y2', yy)
      .attr('stroke', it.c).attr('stroke-width', 2.4).attr('stroke-dasharray', it.dash ?? '');
    g.append('text').attr('x', x0 + sw + 6).attr('y', yy + 4)
      .attr('fill', '#000').style('font-family', 'var(--ui)')
      .attr('font-size', '11px').text(it.t);
  });
}

/* ---- Tick label styling ---- */
function styleTickLabels(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
  g.selectAll('.tick text')
    .style('font-family', 'var(--ui)')
    .attr('font-size', '10px').attr('fill', AXIS_COLOR);
  g.selectAll('.tick text').each(function () {
    const el = d3.select(this);
    const txt = el.text();
    const m = txt.match(/^(\d+(?:\.\d+)?)([·]?)10\^([-]?\d+)$/);
    if (m) {
      el.text('');
      el.append('tspan').text(m[1] + m[2]);
      el.append('tspan').text('10');
      el.append('tspan').attr('font-size', '0.7em').attr('dy', '-0.35em').text(m[3]);
    } else {
      const m2 = txt.match(/^10\^([-]?\d+)$/);
      if (m2) {
        el.text('');
        el.append('tspan').text('10');
        el.append('tspan').attr('font-size', '0.7em').attr('dy', '-0.35em').text(m2[1]);
      }
    }
  });
}

/* ---- Grid ---- */
function drawGrid(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  x: any, y: any,
  pw: number, ph: number,
  isLog: boolean,
) {
  g.selectAll('[data-grid]').remove();
  const xDomain = x.domain() as [number, number];
  const yDomain = y.domain() as [number, number];

  if (isLog) {
    const xDecades = Math.log10(xDomain[1]) - Math.log10(xDomain[0]);
    const yDecades = Math.log10(yDomain[1]) - Math.log10(yDomain[0]);
    const xGrid = logGridVals(xDomain, xDecades, pw);
    const yGrid = logGridVals(yDomain, yDecades, ph);
    xGrid.forEach((v) => {
      g.append('line').attr('data-grid', '').attr('x1', x(v)).attr('x2', x(v)).attr('y1', 0).attr('y2', ph)
        .attr('stroke', GRID_COLOR).attr('stroke-width', 0.6);
    });
    yGrid.forEach((v) => {
      g.append('line').attr('data-grid', '').attr('x1', 0).attr('x2', pw).attr('y1', y(v)).attr('y2', y(v))
        .attr('stroke', GRID_COLOR).attr('stroke-width', 0.6);
    });
    for (let k = Math.ceil(Math.log10(xDomain[0])); k <= Math.floor(Math.log10(xDomain[1])); k++) {
      const v = Math.pow(10, k);
      if (v >= xDomain[0] && v <= xDomain[1]) {
        g.append('line').attr('data-grid', '').attr('x1', x(v)).attr('x2', x(v)).attr('y1', 0).attr('y2', ph)
          .attr('stroke', MAJOR_GRID_COLOR).attr('stroke-width', 1.2);
      }
    }
    for (let k = Math.ceil(Math.log10(yDomain[0])); k <= Math.floor(Math.log10(yDomain[1])); k++) {
      const v = Math.pow(10, k);
      if (v >= yDomain[0] && v <= yDomain[1]) {
        g.append('line').attr('data-grid', '').attr('x1', 0).attr('x2', pw).attr('y1', y(v)).attr('y2', y(v))
          .attr('stroke', MAJOR_GRID_COLOR).attr('stroke-width', 1.2);
      }
    }
  } else {
    const xTicks = x.ticks(6);
    const yTicks = y.ticks(6);
    xTicks.forEach((v: number) => {
      g.append('line').attr('data-grid', '').attr('x1', x(v)).attr('x2', x(v)).attr('y1', 0).attr('y2', ph)
        .attr('stroke', GRID_COLOR).attr('stroke-width', 0.6);
    });
    yTicks.forEach((v: number) => {
      g.append('line').attr('data-grid', '').attr('x1', 0).attr('x2', pw).attr('y1', y(v)).attr('y2', y(v))
        .attr('stroke', GRID_COLOR).attr('stroke-width', 0.6);
    });
  }
}

/* ---- Snap to nearest curve point ---- */
interface SnapResult { vds: number; id: number; label: string; px: number; py: number }
function snapToNearest(
  curves: SoaCurvePoint[] | null,
  x: any, y: any,
  mx: number, my: number,
  threshold: number,
): SnapResult | null {
  if (!curves) return null;
  let bestDist = threshold;
  let best: SnapResult | null = null;
  for (let ci = 0; ci < curves.length; ci++) {
    const pts = curves[ci].points;
    for (let pi = 0; pi < pts.length; pi++) {
      const [vds, id] = pts[pi];
      const px = x(vds);
      const py = y(id);
      const dx = px - mx;
      const dy = py - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { vds, id, label: LABELS[ci], px, py };
      }
    }
  }
  return best;
}
