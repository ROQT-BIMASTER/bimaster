import { useMemo } from "react";

interface ScoreGaugeProps {
  score: number;
  size?: number;
}

export default function ScoreGauge({ score, size = 160 }: ScoreGaugeProps) {
  const { color, percentage, strokeDasharray, strokeDashoffset } = useMemo(() => {
    // Score de 0 a 1000
    const pct = Math.min(100, Math.max(0, (score / 1000) * 100));
    
    // Cor baseada no score
    let clr = 'hsl(var(--destructive))';
    if (score >= 800) clr = 'hsl(142.1 76.2% 36.3%)'; // emerald-500
    else if (score >= 650) clr = 'hsl(142.1 70.6% 45.3%)'; // green-500
    else if (score >= 500) clr = 'hsl(47.9 95.8% 53.1%)'; // yellow-500
    else if (score >= 350) clr = 'hsl(24.6 95% 53.1%)'; // orange-500
    
    // Cálculo do arco (semicírculo)
    const radius = 60;
    const circumference = Math.PI * radius;
    const dasharray = circumference;
    const dashoffset = circumference - (pct / 100) * circumference;
    
    return {
      color: clr,
      percentage: pct,
      strokeDasharray: dasharray,
      strokeDashoffset: dashoffset
    };
  }, [score]);

  return (
    <div className="relative" style={{ width: size, height: size * 0.65 }}>
      <svg
        width={size}
        height={size * 0.65}
        viewBox="0 0 160 100"
        className="transform rotate-0"
      >
        {/* Background arc */}
        <path
          d="M 20 90 A 60 60 0 0 1 140 90"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Colored arc */}
        <path
          d="M 20 90 A 60 60 0 0 1 140 90"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease'
          }}
        />
        
        {/* Score labels */}
        <text x="20" y="98" fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle">0</text>
        <text x="80" y="20" fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle">500</text>
        <text x="140" y="98" fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle">1000</text>
      </svg>
      
      {/* Score display */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-end pb-2"
      >
        <span 
          className="text-3xl font-bold"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-xs text-muted-foreground">pontos</span>
      </div>
    </div>
  );
}
