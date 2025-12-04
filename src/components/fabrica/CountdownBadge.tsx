import { differenceInDays, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle, AlertTriangle, Rocket } from "lucide-react";

interface CountdownBadgeProps {
  date: string | Date;
  isLaunched?: boolean;
  className?: string;
}

export default function CountdownBadge({ date, isLaunched, className }: CountdownBadgeProps) {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysUntil = differenceInDays(targetDate, today);
  const past = isPast(targetDate) && !isToday(targetDate);
  const todayIs = isToday(targetDate);

  if (isLaunched) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        "bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-500/30",
        className
      )}>
        <Rocket className="h-3 w-3" />
        Lançado
      </div>
    );
  }

  if (todayIs) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium animate-pulse",
        "bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-700 dark:text-green-300 border border-green-500/30",
        className
      )}>
        <CheckCircle className="h-3 w-3" />
        Hoje!
      </div>
    );
  }

  if (past) {
    const daysPast = Math.abs(daysUntil);
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        "bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-700 dark:text-red-300 border border-red-500/30",
        className
      )}>
        <AlertTriangle className="h-3 w-3" />
        {daysPast === 1 ? "Ontem" : `${daysPast} dias atrás`}
      </div>
    );
  }

  // Future
  if (daysUntil <= 3) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30",
        className
      )}>
        <Clock className="h-3 w-3" />
        Em {daysUntil} dia{daysUntil !== 1 ? 's' : ''}
      </div>
    );
  }

  if (daysUntil <= 7) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30",
        className
      )}>
        <Clock className="h-3 w-3" />
        Em {daysUntil} dias
      </div>
    );
  }

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
      "bg-muted/50 text-muted-foreground border border-border/50",
      className
    )}>
      <Clock className="h-3 w-3" />
      Em {daysUntil} dias
    </div>
  );
}
