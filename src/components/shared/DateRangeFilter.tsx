import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
}

export function DateRangeFilter({ dateFrom, dateTo, onDateFromChange, onDateToChange }: DateRangeFilterProps) {
  const hasFilter = dateFrom || dateTo;

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5", !dateFrom && "text-muted-foreground")}>
            <CalendarIcon className="h-3.5 w-3.5" />
            {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "De"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateFrom} onSelect={onDateFromChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5", !dateTo && "text-muted-foreground")}>
            <CalendarIcon className="h-3.5 w-3.5" />
            {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Até"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateTo} onSelect={onDateToChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {hasFilter && (
        <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 text-muted-foreground" onClick={() => { onDateFromChange(undefined); onDateToChange(undefined); }}>
          <X className="h-3.5 w-3.5" />Limpar
        </Button>
      )}
    </div>
  );
}

export function filterByDateRange<T extends Record<string, any>>(
  items: T[],
  dateField: string,
  dateFrom: Date | undefined,
  dateTo: Date | undefined
): T[] {
  return items.filter(item => {
    const val = item[dateField];
    if (!val) return true;
    const d = new Date(val);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  });
}
