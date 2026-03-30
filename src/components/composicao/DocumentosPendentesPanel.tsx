import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, CheckCircle2, Clock, Sparkles, Eye, Download, ExternalLink, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { toast } from "sonner";

interface Props {
  submissaoId: string;
  onExtractDoc?: (doc: any) => void;
}

export function DocumentosPendentesPanel({ submissaoId, onExtractDoc }: Props) {
  const [docs, setDocs] = useState<any[]>([]);
  const [analyzedIds, setAnalyzedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [submissaoId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Get linked document IDs
      const { data: vinculos } = await (supabase
        .from("china_documento_tarefa_vinculos" as any)
        .select("documento_id, projeto:projetos(nome), secao:projeto_secoes(nome)") as any);

      if (!vinculos || vinculos.length === 0) {
        setDocs([]);
        setLoading(false);
        return;
      }

      const docChecklistMap: Record<string, string[]> = {};
      (vinculos as any[]).forEach((v: any) => {
        const labels: string[] = [];
        if (v.projeto?.nome) labels.push(v.projeto.nome);
        if (v.secao?.nome) labels.push(v.secao.nome);
        const label = labels.join(" › ") || "Vinculado";
        if (!docChecklistMap[v.documento_id]) docChecklistMap[v.documento_id] = [];
        if (!docChecklistMap[v.documento_id].includes(label))
          docChecklistMap[v.documento_id].push(label);
      });

      const docIds = Object.keys(docChecklistMap);

      // 2. Get documents
      const { data: docsData } = await supabase
        .from("china_produto_documentos")
        .select("id, tipo_documento, nome_arquivo, arquivo_url, arquivo_path, status, created_at")
        .eq("submissao_id", submissaoId)
        .in("id", docIds)
        .order("created_at", { ascending: false });

      // 3. Check which docs have been analyzed (audit_logs)
      const { data: auditData } = await (supabase
        .from("audit_logs")
        .select("metadata")
        .eq("action", "extracao_ia_processo")
        .filter("metadata->>submissao_id", "eq", submissaoId) as any);

      const analyzed = new Set<string>();
      (auditData || []).forEach((log: any) => {
        const docId = log.metadata?.documento_id;
        if (docId) analyzed.add(docId);
      });

      setAnalyzedIds(analyzed);
      setDocs((docsData || []).map((d: any) => ({
        ...d,
        checklists: docChecklistMap[d.id] || [],
      })));
    } catch {
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFile = async (doc: any) => {
    try {
      if (doc.arquivo_path) {
        const { signedUrl } = await getSignedUrl("china-documentos", doc.arquivo_path);
        if (signedUrl) window.open(signedUrl, "_blank");
      } else if (doc.arquivo_url) {
        window.open(doc.arquivo_url, "_blank");
      }
    } catch {
      toast.error("Erro ao abrir arquivo");
    }
  };

  const totalDocs = docs.length;
  const analyzedCount = docs.filter(d => analyzedIds.has(d.id)).length;
  const pendingCount = totalDocs - analyzedCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhum documento vinculado</p>
        <p className="text-xs mt-1">Use a tela <strong>Vincular China</strong> para despachar documentos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard title="Total" value={totalDocs} icon={FileText} variant="info" />
        <KpiCard title="Analisados" value={analyzedCount} icon={CheckCircle2} variant="success" />
        <KpiCard title="Pendentes" value={pendingCount} icon={Clock} variant={pendingCount > 0 ? "warning" : "default"} />
      </div>

      {/* Document list */}
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-2">
          {docs.map(doc => {
            const isAnalyzed = analyzedIds.has(doc.id);
            return (
              <Card key={doc.id} className={isAnalyzed ? "border-success/30" : "border-warning/30"}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${isAnalyzed ? "bg-success/10" : "bg-warning/10"}`}>
                    {isAnalyzed
                      ? <CheckCircle2 className="h-4 w-4 text-success" />
                      : <Clock className="h-4 w-4 text-warning" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.nome_arquivo || doc.tipo_documento}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{doc.tipo_documento}</span>
                      {doc.checklists?.map((cl: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal">
                          {cl}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Badge variant={isAnalyzed ? "success" : "warning"} className="text-[10px] shrink-0">
                    {isAnalyzed ? "Analisado" : "Pendente"}
                  </Badge>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenFile(doc)} title="Abrir arquivo">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {!isAnalyzed && onExtractDoc && (
                      <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => onExtractDoc(doc)}>
                        <Sparkles className="h-3 w-3" />
                        Extrair IA
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
