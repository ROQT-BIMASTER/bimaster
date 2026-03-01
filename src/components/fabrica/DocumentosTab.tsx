import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileText, Download, Loader2, CheckCircle2, Archive,
  Receipt, FileCheck, File, Shield, Tag, FlaskConical, ChevronRight, BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  produtoId: string;
}

interface Documento {
  id: string;
  nome_arquivo: string;
  arquivo_path: string;
  tipo_arquivo: string;
  tamanho: number;
  categoria: string;
  status: string;
  enviado_por_nome: string | null;
  materia_prima_id: string | null;
  created_at: string;
}

interface MPInfo {
  id: string;
  nome: string;
  codigo: string;
}

const CATEGORIAS = [
  { value: "orcamento", label: "Orçamento" },
  { value: "nf", label: "Nota Fiscal" },
  { value: "art", label: "ART" },
  { value: "embalagem_tampa", label: "Tampa" },
  { value: "embalagem_frasco", label: "Frasco" },
  { value: "embalagem_rotulo", label: "Rótulo" },
  { value: "embalagem_caixa", label: "Caixa" },
  { value: "materia_prima", label: "Matéria-Prima" },
  { value: "evidencia", label: "Evidência" },
  { value: "contrato", label: "Contrato" },
  { value: "geral", label: "Geral" },
];

const CATEGORIA_COLORS: Record<string, string> = {
  orcamento: "bg-blue-500",
  nf: "bg-orange-500",
  art: "bg-red-500",
  embalagem_tampa: "bg-teal-500",
  embalagem_frasco: "bg-teal-400",
  embalagem_rotulo: "bg-teal-600",
  embalagem_caixa: "bg-teal-300",
  materia_prima: "bg-amber-500",
  evidencia: "bg-green-500",
  contrato: "bg-purple-500",
  geral: "bg-gray-400",
};

