import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Download, Loader2, CheckCircle2, Archive,
  Receipt, FileCheck, File, Shield, Tag,
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
  created_at: string;
}

const CATEGORIAS = ["orcamento", "evidencia", "nf", "contrato", "geral"];

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

export function DocumentosTab({ produtoId }: Props) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");

  const carregar = useCallback(async () => {
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

  // Group by category
  const grouped = CATEGORIAS.reduce((acc, cat) => {
    const docs = filtered.filter(d => d.categoria === cat);
    if (docs.length > 0) acc.push({ categoria: cat, docs });
    return acc;
  }, [] as { categoria: string; docs: Documento[] }[]);

  if (loading) {
    return <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
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
        <Badge variant="outline" className="text-xs ml-auto">{filtered.length} documento{filtered.length !== 1 ? "s" : ""}</Badge>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Nenhum documento vinculado a este produto.</div>
      ) : (
        <ScrollArea className="max-h-[350px]">
          <div className="space-y-3">
            {grouped.map(g => (
              <div key={g.categoria}>
                <div className="flex items-center gap-2 mb-1.5">
                  {getCategoriaIcon(g.categoria)}
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{g.categoria}</span>
                  <Badge variant="secondary" className="text-[10px]">{g.docs.length}</Badge>
                </div>
                <div className="space-y-1 ml-6">
                  {g.docs.map(doc => (
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
                        <SelectTrigger className="h-7 w-24 text-[10px]"><Tag className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS.map(c => <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>)}
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
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
