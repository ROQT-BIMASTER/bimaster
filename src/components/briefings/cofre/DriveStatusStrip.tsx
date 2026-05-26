// src/components/briefings/cofre/DriveStatusStrip.tsx
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Share2, RefreshCw, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  useGoogleDriveConfig,
  useVerificarDriveConexao,
  useCompartilharPastaBriefing,
} from "@/hooks/useGoogleDriveSync";
import { toast } from "sonner";

interface BriefingDriveInfo {
  google_drive_folder_id: string | null;
  google_drive_folder_url: string | null;
  google_drive_share_url: string | null;
}

function GoogleDriveLogo({ className = "h-5 w-5" }: { className?: string }) {
  // Logotipo oficial (triângulo do Google Drive) em SVG
  return (
    <svg viewBox="0 0 87.3 78" className={className} aria-label="Google Drive">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.4C.4 49.8 0 51.35 0 52.9h27.5z" fill="#00ac47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335" />
      <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="M73.4 26.5L60.75 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

export function DriveStatusStrip({ briefingId }: { briefingId: string }) {
  const { data: cfg } = useGoogleDriveConfig();
  const verificar = useVerificarDriveConexao();
  const compartilhar = useCompartilharPastaBriefing(briefingId);

  const { data: briefingInfo } = useQuery({
    queryKey: ["briefing-drive-info", briefingId],
    queryFn: async (): Promise<BriefingDriveInfo | null> => {
      const { data, error } = await (supabase as any)
        .from("briefings")
        .select("google_drive_folder_id, google_drive_folder_url, google_drive_share_url")
        .eq("id", briefingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 15_000,
  });

  const status = cfg?.connection_status ?? "nao_configurado";
  const configured = status === "conectado";

  const renderBadge = () => {
    switch (status) {
      case "conectado":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1 h-5 text-[10px]">
            <CheckCircle2 className="h-3 w-3" /> Conectado
          </Badge>
        );
      case "erro":
        return (
          <Badge variant="destructive" className="gap-1 h-5 text-[10px]">
            <AlertCircle className="h-3 w-3" /> Erro
          </Badge>
        );
      case "desconectado":
        return <Badge variant="secondary" className="h-5 text-[10px]">Desconectado</Badge>;
      default:
        return (
          <Badge variant="outline" className="h-5 text-[10px] text-muted-foreground">
            Não configurado
          </Badge>
        );
    }
  };

  const shareUrl = briefingInfo?.google_drive_share_url;
  const folderUrl = briefingInfo?.google_drive_folder_url;

  const copiarLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
            <GoogleDriveLogo className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold">Google Drive</h4>
              {renderBadge()}
              {cfg?.auto_sync_enabled && configured && (
                <Badge variant="outline" className="h-5 text-[10px]">Espelhamento automático</Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {configured ? (
                <>
                  Pasta raiz: <span className="font-medium text-foreground">{cfg?.root_folder_name}</span>
                  {briefingInfo?.google_drive_folder_id
                    ? " · Pasta deste briefing já criada"
                    : " · A pasta do briefing será criada no primeiro envio"}
                </>
              ) : (
                "Integração ainda não configurada. Solicite ao administrador do sistema."
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {folderUrl && (
            <Button
              size="sm" variant="outline" className="h-8"
              onClick={() => window.open(folderUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir pasta no Drive
            </Button>
          )}
          {shareUrl ? (
            <>
              <Button size="sm" variant="outline" className="h-8" onClick={copiarLink}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
              </Button>
              <Button
                size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive"
                disabled={compartilhar.isPending}
                onClick={() => compartilhar.mutate("revogar")}
              >
                Revogar compartilhamento
              </Button>
            </>
          ) : (
            <Button
              size="sm" variant="secondary" className="h-8"
              disabled={!configured || compartilhar.isPending}
              onClick={() => compartilhar.mutate("compartilhar")}
              title={!configured ? "Configure o Google Drive primeiro" : "Gerar link com acesso de leitura"}
            >
              <Share2 className="h-3.5 w-3.5 mr-1" /> Compartilhar pasta do briefing
            </Button>
          )}
          <Button
            size="sm" variant="ghost" className="h-8"
            disabled={verificar.isPending}
            onClick={() => verificar.mutate()}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${verificar.isPending ? "animate-spin" : ""}`} />
            Verificar
          </Button>
        </div>
      </div>
    </div>
  );
}
