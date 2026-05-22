/**
 * Admin — Documentação Técnica
 *
 * Catálogo de documentos arquiteturais (espinha dorsal de distribuição,
 * decisões de segurança, planos por fase). Admin lista, visualiza preview
 * Markdown, baixa arquivo e copia link.
 *
 * Padrões Bimaster:
 *  - Acesso protegido por ScreenRoute screenCode="admin" + RLS via has_role
 *  - Download via Blob (triggerBlobDownload), nunca window.open
 *  - Trilha de auditoria em docs_tecnicos_downloads
 */
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Eye, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DocTecnico {
  id: string;
  titulo: string;
  slug: string;
  area: string;
  versao: string;
  descricao: string | null;
  arquivo_storage_path: string;
  mime_type: string;
  tamanho_bytes: number | null;
  publicado_em: string;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DocumentacaoTecnica() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocTecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [areaFiltro, setAreaFiltro] = useState<string>("todas");
  const [previewDoc, setPreviewDoc] = useState<DocTecnico | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("docs_tecnicos")
      .select("id, titulo, slug, area, versao, descricao, arquivo_storage_path, mime_type, tamanho_bytes, publicado_em")
      .eq("publicado", true)
      .order("publicado_em", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar documentos", description: error.message, variant: "destructive" });
    } else {
      setDocs(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const areas = useMemo(() => {
    const set = new Set(docs.map((d) => d.area));
    return ["todas", ...Array.from(set)];
  }, [docs]);

  const docsFiltrados = useMemo(() => {
    return docs.filter((d) => {
      if (areaFiltro !== "todas" && d.area !== areaFiltro) return false;
      if (filtro && !`${d.titulo} ${d.descricao ?? ""}`.toLowerCase().includes(filtro.toLowerCase())) return false;
      return true;
    });
  }, [docs, areaFiltro, filtro]);

  const baixarArquivo = async (doc: DocTecnico) => {
    const { data, error } = await supabase.storage.from("docs-tecnicos").download(doc.arquivo_storage_path);
    if (error || !data) {
      toast({ title: "Falha ao baixar", description: error?.message ?? "Sem dados", variant: "destructive" });
      return;
    }
    const ext = doc.mime_type === "application/pdf" ? "pdf" : "md";
    const filename = `${doc.slug}-v${doc.versao}.${ext}`;
    triggerBlobDownload(data, filename);

    const { data: userRes } = await supabase.auth.getUser();
    if (userRes?.user) {
      await supabase.from("docs_tecnicos_downloads").insert({
        doc_id: doc.id,
        user_id: userRes.user.id,
        formato: ext,
        user_agent: navigator.userAgent.slice(0, 500),
      });
    }
    toast({ title: "Download iniciado", description: filename });
  };

  const abrirPreview = async (doc: DocTecnico) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setPreviewContent("");
    const { data, error } = await supabase.storage.from("docs-tecnicos").download(doc.arquivo_storage_path);
    if (error || !data) {
      toast({ title: "Falha no preview", description: error?.message, variant: "destructive" });
      setPreviewLoading(false);
      return;
    }
    const text = await data.text();
    setPreviewContent(text);
    setPreviewLoading(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentação Técnica</h1>
          <p className="text-muted-foreground mt-1">
            Documentos arquiteturais para revisão por Engenharia, Arquitetura e agentes externos (Cloud Code, Claude Code, Cursor).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por título ou descrição..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="max-w-md"
          />
          <div className="flex gap-2 flex-wrap">
            {areas.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={areaFiltro === a ? "default" : "outline"}
                onClick={() => setAreaFiltro(a)}
              >
                {a}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : docsFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum documento encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {docsFiltrados.map((doc) => (
            <Card key={doc.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="h-6 w-6 text-primary shrink-0 mt-1" />
                    <div>
                      <CardTitle className="text-lg">{doc.titulo}</CardTitle>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary">{doc.area}</Badge>
                        <Badge variant="outline">v{doc.versao}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {doc.descricao && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{doc.descricao}</p>
                )}
                <p className="text-xs text-muted-foreground mb-4">
                  Publicado {formatDistanceToNow(new Date(doc.publicado_em), { locale: ptBR, addSuffix: true })}
                </p>
                <div className="flex gap-2 mt-auto">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => abrirPreview(doc)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => baixarArquivo(doc)}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewDoc?.titulo} — v{previewDoc?.versao}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto pr-2 prose prose-sm dark:prose-invert max-w-none">
            {previewLoading ? (
              <p className="text-muted-foreground">Carregando preview...</p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewContent}</ReactMarkdown>
            )}
          </div>
          {previewDoc && (
            <div className="flex justify-end pt-3 border-t">
              <Button onClick={() => baixarArquivo(previewDoc)}>
                <Download className="h-4 w-4 mr-2" />
                Baixar documento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
