import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileSpreadsheet, Search, Settings2, Download, Save } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { exportToExcel } from "@/utils/excelExport";
import { cn } from "@/lib/utils";

interface Props {
  projetoId: string;
  darkBg?: boolean;
}

interface ColDef {
  key: string;
  label: string;
  group: string;
  source: "submissao" | "submissao.dados_excel" | "produto_brasil" | "status" | "observacao";
  type?: "number" | "text" | "json" | "date";
  width?: number;
}

const COLUNAS: ColDef[] = [
  // Identificação
  { key: "produto_codigo", label: "Código", group: "Identificação", source: "submissao", width: 110 },
  { key: "produto_nome", label: "Nome", group: "Identificação", source: "submissao", width: 240 },
  { key: "linha_produto", label: "Linha", group: "Identificação", source: "submissao", width: 90 },
  { key: "formula_codigo", label: "Fórmula", group: "Identificação", source: "submissao", width: 100 },
  { key: "numero_item", label: "Item nº", group: "Identificação", source: "submissao", width: 80 },
  { key: "numero_ordem", label: "Ordem nº", group: "Identificação", source: "submissao", width: 90 },
  // Projeto
  { key: "status", label: "Status (projeto)", group: "Projeto", source: "status", width: 140 },
  { key: "observacao", label: "Observação", group: "Projeto", source: "observacao", width: 220 },
  // Embalagem
  { key: "qty_total", label: "UN total", group: "Embalagem", source: "submissao", type: "number", width: 90 },
  { key: "qty_per_display", label: "UN/BX", group: "Embalagem", source: "submissao", type: "number", width: 80 },
  { key: "display_type", label: "Display", group: "Embalagem", source: "submissao.dados_excel", width: 90 },
  { key: "ctn_total", label: "CTN total", group: "Embalagem", source: "submissao.dados_excel", type: "number", width: 90 },
  { key: "cartons_per_group", label: "Cart./grupo", group: "Embalagem", source: "submissao.dados_excel", type: "number", width: 100 },
  { key: "total_groups", label: "Grupos", group: "Embalagem", source: "submissao.dados_excel", type: "number", width: 80 },
  { key: "medidas_display", label: "Medidas display", group: "Embalagem", source: "submissao", type: "json", width: 180 },
  // Peso
  { key: "peso_bruto_g", label: "Bruto (g)", group: "Peso", source: "submissao", type: "number", width: 90 },
  { key: "peso_liquido_g", label: "Líquido (g)", group: "Peso", source: "submissao", type: "number", width: 90 },
  { key: "peso_tester_g", label: "Tester (g)", group: "Peso", source: "submissao", type: "number", width: 90 },
  { key: "peso_plastico_g", label: "Plástico (g)", group: "Peso", source: "submissao.dados_excel", type: "number", width: 100 },
  { key: "peso_aluminio_g", label: "Alumínio (g)", group: "Peso", source: "submissao.dados_excel", type: "number", width: 100 },
  // EAN
  { key: "ean_unidade", label: "EAN UN", group: "EAN", source: "submissao", width: 130 },
  { key: "ean_display", label: "EAN BX", group: "EAN", source: "submissao", width: 130 },
  { key: "ean_caixa_master", label: "EAN CX", group: "EAN", source: "submissao", width: 130 },
  // Material
  { key: "tipo_material_plastico", label: "Material plástico", group: "Material", source: "submissao", width: 140 },
  // Datas
  { key: "data_envio", label: "Enviado em", group: "Datas", source: "submissao", type: "date", width: 130 },
  { key: "aprovado_em", label: "Aprovado em", group: "Datas", source: "submissao", type: "date", width: 130 },
  { key: "liberado_para_oc_em", label: "Liberado p/ OC", group: "Datas", source: "submissao", type: "date", width: 130 },
];

