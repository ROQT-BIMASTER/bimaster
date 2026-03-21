import { cn } from "@/lib/utils";

interface GaugeChartProps {
  value: number; // percentage 0-100+
  size?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

export function GaugeChart({ value, size = 180, label, sublabel, className }: GaugeChartProps) {
  const clampedValue = Math.min(Math.max(value, 0), 150);
  const normalizedAngle = (clampedValue / 150) * 180; // Map 0-150% to 0-180 degrees
  const radius = size * 0.38;
  const strokeWidth = size * 0.08;
  const cx = size / 2;
  const cy = size * 0.55;

  const startAngle = Math.PI;
  const endAngle = 0;

  const bgPath = describeArc(cx, cy, radius, startAngle, endAngle);
  const valueAngle = startAngle - (normalizedAngle * Math.PI) / 180;
  const valuePath = describeArc(cx, cy, radius, startAngle, Math.max(valueAngle, endAngle));

  const color = value >= 100 ? "hsl(142, 71%, 45%)" : value >= 80 ? "hsl(38, 92%, 50%)" : "hsl(0, 84%, 60%)";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path d={bgPath} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} strokeLinecap="round" />
        {/* Value arc */}
        {value > 0 && (
          <path d={valuePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        )}
        {/* Center text */}
        <text x={cx} y={cy - 5} textAnchor="middle" className="text-2xl font-bold fill-foreground" fontSize={size * 0.14}>
          {value.toFixed(1)}%
        </text>
        {sublabel && (
          <text x={cx} y={cy + size * 0.08} textAnchor="middle" className="fill-muted-foreground" fontSize={size * 0.06}>
            {sublabel}
          </text>
        )}
      </svg>
      {label && <span className="text-sm font-medium text-muted-foreground mt-1">{label}</span>}
    </div>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle);
  const largeArc = startAngle - endAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}
