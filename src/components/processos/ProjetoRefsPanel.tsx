import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderOpen, Plus, Trash2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProjetosParaVinculo, useSecoesETarefas } from "@/hooks/useChinaTarefaVinculos";

interface Props {
  etapaId: string;
  v: any; // useProcessoEtapaVinculos result
}

export function ProjetoRefsPanel({ etapaId, v }: Props) {
  const navigate = useNavigate();
  const refs = v.projetoRefs ?? [];
  const [projetoId, setProjetoId] = useState("");
  const [secaoId, setSecaoId] = useState("");
  const [tarefaId, setTarefaId] = useState("");
  const [bloqueia, setBloqueia] = useState(false);

  const { data: projetos = [] } = useProjetosParaVinculo();
  const { data: secoesData } = useSecoesETarefas(projetoId || null);
  const secoes = secoesData?.secoes ?? [];
  const tarefas = (secoesData?.tarefas ?? []).filter((t: any) => !secaoId || t.secao_id === secaoId);

  const reset = () => {
    setProjetoId("");
    setSecaoId("");
    setTarefaId("");
    setBloqueia(false);
  };

  const adicionar = async () => {
    if (!projetoId) return;
    await v.addProjetoRef.mutateAsync({
      projeto_id: projetoId,
      secao_id: secaoId || null,
      tarefa_id: tarefaId || null,
      bloqueia_avanco: bloqueia,
      ordem: refs.length,
    });
    reset();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Vincule esta etapa a Projetos, Seções e Tarefas que já existem no módulo Projetos. Quando o perfil for aplicado, os vínculos são criados automaticamente.
      </p>

      {refs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum vínculo com projetos.</p>
      ) : (
        <div className="space-y-2">
          {refs.map((r: any) => {
            const path = [r.projeto_nome, r.secao_nome, r.tarefa_titulo].filter(Boolean).join(" › ");
            return (
              <div key={r.id} className="flex items-center gap-2 p-2 border rounded-md">
                <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm flex-1 min-w-0 truncate">{path}</span>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={r.bloqueia_avanco}
                    onCheckedChange={(b) => v.updateProjetoRef.mutate({ id: r.id, bloqueia_avanco: b })}
                  />
                  <Label className="text-[10px] text-muted-foreground">bloqueia</Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => navigate(`/dashboard/projetos/${r.projeto_id}`)}
                  title="Abrir projeto"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => v.removeProjetoRef.mutate(r.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t pt-3 space-y-2">
        <Label className="text-xs">Adicionar vínculo</Label>
        <div className="grid gap-2 grid-cols-3">
          <Select value={projetoId} onValueChange={(v2) => { setProjetoId(v2); setSecaoId(""); setTarefaId(""); }}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              {projetos.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={secaoId} onValueChange={(v2) => { setSecaoId(v2); setTarefaId(""); }} disabled={!projetoId || secoes.length === 0}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Seção (opcional)" /></SelectTrigger>
            <SelectContent>
              {secoes.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tarefaId} onValueChange={setTarefaId} disabled={!projetoId || tarefas.length === 0}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Tarefa (opcional)" /></SelectTrigger>
            <SelectContent>
              {tarefas.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.titulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={bloqueia} onCheckedChange={setBloqueia} />
            <Label className="text-xs">Bloqueia avanço se não concluído</Label>
          </div>
          <Button
            size="sm"
            disabled={!projetoId || v.addProjetoRef.isPending}
            onClick={adicionar}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}
