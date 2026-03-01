import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Shield, Loader2, FileText, Download, Eye, X, Share2,
  CheckCircle2, Archive, Tag, FlaskConical, Receipt, FileCheck, File,
  BarChart3, Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoId: string;
  produtoNome?: string;
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
  lote: string | null;
  created_at: string;
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
  orcamento: "bg-blue-500", nf: "bg-orange-500", art: "bg-red-500",
  embalagem_tampa: "bg-teal-500", embalagem_frasco: "bg-teal-400",
  embalagem_rotulo: "bg-teal-600", embalagem_caixa: "bg-teal-300",
  materia_prima: "bg-amber-500", evidencia: "bg-green-500",
  contrato: "bg-purple-500", geral: "bg-gray-400",
};

function getCategoriaIcon(cat: string) {
  switch (cat) {
    case "orcamento": return <Receipt className="h-4 w-4 text-blue-600" />;
    case "evidencia": return <FileCheck className="h-4 w-4 text-green-600" />;
    case "nf": return <FileText className="h-4 w-4 text-orange-600" />;
    case "contrato": return <Shield className="h-4 w-4 text-purple-600" />;
    case "art": return <FileCheck className="h-4 w-4 text-red-600" />;
    case "materia_prima": return <FlaskConical className="h-4 w-4 text-amber-600" />;
    case "embalagem_tampa": case "embalagem_frasco":
    case "embalagem_rotulo": case "embalagem_caixa":
      return <Tag className="h-4 w-4 text-teal-600" />;
    default: return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

function getCategoriaLabel(cat: string) {
  return CATEGORIAS.find(c => c.value === cat)?.label || cat;
}

export function CofreFullscreenModal({ open, onOpenChange, produtoId, produtoNome }: Props) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroLote, setFiltroLote] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loteEditDoc, setLoteEditDoc] = useState<string | null>(null);
  const [loteEditValue, setLoteEditValue] = useState("");

  const carregar = useCallback(async () => {
    if (!produtoId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fabrica_revisao_documentos" as any)
        .select("*")
        .eq("produto_id", produtoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDocumentos((data as any[]) || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [produtoId]);

  useEffect(() => {
    if (open) { carregar(); setSelectedIds(new Set()); setPreviewUrl(null); }
  }, [open, carregar]);

  // Unique lotes
  const lotes = useMemo(() => {
    const set = new Set<string>();
    documentos.forEach(d => { if (d.lote) set.add(d.lote); });
    return Array.from(set).sort();
  }, [documentos]);

  const filtered = useMemo(() => documentos.filter(d => {
    if (filtroCategoria !== "all" && d.categoria !== filtroCategoria) return false;
    if (filtroLote !== "all" && (d.lote || "") !== filtroLote) return false;
    return true;
  }), [documentos, filtroCategoria, filtroLote]);

  // Chart data
  const chartData = useMemo(() => {
    const counts = new Map<string, number>();
    documentos.forEach(d => counts.set(d.categoria, (counts.get(d.categoria) || 0) + 1));
    const total = documentos.length || 1;
    return CATEGORIAS
      .map(c => ({ ...c, count: counts.get(c.value) || 0, pct: ((counts.get(c.value) || 0) / total) * 100 }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [documentos]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(d => d.id)));
  };

  const handlePreview = async (doc: Documento) => {
    setPreviewLoading(true);
    setPreviewName(doc.nome_arquivo);
    try {
      const { data } = await supabase.storage.from("fabrica-revisao-docs").createSignedUrl(doc.arquivo_path, 3600);
      if (data?.signedUrl) setPreviewUrl(data.signedUrl);
      else toast.error("Erro ao gerar preview");
    } catch { toast.error("Erro ao gerar preview"); }
    finally { setPreviewLoading(false); }
  };

  const handleDownload = async (doc: Documento) => {
    const { data } = await supabase.storage.from("fabrica-revisao-docs").createSignedUrl(doc.arquivo_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link");
  };

  const handleSaveLote = async (docId: string) => {
    await supabase.from("fabrica_revisao_documentos" as any)
      .update({ lote: loteEditValue.trim() || null } as any)
      .eq("id", docId);
    toast.success("Lote atualizado");
    setLoteEditDoc(null);
    carregar();
  };

  const handleShareWhatsApp = async () => {
    const selectedDocs = documentos.filter(d => selectedIds.has(d.id));
    if (selectedDocs.length === 0) { toast.error("Selecione ao menos um documento"); return; }

    // Generate signed URLs
    const links: string[] = [];
    for (const doc of selectedDocs) {
      const { data } = await supabase.storage.from("fabrica-revisao-docs").createSignedUrl(doc.arquivo_path, 86400);
      if (data?.signedUrl) links.push(`📄 ${doc.nome_arquivo} (${getCategoriaLabel(doc.categoria)}):\n${data.signedUrl}`);
    }

    const lotesUsados = [...new Set(selectedDocs.map(d => d.lote).filter(Boolean))];
    const loteTexto = lotesUsados.length > 0 ? `\n🏷️ Lote(s): ${lotesUsados.join(", ")}` : "";

    const mensagem = `🔒 *Cofre de Documentos*\n📦 Produto: ${produtoNome || "—"}${loteTexto}\n\n${links.join("\n\n")}\n\n_${selectedDocs.length} documento(s) compartilhado(s)_`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank");
  };

  const isImage = (tipo: string) => tipo?.startsWith("image/");
  const isPdf = (tipo: string) => tipo === "application/pdf";
  const canPreview = (tipo: string) => isImage(tipo) || isPdf(tipo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-orange-600" />
            Cofre de Documentos
            {produtoNome && <span className="text-muted-foreground font-normal">— {produtoNome}</span>}
          </DialogTitle>
          <DialogDescription>
            Visualize, organize por lote e compartilhe documentos do produto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* LEFT - Document list */}
          <div className="flex-1 flex flex-col border-r min-w-0">
            {/* Filters */}
            <div className="px-4 py-3 border-b flex gap-2 flex-wrap items-center shrink-0">
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroLote} onValueChange={setFiltroLote}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Lote" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos lotes</SelectItem>
                  {lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="ml-auto flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button size="sm" className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700" onClick={handleShareWhatsApp}>
                    <Share2 className="h-3.5 w-3.5" /> WhatsApp ({selectedIds.size})
                  </Button>
                )}
                <Badge variant="outline" className="text-xs">{filtered.length} docs</Badge>
              </div>
            </div>

            {/* Chart summary */}
            {documentos.length > 0 && (
              <div className="px-4 py-2 border-b shrink-0">
                <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                  {chartData.map(c => (
                    <button
                      key={c.value}
                      className={`${CATEGORIA_COLORS[c.value]} transition-all hover:opacity-80`}
                      style={{ width: `${c.pct}%`, minWidth: c.count > 0 ? "8px" : "0" }}
                      onClick={() => setFiltroCategoria(filtroCategoria === c.value ? "all" : c.value)}
                      title={`${c.label}: ${c.count}`}
                    />
                  ))}
                </div>
                <div className="flex gap-3 mt-1.5 flex-wrap">
                  {chartData.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setFiltroCategoria(filtroCategoria === c.value ? "all" : c.value)}
                      className={`flex items-center gap-1 text-[10px] ${filtroCategoria === c.value ? "font-bold" : "text-muted-foreground"}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${CATEGORIA_COLORS[c.value]}`} />
                      {c.label} ({c.count})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Select all */}
            <div className="px-4 py-1.5 border-b flex items-center gap-2 shrink-0">
              <Checkbox
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-[10px] text-muted-foreground">Selecionar todos</span>
            </div>

            {/* Document list */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Nenhum documento encontrado.
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {filtered.map(doc => (
                    <div
                      key={doc.id}
                      className={`px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer ${
                        selectedIds.has(doc.id) ? "bg-orange-50 dark:bg-orange-950/20" : ""
                      }`}
                    >
                      <Checkbox
                        checked={selectedIds.has(doc.id)}
                        onCheckedChange={() => toggleSelect(doc.id)}
                      />
                      <div className="shrink-0">{getCategoriaIcon(doc.categoria)}</div>
                      <div className="flex-1 min-w-0" onClick={() => canPreview(doc.tipo_arquivo) && handlePreview(doc)}>
                        <p className="text-sm font-medium truncate">{doc.nome_arquivo}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{getCategoriaLabel(doc.categoria)}</span>
                          <span>•</span>
                          <span>{doc.enviado_por_nome || "—"}</span>
                          <span>•</span>
                          <span>{format(new Date(doc.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                          {doc.lote && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-[9px] py-0 px-1 gap-0.5">
                                <Package className="h-2.5 w-2.5" /> {doc.lote}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Lote edit */}
                      {loteEditDoc === doc.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={loteEditValue}
                            onChange={e => setLoteEditValue(e.target.value)}
                            placeholder="Ex: L2024-001"
                            className="h-7 w-28 text-xs"
                            autoFocus
                            onKeyDown={e => e.key === "Enter" && handleSaveLote(doc.id)}
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSaveLote(doc.id)}>
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setLoteEditDoc(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-muted-foreground"
                          onClick={() => { setLoteEditDoc(doc.id); setLoteEditValue(doc.lote || ""); }}
                        >
                          <Package className="h-3 w-3" /> {doc.lote || "Lote"}
                        </Button>
                      )}

                      <div className="flex gap-0.5 shrink-0">
                        {canPreview(doc.tipo_arquivo) && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handlePreview(doc)} title="Visualizar">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(doc)} title="Download">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* RIGHT - Preview */}
          <div className="w-[45%] flex flex-col min-w-0">
            {previewUrl ? (
              <>
                <div className="px-4 py-2.5 border-b flex items-center gap-2 shrink-0">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium truncate flex-1">{previewName}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPreviewUrl(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex-1 bg-muted/30 overflow-auto">
                  {previewLoading ? (
                    <div className="flex-1 flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : previewName.match(/\.(pdf)$/i) || previewUrl.includes("pdf") ? (
                    <iframe src={previewUrl} className="w-full h-full border-0" title="Preview" />
                  ) : (
                    <div className="flex items-center justify-center h-full p-4">
                      <img src={previewUrl} alt={previewName} className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Eye className="h-10 w-10 opacity-20" />
                <p className="text-sm">Selecione um documento para visualizar</p>
                <p className="text-[10px]">Suporta PDF e imagens</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
