import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  FileText,
  Lock,
  MoreVertical,
  Plus,
  ShieldCheck,
  History,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useTicketEvidencias,
  useBaixarEvidencia,
  useBloquearEvidencia,
  CATEGORIA_LABEL,
  type EvidenciaCategoria,
  type SuporteEvidencia,
} from "@/hooks/suporte/useEvidencias";
import { EvidenciaUploadDialog } from "./EvidenciaUploadDialog";
import { EvidenciaAcessosDialog } from "./EvidenciaAcessosDialog";

interface Props {
  ticketId: string;
  canWrite: boolean;
  isAdmin?: boolean;
}

export function EvidenciasTab({ ticketId, canWrite, isAdmin = false }: Props) {
  const { data: evidencias = [], isLoading } = useTicketEvidencias(ticketId);
  const baixar = useBaixarEvidencia();
  const bloquear = useBloquearEvidencia();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [acessosOpen, setAcessosOpen] = useState(false);
  const [acessosEvid, setAcessosEvid] = useState<SuporteEvidencia | null>(null);
  const [filtroCat, setFiltroCat] = useState<string>("todas");

  const filtered = useMemo(() => {
    if (filtroCat === "todas") return evidencias;
    return evidencias.filter((e) => e.categoria === filtroCat);
  }, [evidencias, filtroCat]);

  function verAcessos(e: SuporteEvidencia) {
    setAcessosEvid(e);
    setAcessosOpen(true);
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {canWrite && (
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setUploadOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Enviar documento
          </Button>
        )}
        <Select value={filtroCat} onValueChange={setFiltroCat}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {(Object.keys(CATEGORIA_LABEL) as EvidenciaCategoria[]).map((k) => (
              <SelectItem key={k} value={k}>
                {CATEGORIA_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} documento{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">
            Nenhum documento neste cofre.
            {canWrite && " Clique em Enviar documento para começar."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => (
            <li key={e.id} className="rounded-md border bg-card p-3 space-y-2">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {e.nome_arquivo}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {CATEGORIA_LABEL[e.categoria]}
                    </Badge>
                    {e.locked_juridico && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <Lock className="h-3 w-3" /> Retenção jurídica
                      </Badge>
                    )}
                    {e.parecer_id && (
                      <Badge variant="secondary" className="text-[10px]">
                        vinculado a parecer
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    {e.tamanho != null && <span>{(e.tamanho / 1024).toFixed(0)} KB</span>}
                    <span className="font-mono" title={e.hash_sha256}>
                      SHA-256 {e.hash_sha256.slice(0, 10)}…
                    </span>
                    <span>
                      {format(new Date(e.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  {e.descricao && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {e.descricao}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => baixar.mutate(e)}
                    title="Baixar"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => verAcessos(e)}>
                        <History className="h-3.5 w-3.5 mr-2" />
                        Ver cadeia de custódia
                      </DropdownMenuItem>
                      {isAdmin && !e.locked_juridico && (
                        <DropdownMenuItem
                          onClick={() => bloquear.mutate(e.id)}
                          className="text-destructive"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                          Aplicar retenção jurídica
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EvidenciaUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        ticketId={ticketId}
      />
      <EvidenciaAcessosDialog
        open={acessosOpen}
        onOpenChange={setAcessosOpen}
        evidenciaId={acessosEvid?.id ?? null}
        nomeArquivo={acessosEvid?.nome_arquivo}
      />
    </div>
  );
}
