import { useMemo } from "react";
import { detectFileKind } from "@/lib/utils/detectFileKind";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Download,
  ExternalLink,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  CheckCircle2,
  Cloud,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useBriefingDocumentos,
  type BriefingDocumento,
  CATEGORIA_LABELS,
  STATUS_LABELS,
} from "@/hooks/useBriefingCofre";
import {
  downloadStorageBlob,
  triggerBlobDownload,
} from "@/lib/utils/storage-download";

interface Props {
  briefingId: string;
  onOpenBriefingCofre?: () => void;
}

function iconFor(nome: string, mime: string | null | undefined) {
  const kind = detectFileKind(nome, mime ?? null);
  if (kind === "image") return FileImage;
  if (kind === "pdf") return FileText;
  if (mime?.includes("spreadsheet") || mime?.includes("excel") || mime === "text/csv") return FileSpreadsheet;
  if (mime?.includes("zip") || mime?.includes("compressed")) return FileArchive;
  return FileIcon;
}

function statusTone(s: BriefingDocumento["status"]) {
  switch (s) {
    case "aprovado":
      return "success" as const;
    case "rejeitado":
      return "destructive" as const;
    case "recebido":
      return "secondary" as const;
    default:
      return "warning" as const;
  }
}

const ORIGEM_LABEL: Record<BriefingDocumento["origem"], string> = {
  upload: "upload",
  chat: "chat",
  template: "template",
  evidencia: "evidência",
};

function useUploaderProfiles(userIds: string[]) {
  return useQuery({
    queryKey: ["rr-cofre-uploaders", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", userIds);
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((p: any) => map.set(p.id, p.nome ?? "Usuário"));
      return map;
    },
  });
}

async function handleDownload(doc: BriefingDocumento) {
  if (!doc.storage_path) return;
  const res = await downloadStorageBlob(
    doc.storage_path,
    doc.nome,
    "briefing-cofre",
  );
  if (res.error || !res.blobUrl) {
    toast.error(res.error ?? "Falha ao baixar documento");
    return;
  }
  triggerBlobDownload(res.blobUrl, res.filename);
}

function relTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
}

function absTime(iso: string) {
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function RrTaskCofrePanel({ briefingId, onOpenBriefingCofre }: Props) {
  const { data: docs = [], isLoading } = useBriefingDocumentos(briefingId);

  const uploaderIds = useMemo(
    () =>
      Array.from(
        new Set(docs.map((d) => d.created_by).filter((v): v is string => !!v)),
      ),
    [docs],
  );
  const { data: uploaderById } = useUploaderProfiles(uploaderIds);

  const summary = useMemo(() => {
    const total = docs.length;
    let oficial = 0;
    let pendente = 0;
    let aprovado = 0;
    docs.forEach((d) => {
      if (d.is_oficial) oficial++;
      if (d.status === "pendente") pendente++;
      if (d.status === "aprovado") aprovado++;
    });
    return { total, oficial, pendente, aprovado };
  }, [docs]);

  // Auditoria: ordem cronológica reversa por entrada no cofre
  const auditoria = useMemo(
    () => [...docs].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [docs],
  );

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Carregando documentos…</p>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum documento no cofre deste briefing ainda.
        </p>
        {onOpenBriefingCofre && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={onOpenBriefingCofre}
          >
            Abrir Cofre
          </Button>
        )}
      </div>
    );
  }

  const visible = docs.slice(0, 6);
  const hidden = docs.length - visible.length;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-3">
        {/* Resumo */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{summary.total} documentos</Badge>
          {summary.oficial > 0 && (
            <Badge variant="outline">{summary.oficial} oficiais</Badge>
          )}
          {summary.aprovado > 0 && (
            <Badge variant="success">{summary.aprovado} aprovados</Badge>
          )}
          {summary.pendente > 0 && (
            <Badge variant="warning">{summary.pendente} pendentes</Badge>
          )}
        </div>

        {/* Lista compacta */}
        <ul className="space-y-2">
          {visible.map((d) => {
            const Icon = iconFor(d.nome, d.mime_type);
            return (
              <li
                key={d.id}
                className="rounded-md border border-border p-2.5 text-sm"
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate" title={d.nome}>
                        {d.nome}
                      </span>
                      {d.is_oficial && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          Oficial
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {d.categoria && (
                        <Badge variant="ghost" className="text-[10px] py-0">
                          {CATEGORIA_LABELS[d.categoria] ?? d.categoria}
                        </Badge>
                      )}
                      <Badge
                        variant={statusTone(d.status)}
                        className="text-[10px] py-0"
                      >
                        {STATUS_LABELS[d.status] ?? d.status}
                      </Badge>
                      {d.origem && (
                        <Badge variant="ghost" className="text-[10px] py-0">
                          via {ORIGEM_LABEL[d.origem] ?? d.origem}
                        </Badge>
                      )}
                      {d.enviado_notion_em && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0 gap-0.5"
                            >
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Notion
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Replicado no Notion em {absTime(d.enviado_notion_em)}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {d.drive_sync_status === "enviado" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0 gap-0.5"
                            >
                              <Cloud className="h-2.5 w-2.5" />
                              Drive
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {d.enviado_drive_em
                              ? `Enviado ao Drive em ${absTime(d.enviado_drive_em)}`
                              : "Enviado ao Drive"}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {d.drive_sync_status === "erro" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="destructive"
                              className="text-[10px] py-0 gap-0.5"
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Drive
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {d.drive_sync_error ?? "Falha no envio ao Drive"}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {d.drive_sync_status === "pendente" && (
                        <Badge variant="warning" className="text-[10px] py-0 gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          Drive
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {d.storage_path ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(d)}
                        title="Baixar"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    ) : d.notion_file_url ? (
                      <Button size="sm" variant="ghost" asChild title="Abrir no Notion">
                        <a
                          href={d.notion_file_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {hidden > 0 && onOpenBriefingCofre && (
          <Button
            size="sm"
            variant="link"
            className="px-0"
            onClick={onOpenBriefingCofre}
          >
            Ver todos no briefing ({hidden} restantes)
          </Button>
        )}

        {/* Auditoria de entrada */}
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Auditoria de entrada no cofre
          </h5>
          <ol className="space-y-2 border-l border-border pl-3">
            {auditoria.slice(0, 8).map((d) => {
              const who = uploaderById?.get(d.created_by) ?? "Usuário";
              return (
                <li key={`audit-${d.id}`} className="relative text-xs">
                  <span className="absolute -left-[15px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-medium truncate">{d.nome}</span>
                    <span className="text-muted-foreground">
                      entrou no cofre via {ORIGEM_LABEL[d.origem] ?? d.origem}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    por {who} ·{" "}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted">
                          {relTime(d.created_at)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{absTime(d.created_at)}</TooltipContent>
                    </Tooltip>
                  </div>
                  {d.enviado_notion_em && (
                    <div className="text-muted-foreground">
                      ↳ replicado no Notion em {absTime(d.enviado_notion_em)}
                    </div>
                  )}
                  {d.enviado_drive_em && (
                    <div className="text-muted-foreground">
                      ↳ enviado ao Drive em {absTime(d.enviado_drive_em)}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </TooltipProvider>
  );
}
