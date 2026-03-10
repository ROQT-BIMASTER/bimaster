import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Package, Barcode, FileText, Image, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { ChinaGradeView } from "@/components/china/ChinaGradeView";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES, STATUS_LABELS } from "@/lib/china-document-types";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { Loader2 } from "lucide-react";

export default function ChinaSubmissaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: submissao, isLoading } = useQuery({
    queryKey: ["china-submissao", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_submissoes" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: cores = [] } = useQuery({
    queryKey: ["china-cores", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_cores" as any)
        .select("*")
        .eq("submissao_id", id)
        .order("ordem" as any);
      return (data || []) as any[];
    },
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ["china-docs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_documentos" as any)
        .select("*")
        .eq("submissao_id", id);
      return (data || []) as any[];
    },
  });

  const handleDownloadArte = async () => {
    if (submissao?.arte_final_path) {
      const { signedUrl } = await getSignedUrl("china-documentos", submissao.arte_final_path);
      if (signedUrl) window.open(signedUrl, "_blank");
    } else if (submissao?.arte_final_url) {
      window.open(submissao.arte_final_url, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!submissao) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <p className="text-muted-foreground">Submissão não encontrada 未找到提交</p>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[submissao.status] || STATUS_LABELS.rascunho;
  const rejectedDocs = documentos.filter((d: any) => d.status === "rejeitado");

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica-china")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{submissao.produto_codigo}</h1>
            <p className="text-muted-foreground">{submissao.produto_nome}</p>
          </div>
          <Badge variant={statusInfo.variant} className="text-sm px-3 py-1">
            {statusInfo.pt} {statusInfo.cn}
          </Badge>
          <ManualFabricaDrawer screen="china-ficha-produto" />
        </div>

        {/* Arte Final + EAN Section */}
        {submissao.status === "arte_enviada" && (
          <Card className="p-6 border-success/30 bg-success/5">
            <BilingualLabel pt="Arte Final e EAN" cn="终稿和EAN" size="lg" className="mb-4" />
            <div className="flex flex-col md:flex-row gap-4">
              {submissao.arte_final_path && (
                <Button onClick={handleDownloadArte} variant="default" className="gap-2">
                  <Download className="h-4 w-4" />
                  Baixar Arte Final 下载终稿
                </Button>
              )}
              {(submissao.ean_display || submissao.ean_caixa_master) && (
                <div className="flex flex-wrap gap-3">
                  {(submissao as any).ean_display && (
                    <div className="flex items-center gap-3 p-4 bg-background rounded-xl border">
                      <Barcode className="h-6 w-6 text-accent" />
                      <div>
                        <p className="text-xs text-muted-foreground">EAN Display 展示EAN</p>
                        <p className="text-xl font-mono font-bold text-foreground">{(submissao as any).ean_display}</p>
                      </div>
                    </div>
                  )}
                  {submissao.ean_caixa_master && (
                    <div className="flex items-center gap-3 p-4 bg-background rounded-xl border">
                      <Barcode className="h-6 w-6 text-warning" />
                      <div>
                        <p className="text-xs text-muted-foreground">EAN Caixa Master 主箱EAN</p>
                        <p className="text-xl font-mono font-bold text-foreground">{submissao.ean_caixa_master}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {submissao.arte_final_enviada_em && (
              <p className="text-xs text-muted-foreground mt-2">
                Enviado em 发送于: {new Date(submissao.arte_final_enviada_em).toLocaleDateString("pt-BR")}
              </p>
            )}
          </Card>
        )}

        {/* Product Info */}
        <Card className="p-6">
          <BilingualLabel pt="Dados do Produto" cn="产品数据" size="md" className="mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Qty Total 总量</p>
              <p className="text-lg font-bold">{submissao.qty_total?.toLocaleString() || "—"}</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Bruto 毛重</p>
              <p className="text-lg font-bold">{submissao.peso_bruto_g ? `${submissao.peso_bruto_g}g` : "—"}</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Líquido 净重</p>
              <p className="text-lg font-bold">{submissao.peso_liquido_g ? `${submissao.peso_liquido_g}g` : "—"}</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Tester 试用</p>
              <p className="text-lg font-bold">{submissao.peso_tester_g ? `${submissao.peso_tester_g}g` : "—"}</p>
            </div>
          </div>
        </Card>

        {/* Grade */}
        {cores.length > 0 && (
          <ChinaGradeView items={cores.map((c: any) => ({
            cor_nome: c.cor_nome,
            cor_hex: c.cor_hex,
            cor_numero: c.cor_numero,
            codigo_produto: c.codigo_produto,
            codigo_barras_ean: c.codigo_barras_ean,
            quantidade: c.quantidade,
            grupo: c.grupo,
          }))} />
        )}

        {/* Documents by Category */}
        {DOCUMENT_CATEGORIES.map((cat) => {
          const catDocs = CHINA_DOCUMENT_TYPES.filter(d => cat.tipos.includes(d.tipo));
          return (
            <Card key={cat.key} className="p-6">
              <BilingualLabel pt={cat.labelPt} cn={cat.labelCn} size="md" className="mb-3" />
              <div className="space-y-2">
                {catDocs.map((config) => {
                  const doc = documentos.find((d: any) => d.tipo_documento === config.tipo);
                  return (
                    <div key={config.tipo} className="flex items-center gap-3 p-3 bg-card border rounded-lg">
                      <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        {config.icon}
                      </div>
                      <BilingualLabel pt={config.labelPt} cn={config.labelCn} size="sm" className="flex-1" />
                      {doc ? (
                        <Badge
                          variant={doc.status === "aprovado" ? "success" : doc.status === "rejeitado" ? "destructive" : "warning"}
                          className="text-[10px]"
                        >
                          {doc.status === "aprovado" ? "✓ Aprovado" : doc.status === "rejeitado" ? "✗ Rejeitado" : "● Pendente"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          <Clock className="h-3 w-3 mr-1" /> Aguardando
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}

        {/* Rejected Document Feedback */}
        {rejectedDocs.length > 0 && (
          <Card className="p-6 border-destructive/30 bg-destructive/5">
            <BilingualLabel pt="Documentos Rejeitados" cn="被拒绝的文件" size="md" className="mb-3" />
            <div className="space-y-2">
              {rejectedDocs.map((doc: any) => {
                const config = CHINA_DOCUMENT_TYPES.find(d => d.tipo === doc.tipo_documento);
                return (
                  <div key={doc.id} className="p-3 bg-background rounded-lg border border-destructive/20">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      <span className="font-medium text-sm">{config?.labelPt || doc.tipo_documento}</span>
                    </div>
                    {doc.observacao && (
                      <p className="text-sm text-destructive mt-1 ml-6">{doc.observacao}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Brazil Observations */}
        {submissao.observacoes_brasil && (
          <Card className="p-6 border-warning/30 bg-warning/5">
            <BilingualLabel pt="Observações do Brasil" cn="巴西备注" size="md" className="mb-2" />
            <p className="text-sm">{submissao.observacoes_brasil}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
