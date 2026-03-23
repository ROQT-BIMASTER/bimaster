import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldAlert, Sparkles, Loader2, CheckCircle2, AlertTriangle, Lightbulb, KeyRound } from "lucide-react";
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

function formatChaveAcesso(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 44);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function DocumentAuditCard({ item, onChaveAcessoChange }: DocumentAuditCardProps) {
  const { audit, isAuditing, auditResult } = useDocumentAudit();
  const [chaveAcesso, setChaveAcesso] = useState((item as any).chave_acesso_nfe || "");
  const [showSuggestion, setShowSuggestion] = useState(true);

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

  const handleChaveChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 44);
    setChaveAcesso(digits);
    onChaveAcessoChange?.(digits);
  };

  const handleApplySuggestion = () => {
    if (auditResult?.extracted_chave_acesso) {
      const digits = auditResult.extracted_chave_acesso.replace(/\D/g, "").slice(0, 44);
      setChaveAcesso(digits);
      onChaveAcessoChange?.(digits);
      setShowSuggestion(false);
    }
  };

  const suggestedChave = auditResult?.extracted_chave_acesso?.replace(/\D/g, "");
  const hasSuggestion = suggestedChave && suggestedChave.length === 44 && suggestedChave !== chaveAcesso && showSuggestion;

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
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">Chave de Acesso NF-e</Label>
          </div>
          <Input
            value={formatChaveAcesso(chaveAcesso)}
            onChange={(e) => handleChaveChange(e.target.value)}
            placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
            className="font-mono text-xs h-8"
            maxLength={55}
          />
          {chaveAcesso && chaveAcesso.length < 44 && (
            <p className="text-[10px] text-muted-foreground">{chaveAcesso.length}/44 dígitos</p>
          )}
          {chaveAcesso && chaveAcesso.length === 44 && (
            <p className="text-[10px] text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Chave completa
            </p>
          )}
        </div>

        {/* AI Suggestion for chave de acesso */}
        {hasSuggestion && (
          <div className="flex items-start gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
            <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="text-primary font-medium">Sugestão IA: Chave de Acesso detectada</p>
              <p className="text-muted-foreground font-mono break-all">{formatChaveAcesso(suggestedChave)}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleApplySuggestion}
              className="h-6 px-2 text-xs"
            >
              Aplicar
            </Button>
          </div>
        )}
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
