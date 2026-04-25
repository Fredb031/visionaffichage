// Tiny inline-SVG sparkline used by admin tables/cards to give a sense
// of motion alongside a scalar value (inventory, orders, etc.). Keeps
// zero runtime deps — just SVG + a bit of math. If the series is empty
// or flat-zero we render a dashed muted placeholder so the column
// doesn't look broken when telemetry is missing.

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  ariaLabel?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  stroke = '#E8A838',
  strokeWidth = 1.5,
  ariaLabel,
}: SparklineProps) {
  // Drop non-finite values (NaN / ±Infinity) up front. Stat sources
  // sometimes divide-by-zero when a comparison period has no data,
  // and a single NaN slipping into Math.min/max poisons the entire
  // computed range — every point becomes "NaN,NaN" and the polyline
  // silently disappears, leaving the cell looking broken instead of
  // showing the muted dashed placeholder we render for empty input.
  // Filtering here normalises the bad-data case to the same "no data"
  // path so the column always reads as either a real trend or an
  // explicit absence, never a phantom-empty SVG.
  const safeData = Array.isArray(data) ? data.filter(v => Number.isFinite(v)) : [];
  const isEmpty = safeData.length === 0;
  const isAllZero = !isEmpty && safeData.every(v => v === 0);

  if (isEmpty || isAllZero) {
    // Muted dashed placeholder — communicates "no data" without
    // pretending a flat line is a real trend.
    const midY = height / 2;
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? 'Aucune donnée de tendance'}
        className="overflow-visible"
      >
        <line
          x1={2}
          y1={midY}
          x2={width - 2}
          y2={midY}
          stroke="#d4d4d8"
          strokeWidth={1}
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Single-point series: draw a centered dot so the column isn't empty.
  if (safeData.length === 1) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? 'Tendance (1 point)'}
      >
        <circle cx={width / 2} cy={height / 2} r={1.5} fill={stroke} />
      </svg>
    );
  }

  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  // Guard against a flat non-zero series — without this, (max-min)=0
  // divides to NaN and the polyline disappears. Render it centered.
  const range = max - min || 1;
  const stepX = (width - 2) / (safeData.length - 1);
  const padY = 2;
  const innerH = height - padY * 2;

  const points = safeData.map((v, i) => {
    const x = 1 + i * stepX;
    // Invert Y (SVG grows downward) so higher values sit higher.
    const y = padY + innerH - ((v - min) / range) * innerH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const linePath = points.join(' ');
  // Area path: close the polyline down to the baseline so we can
  // fill a translucent band beneath the stroke.
  const firstX = 1;
  const lastX = 1 + (safeData.length - 1) * stepX;
  const baselineY = height - 0.5;
  const areaPath = `M ${firstX},${baselineY} L ${points.join(' L ')} L ${lastX.toFixed(2)},${baselineY} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? `Tendance ${safeData.length} points, min ${min}, max ${max}`}
      className="overflow-visible"
    >
      <path d={areaPath} fill={stroke} fillOpacity={0.12} stroke="none" />
      <polyline
        points={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default Sparkline;