function getCategoriaIcon(cat: string) {
  switch (cat) {
    case "orcamento": return <Receipt className="h-4 w-4 text-blue-600" />;
    case "evidencia": return <FileCheck className="h-4 w-4 text-green-600" />;
    case "nf": return <FileText className="h-4 w-4 text-orange-600" />;
    case "contrato": return <Shield className="h-4 w-4 text-purple-600" />;
    case "art": return <FileCheck className="h-4 w-4 text-red-600" />;
    case "materia_prima": return <FlaskConical className="h-4 w-4 text-amber-600" />;
    case "embalagem_tampa":
    case "embalagem_frasco":
    case "embalagem_rotulo":
    case "embalagem_caixa": return <Tag className="h-4 w-4 text-teal-600" />;
    default: return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function DocumentosTab({ produtoId }: Props) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<Map<string, MPInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [openMPs, setOpenMPs] = useState<Set<string>>(new Set());
  const [modoFoco, setModoFoco] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fabrica_revisao_documentos" as any)
        .select("*")
        .eq("produto_id", produtoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const docs = (data as any[]) || [];
      setDocumentos(docs);

      // Load MP names
      const mpIds = [...new Set(docs.map(d => d.materia_prima_id).filter(Boolean))];
      if (mpIds.length > 0) {
        const { data: mps } = await supabase
          .from("fabrica_materias_primas")
          .select("id, nome, codigo")
          .in("id", mpIds);
        const mpMap = new Map<string, MPInfo>();
        (mps || []).forEach((mp: any) => mpMap.set(mp.id, { id: mp.id, nome: mp.nome, codigo: mp.codigo }));
        setMateriasPrimas(mpMap);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [produtoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleDownload = async (doc: Documento) => {
    const { data } = await supabase.storage.from("fabrica-revisao-docs").createSignedUrl(doc.arquivo_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link");
  };

  const handleAprovar = async (docId: string) => {
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("fabrica_revisao_documentos" as any)
      .update({ status: "aprovado", aprovado_por: user?.user?.id, aprovado_em: new Date().toISOString() } as any)
      .eq("id", docId);
    toast.success("Documento aprovado");
    carregar();
  };

  const handleCategorizar = async (docId: string, categoria: string) => {
    await supabase.from("fabrica_revisao_documentos" as any)
      .update({ categoria } as any)
      .eq("id", docId);
    toast.success("Categoria atualizada");
    carregar();
  };

  const handleArquivar = async (docId: string) => {
    await supabase.from("fabrica_revisao_documentos" as any)
      .update({ status: "arquivado" } as any)
      .eq("id", docId);
    toast.success("Documento arquivado");
    carregar();
  };

  const filtered = documentos.filter(d => {
    const matchCat = filtroCategoria === "all" || d.categoria === filtroCategoria;
    const matchStatus = filtroStatus === "all" || d.status === filtroStatus;
    return matchCat && matchStatus;
  });

  // Chart data for modo foco
  const chartData = useMemo(() => {
    const counts = new Map<string, number>();
    documentos.forEach(d => {
      counts.set(d.categoria, (counts.get(d.categoria) || 0) + 1);
    });
    const total = documentos.length || 1;
    return CATEGORIAS
      .map(c => ({ ...c, count: counts.get(c.value) || 0, pct: ((counts.get(c.value) || 0) / total) * 100 }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [documentos]);

  // Group by materia_prima_id
  const mpGroups = (() => {
    const groups = new Map<string | "geral", Documento[]>();
    filtered.forEach(doc => {
      const key = doc.materia_prima_id || "geral";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(doc);
    });

    const result: { mp: MPInfo | null; docs: Documento[] }[] = [];
    groups.forEach((docs, key) => {
      if (key !== "geral") {
        result.push({ mp: materiasPrimas.get(key) || { id: key, nome: "MP", codigo: "" }, docs });
      }
    });
    result.sort((a, b) => (a.mp?.nome || "").localeCompare(b.mp?.nome || ""));
    const gerais = groups.get("geral");
    if (gerais) result.push({ mp: null, docs: gerais });
    return result;
  })();

  const toggleMP = (key: string, open: boolean) => {
    setOpenMPs(prev => {
      const next = new Set(prev);
      open ? next.add(key) : next.delete(key);
      return next;
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="arquivado">Arquivado</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 ml-auto">
          <Button
            variant={modoFoco ? "default" : "ghost"}
            size="sm"
            className="h-7 text-[10px] gap-1"
            onClick={() => setModoFoco(v => !v)}
          >
            <BarChart3 className="h-3 w-3" /> Foco
          </Button>
          <Badge variant="outline" className="text-xs">{filtered.length} doc{filtered.length !== 1 ? "s" : ""}</Badge>
        </div>
      </div>

      {/* Modo Foco - Category Chart */}
      {modoFoco && (
        <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Distribuição por Categoria</p>
          {chartData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum documento para exibir.</p>
          ) : (
            <div className="space-y-1.5">
              {chartData.map(c => (
                <button
                  key={c.value}
                  onClick={() => setFiltroCategoria(filtroCategoria === c.value ? "all" : c.value)}
                  className={`w-full text-left group ${filtroCategoria === c.value ? "ring-1 ring-primary rounded-md" : ""}`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    {getCategoriaIcon(c.value)}
                    <span className="flex-1 truncate font-medium">{c.label}</span>
                    <span className="text-muted-foreground tabular-nums">{c.count}</span>
                  </div>
                  <div className="mt-0.5 h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${CATEGORIA_COLORS[c.value] || "bg-gray-400"}`}
                      style={{ width: `${Math.max(c.pct, 3)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Nenhum documento vinculado a este produto.</div>
      ) : (
        <ScrollArea className="max-h-[350px]">
          <div className="space-y-2">
            {mpGroups.map(group => {
              const mpKey = group.mp ? group.mp.id : "geral";
              return (
                <Collapsible
                  key={mpKey}
                  open={openMPs.has(mpKey)}
                  onOpenChange={(open) => toggleMP(mpKey, open)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full border rounded-md px-3 py-2 flex items-center gap-2 hover:bg-muted/30 transition-colors text-left">
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${openMPs.has(mpKey) ? "rotate-90" : ""}`} />
                      {group.mp ? (
                        <FlaskConical className="h-4 w-4 text-amber-600 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-xs font-medium truncate flex-1">
                        {group.mp ? `${group.mp.codigo} - ${group.mp.nome}` : "Documentos Gerais"}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{group.docs.length}</Badge>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-1 ml-6 mt-1">
                      {group.docs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.nome_arquivo}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatFileSize(doc.tamanho)} • {doc.enviado_por_nome || "—"} • {format(new Date(doc.created_at), "dd/MM/yy", { locale: ptBR })}
                            </p>
                          </div>
                          <Badge variant={doc.status === "aprovado" ? "success" : doc.status === "arquivado" ? "ghost" : "secondary"} className="text-[10px] shrink-0">
                            {doc.status}
                          </Badge>
                          <Select value={doc.categoria} onValueChange={v => handleCategorizar(doc.id, v)}>
                            <SelectTrigger className="h-7 w-28 text-[10px]"><Tag className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-0.5">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(doc)} title="Download">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            {doc.status === "ativo" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleAprovar(doc.id)} title="Aprovar">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {doc.status !== "arquivado" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleArquivar(doc.id)} title="Arquivar">
                                <Archive className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
