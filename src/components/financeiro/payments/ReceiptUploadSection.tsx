import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  Send,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveStorageUrl } from "@/lib/utils/storage-url";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReceiptUploadSectionProps {
  paymentId: string;
  receiptUrl: string | null;
  receiptSentAt: string | null;
  requestedBy: string | null;
  requesterName: string | null;
  supplierName: string;
  amount: number;
  code: string;
  onReceiptUploaded: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function ReceiptUploadSection({
  paymentId,
  receiptUrl,
  receiptSentAt,
  requestedBy,
  requesterName,
  supplierName,
  amount,
  code,
  onReceiptUploaded,
}: ReceiptUploadSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-comprovante.${ext}`;
      const filePath = `receipts/${paymentId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("event-expense-docs")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      // Gerar signed URL em vez de URL pública
      const { data: signedData, error: signError } = await supabase.storage
        .from("event-expense-docs")
        .createSignedUrl(filePath, 31536000); // 1 ano

      if (signError || !signedData?.signedUrl) throw signError || new Error('Failed to generate signed URL');

      // Update the payment queue record with signed URL
      const { error: updateError } = await supabase
        .from("financial_payment_queue")
        .update({ receipt_url: signedData.signedUrl })
        .eq("id", paymentId);

      if (updateError) throw updateError;

      toast.success("Comprovante anexado com sucesso!");
      onReceiptUploaded();
    } catch (err: any) {
      console.error("Error uploading receipt:", err);
      toast.error(err.message || "Erro ao enviar comprovante");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleViewReceipt = async () => {
    if (!receiptUrl) return;
    setViewingReceipt(true);
    try {
      const { signedUrl, error } = await resolveStorageUrl(receiptUrl);
      if (error || !signedUrl) {
        toast.error(error || "Não foi possível abrir o comprovante");
        return;
      }
      window.open(signedUrl, "_blank");
    } catch {
      toast.error("Erro ao abrir comprovante");
    } finally {
      setViewingReceipt(false);
    }
  };

  const handleSendToRequester = async () => {
    if (!requestedBy || !receiptUrl) {
      toast.error("Não é possível enviar: solicitante ou comprovante não encontrado.");
      return;
    }

    setSending(true);
    try {
      // Create notification for requester
      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: requestedBy,
        title: "Comprovante de Pagamento Disponível",
        message: `O comprovante de pagamento ${code} para ${supplierName} no valor de ${formatCurrency(amount)} foi anexado. Clique para visualizar.`,
        type: "payment_receipt",
        action_url: `/dashboard/financeiro/central-pagamentos`,
      });

      if (notifError) throw notifError;

      // Update receipt_sent_at
      const { error: updateError } = await supabase
        .from("financial_payment_queue")
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq("id", paymentId);

      if (updateError) throw updateError;

      toast.success(
        `Comprovante enviado para ${requesterName || "o solicitante"}!`
      );
      onReceiptUploaded();
    } catch (err: any) {
      console.error("Error sending receipt:", err);
      toast.error(err.message || "Erro ao enviar comprovante");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <Label className="font-medium">Comprovante de Pagamento</Label>
        </div>

        {!receiptUrl ? (
          /* No receipt yet - show upload */
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Anexe o comprovante de pagamento realizado no banco.
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleUploadReceipt}
                className="hidden"
                id="receipt-upload"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-1.5"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploading ? "Enviando..." : "Anexar Comprovante"}
              </Button>
              <span className="text-xs text-muted-foreground">
                PDF, JPG ou PNG (máx. 10MB)
              </span>
            </div>
          </div>
        ) : (
          /* Receipt uploaded */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Comprovante anexado
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewReceipt}
                disabled={viewingReceipt}
                className="gap-1 text-xs"
              >
                {viewingReceipt ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ExternalLink className="h-3 w-3" />
                )}
                Visualizar
              </Button>
            </div>

            {/* Option to re-upload */}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleUploadReceipt}
                className="hidden"
                id="receipt-reupload"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-1 text-xs text-muted-foreground"
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                Substituir comprovante
              </Button>
            </div>

            {/* Send to requester */}
            {requestedBy && (
              <div className="pt-2 border-t space-y-2">
                {receiptSentAt ? (
                  <Alert className="border-emerald-500/50">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="text-sm">
                      Comprovante enviado para{" "}
                      <strong>{requesterName || "o solicitante"}</strong> em{" "}
                      {format(new Date(receiptSentAt), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSendToRequester}
                  disabled={sending}
                  className="gap-1.5 w-full"
                >
                  {sending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {receiptSentAt
                    ? "Reenviar Comprovante ao Solicitante"
                    : "Enviar Comprovante ao Solicitante"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
