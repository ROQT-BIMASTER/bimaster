import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { FileDown, FileText, Image as ImageIcon, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import type { PresentationGroup, PresentationPlan } from "@/lib/presentation/types";
import { buildTradePresentationPptx } from "@/lib/presentation/buildPptx";
import { buildTradePresentationPdf } from "@/lib/presentation/buildPdf";
import { buildTradePresentationImageZip } from "@/lib/presentation/buildImageZip";

const MAX_GROUPS = 30;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: PresentationGroup[];
}

function defaultTitle(): string {
  const d = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `Apresentação Trade — ${d}`;
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
    .slice(0, 80) || "apresentacao_trade";
}

export function PresentationPlanDialog({ open, onOpenChange, groups }: Props) {
  const [title, setTitle] = useState(defaultTitle());
  const [client, setClient] = useState("");
  const [objective, setObjective] = useState("");
  const [notesByKey, setNotesByKey] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "pptx" | "pdf" | "zip">(null);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle());
      setClient("");
      setObjective("");
      setNotesByKey({});
      setBusy(null);
    }
  }, [open]);

  const overLimit = groups.length > MAX_GROUPS;
  const exportGroups = useMemo(
    () => (overLimit ? groups.slice(0, MAX_GROUPS) : groups),
    [groups, overLimit],
  );

  const buildPlan = (): PresentationPlan => ({
    title: title.trim() || defaultTitle(),
    client: client.trim() || undefined,
    objective: objective.trim() || undefined,
    notesByKey,
  });

  const handlePptx = async () => {
    setBusy("pptx");
    try {
      const blob = await buildTradePresentationPptx(buildPlan(), exportGroups);
      saveAs(blob, `${slugify(title)}.pptx`);
      toast.success("Apresentação PPTX gerada!");
    } catch (err) {
      console.error("[presentation] PPTX falhou:", err);
      toast.error("Não foi possível gerar o PPTX. Tente novamente.");
    } finally {
      setBusy(null);
    }
  };

  const handlePdf = async () => {
    setBusy("pdf");
    try {
      const blob = await buildTradePresentationPdf(buildPlan(), exportGroups);
      saveAs(blob, `${slugify(title)}.pdf`);
      toast.success("Apresentação PDF gerada!");
    } catch (err) {
      console.error("[presentation] PDF falhou:", err);
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setBusy(null);
    }
  };

  const handleZip = async () => {
    setBusy("zip");
    try {
      const blob = await buildTradePresentationImageZip(buildPlan(), exportGroups);
      saveAs(blob, `${slugify(title)}_imagens.zip`);
      toast.success("Pacote de imagens gerado!");
    } catch (err) {
      console.error("[presentation] ZIP falhou:", err);
      toast.error("Não foi possível gerar o ZIP. Tente novamente.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-trade" />
            Gerar Apresentação
          </DialogTitle>
          <DialogDescription>
            Configure a apresentação dos {groups.length}{" "}
            {groups.length === 1 ? "PDV selecionado" : "PDVs selecionados"} e
            exporte em formato compatível com o Canva.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-5 py-2">
            {overLimit && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Você selecionou {groups.length} PDVs. Para garantir a
                  abertura no Canva, apenas os primeiros {MAX_GROUPS} serão
                  incluídos nesta apresentação.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pres-title">Título</Label>
                <Input
                  id="pres-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={defaultTitle()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pres-client">Cliente / Marca (opcional)</Label>
                <Input
                  id="pres-client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Ex.: Marca XYZ"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pres-objective">Objetivo (opcional)</Label>
                <Textarea
                  id="pres-objective"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Ex.: Demonstrar a evolução de execução em PDV"
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>PDVs incluídos</Label>
                <span className="text-xs text-muted-foreground">
                  {exportGroups.length} de {groups.length}
                </span>
              </div>

              <div className="space-y-3 max-h-[34vh] overflow-y-auto rounded-md border bg-muted/30 p-3">
                {exportGroups.map((g, i) => (
                  <div
                    key={g.key}
                    className="space-y-1.5 rounded-md bg-background p-3 border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {String(i + 1).padStart(2, "0")}. {g.storeName}
                        </p>
                        {g.storeAddress && (
                          <p className="text-xs text-muted-foreground truncate">
                            {g.storeAddress}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(g.date).toLocaleDateString("pt-BR")}
                          {" · "}
                          {g.beforeUrl ? "Antes ✓" : "Antes —"}
                          {" · "}
                          {g.afterUrl ? "Depois ✓" : "Depois —"}
                        </p>
                      </div>
                    </div>
                    <Textarea
                      value={notesByKey[g.key] ?? ""}
                      onChange={(e) =>
                        setNotesByKey((prev) => ({
                          ...prev,
                          [g.key]: e.target.value,
                        }))
                      }
                      placeholder="Destaques deste PDV (opcional)"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <Alert className="border-trade/30 bg-trade-light/40">
              <Info className="h-4 w-4 text-trade" />
              <AlertDescription className="text-xs leading-relaxed">
                <strong>Como abrir no Canva:</strong> 1) Baixe o PPTX abaixo.
                2) No Canva, clique em <em>Criar design → Importar arquivo</em>.
                3) Cada slide será aberto editável.
              </AlertDescription>
            </Alert>
          </div>
        </ScrollArea>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={!!busy}
          >
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={handleZip}
            disabled={!!busy || exportGroups.length === 0}
            className="gap-1.5"
          >
            {busy === "zip" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            ZIP de imagens
          </Button>
          <Button
            variant="outline"
            onClick={handlePdf}
            disabled={!!busy || exportGroups.length === 0}
            className="gap-1.5"
          >
            {busy === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Baixar PDF
          </Button>
          <Button
            onClick={handlePptx}
            disabled={!!busy || exportGroups.length === 0}
            className="gap-1.5 bg-trade hover:bg-trade-dark"
          >
            {busy === "pptx" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Baixar PPTX (Canva)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
