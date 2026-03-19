import { useState, useEffect } from "react";
import { Timer } from "lucide-react";

interface CienciaTimerProps {
  cienciaEm: string;
  className?: string;
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const totalMonths = Math.floor(totalDays / 30);

  if (totalMonths > 0) {
    const remainDays = totalDays % 30;
    return remainDays > 0 ? `${totalMonths}m ${remainDays}d` : `${totalMonths}m`;
  }
  if (totalDays > 0) {
    const remainHours = totalHours % 24;
    return remainHours > 0 ? `${totalDays}d ${remainHours}h` : `${totalDays}d`;
  }
  if (totalHours > 0) {
    const remainMins = totalMinutes % 60;
    return remainMins > 0 ? `${totalHours}h ${remainMins}min` : `${totalHours}h`;
  }
  return `${totalMinutes}min`;
}

export function CienciaTimer({ cienciaEm, className }: CienciaTimerProps) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const calc = () => {
      const diff = Date.now() - new Date(cienciaEm).getTime();
      setElapsed(formatElapsed(Math.max(0, diff)));
    };
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [cienciaEm]);

  if (!elapsed) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground ${className || ""}`}>
      <Timer className="h-3 w-3" />
      {elapsed}
    </span>
  );
}
