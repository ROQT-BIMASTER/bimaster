import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Download, Search, Loader2, Archive, CheckCircle2,
  FolderOpen, Receipt, FileCheck, File, Shield, ChevronRight, Package, FlaskConical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Documento {
  id: string;
  revisao_id: string | null;
  produto_id: string;
  mensagem_id: string | null;
  materia_prima_id: string | null;
  nome_arquivo: string;
  arquivo_path: string;
  tipo_arquivo: string;
  tamanho: number;
  categoria: string;
  status: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  enviado_por: string | null;
  enviado_por_nome: string | null;
  created_at: string;
}

interface MPInfo {
  id: string;
  nome: string;
  codigo: string;
}

interface MPGroup {
  mp: MPInfo | null; // null = "Documentos Gerais"
  documentos: Documento[];
}

interface ProdutoGroup {
  produto_id: string;
  produto_nome: string;
  produto_codigo: string;
  mpGroups: MPGroup[];
  totalDocs: number;
}

const CATEGORIAS = [
  { value: "all", label: "Todas Categorias" },
  { value: "orcamento", label: "Orçamento" },
  { value: "evidencia", label: "Evidência" },
  { value: "nf", label: "Nota Fiscal" },
  { value: "contrato", label: "Contrato" },
  { value: "geral", label: "Geral" },
];

