import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, ShieldAlert, Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { ChaveAcessoInput } from "@/components/financeiro/ChaveAcessoInput";
import { useDocumentAudit, type DocumentAuditResult } from "@/hooks/useDocumentAudit";
import type { PaymentQueueItem } from "@/hooks/useFinancialPaymentQueue";

interface DocumentAuditCardProps {
  item: PaymentQueueItem;
  onChaveAcessoChange?: (chave: string) => void;
}

const severityConfig = {
  high: { color: "destructive" as const, label: "Grave" },
  medium: { color: "warning" as const, label: "Atenção" },
  low: { color: "secondary" as const, label: "Leve" },
};

const fieldLabels: Record<string, string> = {
  cnpj: "CNPJ",
  supplier_name: "Nome do Fornecedor",
  amount: "Valor",
  document_number: "Nº Documento",
};

export function DocumentAuditCard({ item, onChaveAcessoChange }: DocumentAuditCardProps) {
  const { audit, isAuditing, auditResult } = useDocumentAudit();

  const attachmentUrl = item.attachment_url || (item.attachments && item.attachments.length > 0 ? item.attachments[0].url : null);

  if (!attachmentUrl) return null;

  const handleAudit = () => {
    audit({
      attachmentUrl,
      supplierName: item.supplier_name,
      supplierDocument: item.supplier_document || undefined,
      amount: item.amount,
      documentNumber: item.document_number || undefined,
      documentType: item.document_type || undefined,
    });
  };


  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Auditor IA de Documentos</span>
          </div>
          {!auditResult && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAudit}
              disabled={isAuditing}
              className="gap-1.5"
            >
              {isAuditing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isAuditing ? "Analisando..." : "Auditar com IA"}
            </Button>
          )}
        </div>

        {isAuditing && (
          <p className="text-xs text-muted-foreground">
            Extraindo dados do documento e confrontando com o lançamento...
          </p>
        )}

        {auditResult && <AuditResultDisplay result={auditResult} />}

        {/* Chave de Acesso NF-e */}
        <div className="pt-1 border-t border-border/50">
          <ChaveAcessoInput
            value={(item as any).chave_acesso_nfe || ""}
            onChange={(v) => onChaveAcessoChange?.(v)}
            aiSuggestion={auditResult?.extracted_chave_acesso}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AuditResultDisplay({ result }: { result: DocumentAuditResult }) {
  const hasHighSeverity = result.divergences.some((d) => d.severity === "high");

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2">
        {result.matches ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">Dados consistentes</span>
            <Badge variant="success" className="text-xs">OK</Badge>
          </>
        ) : (
          <>
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              {result.divergences.length} divergência(s) encontrada(s)
            </span>
            <Badge variant={hasHighSeverity ? "destructive" : "warning"} className="text-xs">
              {hasHighSeverity ? "Crítico" : "Atenção"}
            </Badge>
          </>
        )}
        <Badge variant="outline" className="text-xs ml-auto">
          Confiança: {Math.round(result.confidence * 100)}%
        </Badge>
      </div>

      {/* Divergences */}
      {result.divergences.length > 0 && (
        <div className="space-y-2">
          {result.divergences.map((div, i) => {
            const config = severityConfig[div.severity];
            return (
              <Alert key={i} variant={div.severity === "high" ? "destructive" : "warning"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong>{fieldLabels[div.field] || div.field}:</strong>{" "}
                      <span className="text-muted-foreground">Documento:</span>{" "}
                      <span className="font-mono">{div.found || "N/A"}</span>
                      {" ≠ "}
                      <span className="text-muted-foreground">Lançamento:</span>{" "}
                      <span className="font-mono">{div.expected || "N/A"}</span>
                    </div>
                    <Badge variant={config.color} className="text-[10px] shrink-0">
                      {config.label}
                    </Badge>
                  </div>
                </AlertDescription>
              </Alert>
            );
          })}
        </div>
      )}
    </div>
  );
}
