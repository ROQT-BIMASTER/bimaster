import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Loader2, Save } from "lucide-react";
import {
  useSuporteFluxo,
  useSuporteFluxoMutations,
  useProjetosVisiveis,
  type EtapaMensagem,
  type SecaoKanban,
} from "@/hooks/suporte/useSuporteFluxo";
import { useUserRole } from "@/hooks/useUserRole";
import {
  SUPORTE_STATUS_LABEL,
  type SuporteFila,
  type SuporteTicketStatus,
} from "@/hooks/suporte/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fila: SuporteFila;
}

const NAO_MUDAR = "__nao_mudar__";

export function FluxoDepartamentoDialog({ open, onOpenChange, fila }: Props) {
  const { isAdmin } = useUserRole();
  const { data: fluxo, isLoading } = useSuporteFluxo(fila.id, fila.projeto_id ?? null);
  const { upsertMensagem, criarProjeto, vincularProjeto, alternarAutoCriar } =
    useSuporteFluxoMutations(fila.id);
  const { data: projetos = [] } = useProjetosVisiveis();
  const [projetoParaVincular, setProjetoParaVincular] = useState<string>("");

  if (!fila.projeto_id) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fluxo do departamento — {fila.nome}</DialogTitle>
            <DialogDescription>
              Este departamento ainda não tem um projeto de kanban vinculado. Vincule
              um para que os chamados virem cards e a equipe atenda pelo kanban.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border rounded-md p-3 space-y-2">
              <h3 className="text-sm font-medium">Criar projeto padrão</h3>
              <p className="text-xs text-muted-foreground">
                Cria "Suporte — {fila.nome}" com as seções Em espera → Em análise →
                Finalizado → Rejeitado, adiciona os membros atuais do departamento e
                grava mensagens automáticas padrão para cada etapa.
              </p>
              <Button
                onClick={() => criarProjeto.mutate()}
                disabled={criarProjeto.isPending}
              >
                {criarProjeto.isPending ? "Criando..." : "Criar projeto padrão"}
              </Button>
            </div>

            <div className="border rounded-md p-3 space-y-2">
              <h3 className="text-sm font-medium">Vincular projeto existente</h3>
              <div className="flex gap-2">
                <Select
                  value={projetoParaVincular}
                  onValueChange={setProjetoParaVincular}
                >
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="Selecione um projeto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!projetoParaVincular || vincularProjeto.isPending}
                  onClick={() => vincularProjeto.mutate(projetoParaVincular)}
                >
                  Vincular
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Fluxo do departamento — {fila.nome}
            <Badge variant="secondary">Projeto vinculado</Badge>
          </DialogTitle>
          <DialogDescription>
            Para cada seção do kanban, defina a mensagem automática enviada ao
            solicitante quando o card entra na seção. Placeholders: <code>{"{protocolo}"}</code>{" "}
            <code>{"{titulo}"}</code> <code>{"{etapa}"}</code> <code>{"{departamento}"}</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <Switch
              id="fluxo-auto"
              checked={fila.auto_criar_tarefa ?? true}
              disabled={!isAdmin || alternarAutoCriar.isPending}
              onCheckedChange={(v) => alternarAutoCriar.mutate(v)}
            />
            <Label htmlFor="fluxo-auto" className="text-sm">
              Criar card no kanban a cada chamado novo
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link
                to={`/dashboard/projetos/${fila.projeto_id}`}
                target="_blank"
                className="gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Abrir projeto
              </Link>
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => vincularProjeto.mutate(null)}
                disabled={vincularProjeto.isPending}
              >
                Desvincular
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pt-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (fluxo?.secoes ?? []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              O projeto vinculado não tem seções. Adicione seções no kanban do projeto.
            </p>
          ) : (
            (fluxo?.secoes ?? []).map((secao) => (
              <EtapaEditor
                key={secao.id}
                secao={secao}
                config={fluxo?.mensagens.find((m) => m.secao_id === secao.id)}
                onSave={(payload) =>
                  upsertMensagem.mutate({ secao_id: secao.id, ...payload })
                }
                saving={upsertMensagem.isPending}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EtapaEditor({
  secao,
  config,
  onSave,
  saving,
}: {
  secao: SecaoKanban;
  config?: EtapaMensagem;
  onSave: (p: {
    mensagem: string;
    status_map: string | null;
    notificar: boolean;
    ativo: boolean;
  }) => void;
  saving: boolean;
}) {
  const [mensagem, setMensagem] = useState(config?.mensagem ?? "");
  const [statusMap, setStatusMap] = useState<string>(config?.status_map ?? NAO_MUDAR);
  const [notificar, setNotificar] = useState<boolean>(config?.notificar ?? true);
  const [ativo, setAtivo] = useState<boolean>(config?.ativo ?? true);

  useEffect(() => {
    setMensagem(config?.mensagem ?? "");
    setStatusMap(config?.status_map ?? NAO_MUDAR);
    setNotificar(config?.notificar ?? true);
    setAtivo(config?.ativo ?? true);
  }, [config?.id, config?.mensagem, config?.status_map, config?.notificar, config?.ativo]);

  return (
    <div className="border rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{secao.ordem}</Badge>
          <span className="font-medium text-sm">{secao.nome}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Switch checked={ativo} onCheckedChange={setAtivo} id={`ativo-${secao.id}`} />
            <Label htmlFor={`ativo-${secao.id}`} className="text-xs">Ativa</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch
              checked={notificar}
              onCheckedChange={setNotificar}
              id={`notif-${secao.id}`}
            />
            <Label htmlFor={`notif-${secao.id}`} className="text-xs">Notificar</Label>
          </div>
        </div>
      </div>

      <Textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Ex.: Boa notícia: o chamado {protocolo} está em análise."
        className="text-sm"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs">Também mudar status para:</Label>
        <Select value={statusMap} onValueChange={setStatusMap}>
          <SelectTrigger className="h-8 w-56 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NAO_MUDAR}>Não mudar</SelectItem>
            {(Object.keys(SUPORTE_STATUS_LABEL) as SuporteTicketStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SUPORTE_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          size="sm"
          className="gap-1.5"
          disabled={saving}
          onClick={() =>
            onSave({
              mensagem,
              status_map: statusMap === NAO_MUDAR ? null : statusMap,
              notificar,
              ativo,
            })
          }
        >
          <Save className="h-3.5 w-3.5" /> Salvar
        </Button>
      </div>
    </div>
  );
}