const COL_KEYS = COLUNAS.map((c) => c.key);
const DEFAULT_VISIBLE = [
  "produto_codigo", "produto_nome", "status", "qty_total", "qty_per_display", "ctn_total",
  "ean_unidade", "ean_display", "ean_caixa_master", "peso_bruto_g", "peso_liquido_g",
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-muted text-muted-foreground" },
  { value: "revisar", label: "Revisar", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  { value: "ok", label: "OK", color: "bg-green-500/15 text-green-700 dark:text-green-400" },
  { value: "bloqueado", label: "Bloqueado", color: "bg-red-500/15 text-red-700 dark:text-red-400" },
];

function formatCell(col: ColDef, value: any): string {
  if (value == null || value === "") return "—";
  if (col.type === "date") {
    try { return new Date(value).toLocaleDateString("pt-BR"); } catch { return String(value); }
  }
  if (col.type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }
  if (col.type === "json") {
    if (typeof value === "object") {
      const parts = Object.entries(value).map(([k, v]) => `${k}: ${v}`);
      return parts.join(" × ") || "—";
    }
  }
  return String(value);
}

function readField(row: any, col: ColDef): any {
  if (col.source === "status") return row._status?.status ?? "pendente";
  if (col.source === "observacao") return row._status?.observacao ?? "";
  if (col.source === "submissao.dados_excel") return row.submissao?.dados_excel?.[col.key];
  if (col.source === "submissao") return row.submissao?.[col.key];
  return row[col.key];
}

export function SubmissaoPlanilhaTab({ projetoId, darkBg = false }: Props) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [groupBy, setGroupBy] = useState<string>("none");

  // Submissões vinculadas via produtos_brasil
  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["projeto-submissao-planilha", projetoId],
    queryFn: async () => {
      const { data: produtos, error } = await (supabase
        .from("produtos_brasil" as any)
        .select(`
          id, codigo_brasil, nome_brasil, submissao_china_id,
          submissao:china_produto_submissoes!produtos_brasil_submissao_china_id_fkey (
            id, produto_codigo, produto_nome, linha_produto, formula_codigo, numero_item, numero_ordem,
            qty_total, peso_bruto_g, peso_liquido_g, peso_tester_g, medidas_display, dados_excel,
            ean_unidade, ean_display, ean_caixa_master, tipo_material_plastico,
            data_envio, aprovado_em, liberado_para_oc_em, status
          )
        `)
        .eq("projeto_id", projetoId)
        .not("submissao_china_id", "is", null) as any);
      if (error) throw error;
      const submIds = (produtos || []).map((p: any) => p.submissao_china_id).filter(Boolean);
      if (submIds.length === 0) return [];

      const [{ data: statusRows }, { data: overrideRows }] = await Promise.all([
        (supabase.from("projeto_submissao_planilha_status" as any)
          .select("*")
          .eq("projeto_id", projetoId)
          .in("submissao_id", submIds) as any),
        (supabase.from("projeto_submissao_planilha_overrides" as any)
          .select("*")
          .eq("projeto_id", projetoId)
          .in("submissao_id", submIds) as any),
      ]);

      const statusMap = new Map<string, any>();
      (statusRows || []).forEach((s: any) => statusMap.set(s.submissao_id, s));
      const ovMap = new Map<string, Record<string, any>>();
      (overrideRows || []).forEach((o: any) => {
        const m = ovMap.get(o.submissao_id) || {};
        m[o.campo] = o.valor;
        ovMap.set(o.submissao_id, m);
      });

      // Inject qty_per_display calculado a partir do dados_excel se ausente no nível superior
      return (produtos || []).map((p: any) => {
        const sub = p.submissao;
        if (sub && sub.dados_excel?.qty_per_display != null && sub.qty_per_display == null) {
          sub.qty_per_display = Number(sub.dados_excel.qty_per_display);
        }
        return {
          ...p,
          _status: statusMap.get(p.submissao_china_id) || null,
          _overrides: ovMap.get(p.submissao_china_id) || {},
        };
      });
    },
    enabled: !!projetoId,
  });

  // Config (visões)
  const { data: configRow } = useQuery({
    queryKey: ["projeto-submissao-planilha-config", projetoId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await (supabase
        .from("projeto_submissao_planilha_config" as any)
        .select("*")
        .eq("projeto_id", projetoId)
        .eq("user_id", user.id)
        .eq("is_default", true)
        .maybeSingle() as any);
      return data;
    },
    enabled: !!projetoId,
  });

  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE);
  useEffect(() => {
    if (configRow?.colunas && Array.isArray(configRow.colunas) && configRow.colunas.length > 0) {
      const valid = (configRow.colunas as string[]).filter((k) => COL_KEYS.includes(k));
      if (valid.length > 0) setVisibleCols(valid);
    }
  }, [configRow]);

  const updateStatus = useMutation({
    mutationFn: async ({ submissaoId, patch }: { submissaoId: string; patch: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { projeto_id: projetoId, submissao_id: submissaoId, ...patch, updated_by: user?.id };
      const { error } = await (supabase
        .from("projeto_submissao_planilha_status" as any)
        .upsert(payload, { onConflict: "projeto_id,submissao_id" } as any) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projeto-submissao-planilha", projetoId] }),
    onError: (e: any) => toast.error("Erro ao salvar: " + (e?.message || "")),
  });

  const saveConfig = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sem usuário");
      const payload = {
        projeto_id: projetoId,
        user_id: user.id,
        nome: "Padrão",
        colunas: visibleCols,
        is_default: true,
      };
      if (configRow?.id) {
        const { error } = await (supabase
          .from("projeto_submissao_planilha_config" as any)
          .update({ colunas: visibleCols })
          .eq("id", configRow.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from("projeto_submissao_planilha_config" as any)
          .insert(payload) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Visão salva");
      qc.invalidateQueries({ queryKey: ["projeto-submissao-planilha-config", projetoId] });
    },
    onError: (e: any) => toast.error("Erro ao salvar visão: " + (e?.message || "")),
  });

  const linhasFiltradas = useMemo(() => {
    let list = linhas;
    if (busca) {
      const s = busca.toLowerCase();
      list = list.filter((p: any) =>
        p.submissao?.produto_codigo?.toLowerCase().includes(s) ||
        p.submissao?.produto_nome?.toLowerCase().includes(s) ||
        p.codigo_brasil?.toLowerCase().includes(s) ||
        p.nome_brasil?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [linhas, busca]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "", rows: linhasFiltradas }];
    const map = new Map<string, any[]>();
    linhasFiltradas.forEach((row: any) => {
      const col = COLUNAS.find((c) => c.key === groupBy);
      const value = col ? formatCell(col, readField(row, col)) : "";
      const arr = map.get(value) || [];
      arr.push(row);
      map.set(value, arr);
    });
    return Array.from(map.entries()).map(([key, rows]) => ({ key, rows }));
  }, [linhasFiltradas, groupBy]);

  const handleExport = async () => {
    const cols = COLUNAS.filter((c) => visibleCols.includes(c.key));
    const rows = linhasFiltradas.map((row: any) => {
      const out: Record<string, any> = {};
      cols.forEach((c) => { out[c.label] = formatCell(c, readField(row, c)); });
      return out;
    });
    await exportToExcel(rows, {
      filename: `submissoes_projeto_${projetoId.slice(0, 8)}`,
      sheetName: "Submissões",
      columns: cols.map((c) => ({ header: c.label, key: c.label, width: 20 })),
      includeTimestamp: true,
    });
    toast.success("Planilha exportada");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (linhas.length === 0) {
    return (
      <div className="py-16 text-center space-y-2">
        <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Nenhuma submissão vinculada a este projeto.
        </p>
        <p className="text-xs text-muted-foreground">
          Vincule um produto importado ao projeto para ver os dados aqui.
        </p>
      </div>
    );
  }

  const cols = COLUNAS.filter((c) => visibleCols.includes(c.key));

  return (
    <div className={cn("space-y-3", darkBg && "text-white")}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Agrupar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem agrupamento</SelectItem>
            <SelectItem value="status">Status do projeto</SelectItem>
            <SelectItem value="linha_produto">Linha</SelectItem>
            <SelectItem value="tipo_material_plastico">Material</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> Colunas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[420px] overflow-y-auto w-60">
            {Object.entries(
              COLUNAS.reduce((acc: Record<string, ColDef[]>, c) => {
                (acc[c.group] = acc[c.group] || []).push(c);
                return acc;
              }, {})
            ).map(([group, list]) => (
              <div key={group}>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{group}</DropdownMenuLabel>
                {list.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.key}
                    checked={visibleCols.includes(c.key)}
                    onCheckedChange={(checked) => {
                      setVisibleCols((prev) =>
                        checked ? [...prev, c.key] : prev.filter((k) => k !== c.key)
                      );
                    }}
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>
          <Save className="h-3.5 w-3.5" /> Salvar visão
        </Button>

        <Button variant="default" size="sm" className="h-8 text-xs gap-1.5" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" /> Exportar XLSX
        </Button>

        <div className="text-xs text-muted-foreground ml-auto">
          {linhasFiltradas.length} {linhasFiltradas.length === 1 ? "submissão" : "submissões"}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground sticky top-0">
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className="text-left font-medium px-2 py-1.5 whitespace-nowrap"
                    style={{ minWidth: c.width || 100 }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <>
                  {groupBy !== "none" && (
                    <tr key={`g-${g.key}`} className="bg-muted/30">
                      <td colSpan={cols.length} className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                        {g.key || "—"} · {g.rows.length}
                      </td>
                    </tr>
                  )}
                  {g.rows.map((row: any) => (
                    <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                      {cols.map((c) => {
                        const value = readField(row, c);
                        if (c.source === "status") {
                          const opt = STATUS_OPTIONS.find((s) => s.value === value) || STATUS_OPTIONS[0];
                          return (
                            <td key={c.key} className="px-2 py-1">
                              <Select
                                value={opt.value}
                                onValueChange={(v) =>
                                  updateStatus.mutate({ submissaoId: row.submissao_china_id, patch: { status: v } })
                                }
                              >
                                <SelectTrigger className={cn("h-6 text-[10px] border-0 px-1.5 rounded", opt.color)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((s) => (
                                    <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          );
                        }
                        if (c.source === "observacao") {
                          return (
                            <td key={c.key} className="px-2 py-1">
                              <Input
                                defaultValue={value || ""}
                                onBlur={(e) => {
                                  const newVal = e.target.value;
                                  if (newVal !== (value || "")) {
                                    updateStatus.mutate({ submissaoId: row.submissao_china_id, patch: { observacao: newVal } });
                                  }
                                }}
                                className="h-6 text-[11px] px-1.5"
                              />
                            </td>
                          );
                        }
                        return (
                          <td key={c.key} className="px-2 py-1 whitespace-nowrap font-mono tabular-nums text-foreground/90">
                            {formatCell(c, value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