function getCategoriaIcon(cat: string) {
  switch (cat) {
    case "orcamento": return <Receipt className="h-4 w-4 text-blue-600" />;
    case "evidencia": return <FileCheck className="h-4 w-4 text-green-600" />;
    case "nf": return <FileText className="h-4 w-4 text-orange-600" />;
    case "contrato": return <Shield className="h-4 w-4 text-purple-600" />;
    default: return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function DocumentoRow({ doc, onDownload, onArquivar }: { doc: Documento; onDownload: (d: Documento) => void; onArquivar: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
      {getCategoriaIcon(doc.categoria)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.nome_arquivo}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="capitalize">{doc.categoria}</span>
          <span>•</span>
          <span>{formatFileSize(doc.tamanho)}</span>
          <span>•</span>
          <span>{doc.enviado_por_nome || "—"}</span>
          <span>•</span>
          <span>{format(new Date(doc.created_at), "dd/MM/yy", { locale: ptBR })}</span>
        </div>
      </div>
      <Badge variant={doc.status === "aprovado" ? "success" : doc.status === "arquivado" ? "ghost" : "secondary"} className="text-[10px]">
        {doc.status === "aprovado" && <CheckCircle2 className="h-3 w-3 mr-0.5" />}
        {doc.status}
      </Badge>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(doc)} title="Download">
          <Download className="h-3.5 w-3.5" />
        </Button>
        {doc.status !== "arquivado" && (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onArquivar(doc.id)} title="Arquivar">
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function DocumentosCofre() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [produtos, setProdutos] = useState<Map<string, { nome: string; codigo: string }>>(new Map());
  const [materiasPrimas, setMateriasPrimas] = useState<Map<string, MPInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("aprovado");
  const [openProdutos, setOpenProdutos] = useState<Set<string>>(new Set());
  const [openMPs, setOpenMPs] = useState<Set<string>>(new Set());

  const carregarDocumentos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fabrica_revisao_documentos" as any)
        .select("*")
        .in("status", filtroStatus === "all" ? ["ativo", "aprovado", "arquivado"] : [filtroStatus])
        .order("created_at", { ascending: false });

      if (error) throw error;
      const docs = (data as any[]) || [];
      setDocumentos(docs);

      // Load product names
      const produtoIds = [...new Set(docs.map(d => d.produto_id))];
      if (produtoIds.length > 0) {
        const { data: prods } = await supabase
          .from("fabrica_produtos")
          .select("id, nome, codigo")
          .in("id", produtoIds);
        const map = new Map<string, { nome: string; codigo: string }>();
        (prods || []).forEach((p: any) => map.set(p.id, { nome: p.nome, codigo: p.codigo }));
        setProdutos(map);
      }

      // Load materia prima names
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
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => { carregarDocumentos(); }, [carregarDocumentos]);

  const handleDownload = async (doc: Documento) => {
    const { data } = await supabase.storage
      .from("fabrica-revisao-docs")
      .createSignedUrl(doc.arquivo_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link de download");
  };

  const handleArquivar = async (docId: string) => {
    try {
      await supabase
        .from("fabrica_revisao_documentos" as any)
        .update({ status: "arquivado" } as any)
        .eq("id", docId);
      toast.success("Documento arquivado");
      carregarDocumentos();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const grouped = useMemo((): ProdutoGroup[] => {
    const filtered = documentos.filter(d => {
      const prod = produtos.get(d.produto_id);
      const mp = d.materia_prima_id ? materiasPrimas.get(d.materia_prima_id) : null;
      const matchBusca = !busca || 
        prod?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        prod?.codigo?.toLowerCase().includes(busca.toLowerCase()) ||
        mp?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        d.nome_arquivo.toLowerCase().includes(busca.toLowerCase());
      const matchCat = filtroCategoria === "all" || d.categoria === filtroCategoria;
      return matchBusca && matchCat;
    });

    // Group by produto, then by materia_prima
    const prodMap = new Map<string, { docs: Documento[] }>();
    filtered.forEach(doc => {
      if (!prodMap.has(doc.produto_id)) {
        prodMap.set(doc.produto_id, { docs: [] });
      }
      prodMap.get(doc.produto_id)!.docs.push(doc);
    });

    return Array.from(prodMap.entries()).map(([prodId, { docs }]) => {
      const prod = produtos.get(prodId);
      
      // Sub-group by materia_prima_id
      const mpGroupMap = new Map<string | "geral", Documento[]>();
      docs.forEach(doc => {
        const key = doc.materia_prima_id || "geral";
        if (!mpGroupMap.has(key)) mpGroupMap.set(key, []);
        mpGroupMap.get(key)!.push(doc);
      });

      const mpGroups: MPGroup[] = [];
      // MPs first
      mpGroupMap.forEach((mpDocs, key) => {
        if (key !== "geral") {
          mpGroups.push({ mp: materiasPrimas.get(key) || { id: key, nome: "MP Desconhecida", codigo: "" }, documentos: mpDocs });
        }
      });
      // Sort MPs by name
      mpGroups.sort((a, b) => (a.mp?.nome || "").localeCompare(b.mp?.nome || ""));
      // "Geral" last
      const gerais = mpGroupMap.get("geral");
      if (gerais) {
        mpGroups.push({ mp: null, documentos: gerais });
      }

      return {
        produto_id: prodId,
        produto_nome: prod?.nome || "Produto",
        produto_codigo: prod?.codigo || "",
        mpGroups,
        totalDocs: docs.length,
      };
    }).sort((a, b) => a.produto_nome.localeCompare(b.produto_nome));
  }, [documentos, produtos, materiasPrimas, busca, filtroCategoria]);

  const totalDocs = documentos.length;

  const toggleProduto = (id: string, open: boolean) => {
    setOpenProdutos(prev => {
      const next = new Set(prev);
      open ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const toggleMP = (key: string, open: boolean) => {
    setOpenMPs(prev => {
      const next = new Set(prev);
      open ? next.add(key) : next.delete(key);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Cofre de Documentos
            <Badge variant="secondary" className="text-xs">{totalDocs} documento{totalDocs !== 1 ? "s" : ""}</Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por produto, MP ou arquivo..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="aprovado">Aprovados</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="arquivado">Arquivados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum documento encontrado.
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-3">
              {grouped.map(group => (
                <Collapsible
                  key={group.produto_id}
                  open={openProdutos.has(group.produto_id)}
                  onOpenChange={(open) => toggleProduto(group.produto_id, open)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full border rounded-lg px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors text-left">
                      <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openProdutos.has(group.produto_id) ? "rotate-90" : ""}`} />
                      <Package className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{group.produto_nome}</p>
                        <p className="text-[10px] text-muted-foreground">{group.produto_codigo}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {group.totalDocs} doc{group.totalDocs !== 1 ? "s" : ""}
                      </Badge>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 mt-1 space-y-1">
                      {group.mpGroups.map(mpGroup => {
                        const mpKey = mpGroup.mp ? mpGroup.mp.id : `${group.produto_id}-geral`;
                        return (
                          <Collapsible
                            key={mpKey}
                            open={openMPs.has(mpKey)}
                            onOpenChange={(open) => toggleMP(mpKey, open)}
                          >
                            <CollapsibleTrigger asChild>
                              <button className="w-full border rounded-md px-3 py-2 flex items-center gap-2 hover:bg-muted/30 transition-colors text-left">
                                <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${openMPs.has(mpKey) ? "rotate-90" : ""}`} />
                                {mpGroup.mp ? (
                                  <FlaskConical className="h-4 w-4 text-amber-600 shrink-0" />
                                ) : (
                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">
                                    {mpGroup.mp ? `${mpGroup.mp.codigo} - ${mpGroup.mp.nome}` : "Documentos Gerais"}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  {mpGroup.documentos.length}
                                </Badge>
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="border border-t-0 rounded-b-md divide-y ml-3">
                                {mpGroup.documentos.map(doc => (
                                  <DocumentoRow key={doc.id} doc={doc} onDownload={handleDownload} onArquivar={handleArquivar} />
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
