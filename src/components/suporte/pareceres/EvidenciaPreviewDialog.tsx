import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileText, ImageOff } from "lucide-react";
import {
  fetchEvidenciaBlob,
  type SuporteEvidencia,
} from "@/hooks/suporte/useEvidencias";
import {
  watermarkImageBlob,
  renderPdfPagesAsWatermarkedImages,
  isImage,
  isPdf,
} from "@/lib/suporte/watermark";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evidencia: SuporteEvidencia | null;
  isAdmin: boolean;
}

export function EvidenciaPreviewDialog({
  open,
  onOpenChange,
  evidencia,
  isAdmin,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<
    { dataUrl: string; width: number; height: number }[]
  >([]);
  const [rawBlobForDownload, setRawBlobForDownload] = useState<Blob | null>(null);

  const applyWatermark = !isAdmin;
  const canPreview = useMemo(
    () => !!evidencia && (isImage(evidencia.mime) || isPdf(evidencia.mime)),
    [evidencia],
  );

  useEffect(() => {
    if (!open || !evidencia) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setImgUrl(null);
    setPdfPages([]);
    setRawBlobForDownload(null);

    (async () => {
      try {
        const blob = await fetchEvidenciaBlob(evidencia);

        if (isImage(evidencia.mime)) {
          let out = blob;
          if (applyWatermark) {
            const prof = await getProfile();
            out = await watermarkImageBlob(blob, {
              usuario: prof.nome,
              email: prof.email,
              ticketId: evidencia.ticket_id,
              hashCurto: evidencia.hash_sha256.slice(0, 10),
            });
          }
          if (cancelled) return;
          setImgUrl(URL.createObjectURL(out));
          setRawBlobForDownload(out);
        } else if (isPdf(evidencia.mime)) {
          const prof = await getProfile();
          const pages = await renderPdfPagesAsWatermarkedImages(
            blob,
            {
              usuario: prof.nome,
              email: prof.email,
              ticketId: evidencia.ticket_id,
              hashCurto: evidencia.hash_sha256.slice(0, 10),
            },
            { maxPages: 20, scale: 1.4 },
          );
          if (cancelled) return;
          setPdfPages(pages);
          // Para não-admin: download entrega o PDF original (o watermark visual
          // fica na visualização). Admins baixam o original limpo.
          setRawBlobForDownload(blob);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Falha ao carregar preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, evidencia, applyWatermark]);

  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [imgUrl]);

  function baixarBloco() {
    if (!rawBlobForDownload || !evidencia) return;
    const url = URL.createObjectURL(rawBlobForDownload);
    const a = document.createElement("a");
    a.href = url;
    const nome = evidencia.nome_arquivo;
    a.download =
      applyWatermark && isImage(evidencia.mime)
        ? nome.replace(/(\.[^.]+)?$/, (m) => `_marcado${m || ".png"}`)
        : nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm truncate">
            {evidencia?.nome_arquivo ?? "Preview"}
          </DialogTitle>
          {applyWatermark && (
            <p className="text-[11px] text-muted-foreground">
              Cópia controlada — marcada com identificação do visualizador.
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30 rounded-md p-3">
          {loading && (
            <div className="flex items-center justify-center h-64 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando preview...
            </div>
          )}
          {!loading && error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
          {!loading && !error && !canPreview && (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
              <ImageOff className="h-8 w-8" />
              <p className="text-sm">
                Preview indisponível para este tipo de arquivo.
              </p>
              <p className="text-xs">
                Use o download para acessar o conteúdo original.
              </p>
            </div>
          )}
          {!loading && !error && imgUrl && (
            <img
              src={imgUrl}
              alt={evidencia?.nome_arquivo}
              className="max-w-full h-auto mx-auto"
            />
          )}
          {!loading && !error && pdfPages.length > 0 && (
            <div className="space-y-3">
              {pdfPages.map((p, i) => (
                <div key={i} className="border bg-background shadow-sm">
                  <img
                    src={p.dataUrl}
                    alt={`Página ${i + 1}`}
                    className="w-full h-auto"
                  />
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground text-center">
                {pdfPages.length} página{pdfPages.length === 1 ? "" : "s"} — se houver mais, baixe o arquivo original.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            size="sm"
            onClick={baixarBloco}
            disabled={!rawBlobForDownload}
            className="gap-1.5"
          >
            {isImage(evidencia?.mime) ? (
              <>
                <Download className="h-3.5 w-3.5" />
                Baixar {applyWatermark ? "cópia marcada" : "original"}
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                Baixar original
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function getProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  const email = userData.user?.email ?? null;
  let nome = email ?? "usuário";
  if (uid) {
    const { data } = await supabase
      .from("profiles")
      .select("nome, email")
      .eq("id", uid)
      .maybeSingle();
    if (data?.nome) nome = data.nome;
    else if (data?.email) nome = data.email;
  }
  return { nome, email };
}
