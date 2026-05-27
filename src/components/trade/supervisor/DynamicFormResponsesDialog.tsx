import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportToExcel } from "@/utils/excelExport";
import { toast } from "sonner";
interface Props {
  formId: string | null;
  formName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Field = { id: string; label: string };
type Response = { id: string; created_at: string };
type Answer = { response_id: string; field_id: string; value: any };

function flattenValue(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(flattenValue).join(", ");
  if (typeof v === "object") {
    // Endereço & objetos: monta string legível
    return Object.entries(v)
      .filter(([, val]) => val !== "" && val !== null && val !== undefined)
      .map(([k, val]) => `${k}: ${flattenValue(val)}`)
      .join(" | ");
  }
  return String(v);
}

export function DynamicFormResponsesDialog({ formId, formName, open, onOpenChange }: Props) {
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["dynamic-form-responses-full", formId],
    enabled: !!formId && open,
    queryFn: async () => {
      if (!formId) return { fields: [] as Field[], responses: [] as Response[], answers: [] as Answer[] };
      const [fieldsRes, responsesRes] = await Promise.all([
        supabase.from("dynamic_form_fields").select("id, label").eq("form_id", formId),
        supabase
          .from("dynamic_form_responses")
          .select("id, created_at")
          .eq("form_id", formId)
          .order("created_at", { ascending: false }),
      ]);
      if (fieldsRes.error) throw fieldsRes.error;
      if (responsesRes.error) throw responsesRes.error;
      const responseIds = (responsesRes.data || []).map((r) => r.id);
      let answers: Answer[] = [];
      if (responseIds.length > 0) {
        const { data, error } = await supabase
          .from("dynamic_form_answers")
          .select("response_id, field_id, value")
          .in("response_id", responseIds);
        if (error) throw error;
        answers = (data || []) as Answer[];
      }
      return {
        fields: (fieldsRes.data || []) as Field[],
        responses: (responsesRes.data || []) as Response[],
        answers,
      };
    },
  });

  const rows = useMemo(() => {
    const data = query.data;
    if (!data) return [] as Array<Record<string, any>>;
    const byResponse = new Map<string, Map<string, any>>();
    for (const a of data.answers) {
      if (!byResponse.has(a.response_id)) byResponse.set(a.response_id, new Map());
      byResponse.get(a.response_id)!.set(a.field_id, a.value);
    }
    return data.responses.map((r) => {
      const map = byResponse.get(r.id) || new Map();
      const row: Record<string, any> = {
        __id: r.id,
        __data: format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      };
      for (const f of data.fields) {
        row[f.label] = flattenValue(map.get(f.id));
      }
      return row;
    });
  }, [query.data]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      Object.entries(r)
        .filter(([k]) => !k.startsWith("__"))
        .some(([, v]) => String(v).toLowerCase().includes(q))
        || r.__data.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const fields = query.data?.fields || [];

  const handleExport = async () => {
    if (filteredRows.length === 0) {
      toast.error("Nada para exportar");
      return;
    }
    try {
      const columns = [
        { header: "Data", key: "__data", width: 18 },
        ...fields.map((f) => ({ header: f.label, key: f.label, width: 24 })),
      ];
      const safeName = formName.replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 60);
      await exportToExcel(filteredRows, {
        filename: `${safeName}_respostas`,
        sheetName: "Respostas",
        columns,
        includeTimestamp: true,
      });
      toast("Excel gerado com sucesso");
    } catch (e: any) {
      toast.error("Erro ao exportar", { description: e?.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {formName}
            <Badge variant="outline">{filteredRows.length} lançamento(s)</Badge>
          </DialogTitle>
          <DialogDescription>
            Lançamentos recebidos neste formulário. Use a busca para filtrar e exporte para Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar em qualquer campo (nome, CPF, cidade, etc.)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          {query.isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {rows.length === 0
                ? "Nenhum lançamento recebido ainda."
                : "Nenhum lançamento encontrado para a busca."}
            </p>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  {fields.map((f) => (
                    <TableHead key={f.id} className="whitespace-nowrap">{f.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r) => (
                  <TableRow key={r.__id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{r.__data}</TableCell>
                    {fields.map((f) => (
                      <TableCell key={f.id} className="text-sm max-w-xs truncate" title={String(r[f.label] ?? "")}>
                        {r[f.label] || "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
