import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  em_aprovacao: "bg-yellow-500/20 text-yellow-700",
  aprovado: "bg-blue-500/20 text-blue-700",
  publicado: "bg-green-500/20 text-green-700",
};

export function UnifiedEditorialCalendar() {
  const [selectedClient, setSelectedClient] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: clients = [] } = useQuery({
    queryKey: ["agency-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_clients").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["calendar-items", selectedClient, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      let query = supabase.from("content_funnel_items").select("*, agency_clients(nome, cor)")
        .gte("data_prevista", start).lte("data_prevista", end).order("data_prevista");
      if (selectedClient !== "all") query = query.eq("agency_client_id", selectedClient);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const daysArr = eachDayOfInterval({ start, end });
    const startDay = start.getDay();
    const padding = Array(startDay).fill(null);
    return [...padding, ...daysArr];
  }, [currentMonth]);

  const getItemsForDay = (day: Date) => items.filter((item: any) => item.data_prevista && isSameDay(new Date(item.data_prevista), day));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold min-w-[200px] text-center">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-px">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
            {days.map((day, i) => (
              <div key={i} className={`min-h-[100px] border rounded-md p-1 ${day && isToday(day) ? "bg-primary/5 border-primary" : "border-border/50"} ${!day ? "bg-transparent border-transparent" : ""}`}>
                {day && (
                  <>
                    <span className={`text-xs font-medium ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>{format(day, "d")}</span>
                    <div className="space-y-1 mt-1">
                      {getItemsForDay(day).map((item: any) => (
                        <div key={item.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${STATUS_COLORS[item.status] || "bg-muted"}`} title={item.titulo}>
                          <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: (item.agency_clients as any)?.cor || "#6366f1" }} />
                          {item.titulo}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${cls}`} />
            <span className="text-xs text-muted-foreground">{status.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
