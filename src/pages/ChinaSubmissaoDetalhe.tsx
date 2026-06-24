import { useParams, useNavigate } from "react-router-dom";
import {
  Download,
  Barcode,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { ChinaGradeView } from "@/components/china/ChinaGradeView";
import {
  CHINA_DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  STATUS_LABELS,
} from "@/lib/china-document-types";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { ChinaTimelineButton } from "@/components/china/timeline/ChinaTimelineButton";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { Loader2 } from "lucide-react";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { useResolvedBackTo } from "@/lib/navigation/withReturnTo";
import { useChinaI18n } from "@/hooks/useChinaI18n";
import { cn } from "@/lib/utils";

export default function ChinaSubmissaoDetalhe() {
  const { t } = useChinaI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { backTo } = useResolvedBackTo("/dashboard/fabrica-china");
  const { isFieldVisible } = useFieldVisibility("china_ficha");

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
      <ChinaPageShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ChinaPageShell>
    );
  }

  if (!submissao) {
    return (
      <ChinaPageShell>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t("submissaoDetalhe.naoEncontrada")}</p>
        </div>
      </ChinaPageShell>
    );
  }

  const statusInfo = STATUS_LABELS[submissao.status] || STATUS_LABELS.rascunho;
  const rejectedDocs = documentos.filter((d: any) => d.status === "rejeitado");
  const needsCorrection =
    submissao.status === "retornado" ||
    submissao.status === "rejeitado" ||
    rejectedDocs.length > 0;

  const goCorrigir = (tipo?: string) => {
    const search = tipo ? `?focus=${encodeURIComponent(tipo)}` : "";
    navigate(`/dashboard/fabrica-china/nova/${id}${search}`, {
      state: { from: backTo },
    });
  };

  const firstRejectedTipo = rejectedDocs[0]?.tipo_documento as string | undefined;

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt={submissao.produto_codigo}
        titleCn={submissao.produto_nome}
        icon={FileText}
        iconTone="primary"
        showBack
        backTo={backTo}
        actions={
          <>
            <Badge variant={statusInfo.variant} className="text-sm px-3 py-1">
              <BilingualLabel pt={statusInfo.pt} cn={statusInfo.cn} en={statusInfo.en} size="sm" className="!flex-row gap-1" />
            </Badge>
            {needsCorrection && (
              <Button
                onClick={() => goCorrigir(firstRejectedTipo)}
                size="sm"
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                {t("submissaoDetalhe.corrigirSubmissao")}
              </Button>
            )}
            <ChinaTimelineButton scope={{ submissaoId: submissao.id }} />
            <ManualFabricaDrawer screen="china-ficha-produto" />
          </>
        }
      />

      {/* Banner: ajustes solicitados pelo Brasil */}
      {needsCorrection && (
        <Card className="p-6 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <BilingualLabel
                  pt="Ajustes solicitados pelo Brasil"
                  cn="巴西要求的调整"
                  en="Adjustments requested by Brazil"
                  size="md"
                />
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rejectedDocs.length > 0
                    ? t("submissaoDetalhe.ajustesDescPlural", { count: rejectedDocs.length })
                    : t("submissaoDetalhe.ajustesDescGenerico")}
                </p>
              </div>

              {submissao.observacoes_brasil && (
                <div className="p-3 rounded-lg bg-background border border-destructive/20">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                    {t("submissaoDetalhe.observacaoBrasil")}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {submissao.observacoes_brasil}
                  </p>
                </div>
              )}

              {rejectedDocs.length > 0 && (
                <ul className="space-y-1.5">
                  {rejectedDocs.map((doc: any) => {
                    const config = CHINA_DOCUMENT_TYPES.find(
                      (d) => d.tipo === doc.tipo_documento,
                    );
                    return (
                      <li key={doc.id} className="text-sm flex items-start gap-2">
                        <span className="text-destructive mt-0.5">•</span>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(
                              `doc-${doc.tipo_documento}`,
                            );
                            el?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                          }}
                          className="text-left underline-offset-2 hover:underline"
                        >
                          <span className="font-medium">
                            {config?.labelPt || doc.tipo_documento}
                          </span>
                          {doc.observacao && (
                            <span className="text-muted-foreground">
                              {" — "}
                              {doc.observacao}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  onClick={() => goCorrigir(firstRejectedTipo)}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  {t("submissaoDetalhe.abrirEditorCorrigir")}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Docs Enviados ao Brasil */}
      {submissao.status === "arte_enviada" && (
        <Card className="p-6 border-success/30 bg-success/5">
          <BilingualLabel
            pt="Documentos Enviados ao Brasil"
            cn="已发送至巴西的文件"
            en="Documents Sent to Brazil"
            size="lg"
            className="mb-4"
          />
          <div className="flex flex-col md:flex-row gap-4">
            {submissao.arte_final_path && (
              <Button onClick={handleDownloadArte} variant="default" className="gap-2">
                <Download className="h-4 w-4" />
                {t("submissaoDetalhe.baixarArteFinal")}
              </Button>
            )}
            {(submissao.ean_display || submissao.ean_caixa_master) && (
              <div className="flex flex-wrap gap-3">
                {(submissao as any).ean_display && (
                  <div className="flex items-center gap-3 p-4 bg-background rounded-xl border">
                    <Barcode className="h-6 w-6 text-accent" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("submissaoDetalhe.eanDisplay")}</p>
                      <p className="text-xl font-mono font-bold text-foreground">
                        {(submissao as any).ean_display}
                      </p>
                    </div>
                  </div>
                )}
                {submissao.ean_caixa_master && (
                  <div className="flex items-center gap-3 p-4 bg-background rounded-xl border">
                    <Barcode className="h-6 w-6 text-warning" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("submissaoDetalhe.eanCaixaMaster")}</p>
                      <p className="text-xl font-mono font-bold text-foreground">
                        {submissao.ean_caixa_master}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {submissao.arte_final_enviada_em && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("submissaoDetalhe.enviadoEm")}:{" "}
              {new Date(submissao.arte_final_enviada_em).toLocaleDateString("pt-BR")}
            </p>
          )}
        </Card>
      )}

      {/* Product Info */}
      <Card className="p-6">
        <BilingualLabel pt="Dados do Produto" cn="产品数据" en="Product Data" size="md" className="mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-secondary/50 rounded-lg">
            <p className="text-xs text-muted-foreground">{t("submissaoDetalhe.qtyTotal")}</p>
            <p className="text-lg font-bold">
              {submissao.qty_total?.toLocaleString() || "—"}
            </p>
          </div>
          <div className="p-3 bg-secondary/50 rounded-lg">
            <p className="text-xs text-muted-foreground">{t("submissaoDetalhe.bruto")}</p>
            <p className="text-lg font-bold">
              {submissao.peso_bruto_g ? `${submissao.peso_bruto_g}g` : "—"}
            </p>
          </div>
          <div className="p-3 bg-secondary/50 rounded-lg">
            <p className="text-xs text-muted-foreground">{t("submissaoDetalhe.liquido")}</p>
            <p className="text-lg font-bold">
              {submissao.peso_liquido_g ? `${submissao.peso_liquido_g}g` : "—"}
            </p>
          </div>
          <div className="p-3 bg-secondary/50 rounded-lg">
            <p className="text-xs text-muted-foreground">{t("submissaoDetalhe.tester")}</p>
            <p className="text-lg font-bold">
              {submissao.peso_tester_g ? `${submissao.peso_tester_g}g` : "—"}
            </p>
          </div>
        </div>
      </Card>

      {/* Grade */}
      {cores.length > 0 && (
        <ChinaGradeView
          items={cores.map((c: any) => ({
            cor_nome: c.cor_nome,
            cor_hex: c.cor_hex,
            cor_numero: c.cor_numero,
            codigo_produto: c.codigo_produto,
            codigo_barras_ean: c.codigo_barras_ean,
            quantidade: c.quantidade,
            grupo: c.grupo,
          }))}
        />
      )}

      {/* Documents by Category */}
      {DOCUMENT_CATEGORIES.map((cat) => {
        const catDocs = CHINA_DOCUMENT_TYPES.filter((d) => cat.tipos.includes(d.tipo));
        return (
          <Card key={cat.key} className="p-6">
            <BilingualLabel
              pt={cat.labelPt}
              cn={cat.labelCn}
              size="md"
              className="mb-3"
            />
            <div className="space-y-2">
              {catDocs.map((config) => {
                const doc = documentos.find(
                  (d: any) => d.tipo_documento === config.tipo,
                );
                const isRejected = doc?.status === "rejeitado";
                return (
                  <div
                    key={config.tipo}
                    id={`doc-${config.tipo}`}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors",
                      isRejected && "border-destructive/50 bg-destructive/5 ring-1 ring-destructive/20",
                    )}
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        isRejected ? "bg-destructive/10" : "bg-secondary",
                      )}
                    >
                      {isRejected ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : (
                        config.icon
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <BilingualLabel
                        pt={config.labelPt}
                        cn={config.labelCn}
                        size="sm"
                      />
                      {isRejected && doc?.observacao && (
                        <p className="text-xs text-destructive italic mt-1">
                          {doc.observacao}
                        </p>
                      )}
                    </div>
                    {doc ? (
                      <Badge
                        variant={
                          doc.status === "aprovado"
                            ? "success"
                            : doc.status === "rejeitado"
                            ? "destructive"
                            : "warning"
                        }
                        className="text-[10px]"
                      >
                        {doc.status === "aprovado" ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> {t("submissaoDetalhe.aprovadoBadge")}
                          </>
                        ) : doc.status === "rejeitado" ? (
                          <>✗ {t("submissaoDetalhe.rejeitadoBadge")}</>
                        ) : (
                          <>● {t("submissaoDetalhe.pendenteBadge")}</>
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        <Clock className="h-3 w-3 mr-1" /> {t("submissaoDetalhe.aguardando")}
                      </Badge>
                    )}
                    {isRejected && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5"
                        onClick={() => goCorrigir(config.tipo)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t("submissaoDetalhe.corrigir")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {/* Brazil Observations fallback (sem docs rejeitados, mas com observação) */}
      {!needsCorrection && submissao.observacoes_brasil && (
        <Card className="p-6 border-warning/30 bg-warning/5">
          <BilingualLabel
            pt="Observações do Brasil"
            cn="巴西备注"
            en="Notes from Brazil"
            size="md"
            className="mb-2"
          />
          <p className="text-sm whitespace-pre-wrap">{submissao.observacoes_brasil}</p>
        </Card>
      )}
    </ChinaPageShell>
  );
}
