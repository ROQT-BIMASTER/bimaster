/**
 * CriarTarefaDoChatDialog — gera uma tarefa em um projeto a partir de uma mensagem do chat.
 *
 * Fluxo:
 *  1. Usuário escolhe projeto.
 *  2. IA sugere título, descrição, prazo e prioridade (carregado em paralelo).
 *  3. Usuário pode editar tudo antes de confirmar.
 *  4. Edge cria tarefa, copia anexos e vincula a mensagem (metadata.tarefa_id).
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, ListPlus, CalendarDays } from "lucide-react";
import {
  useCriarTarefaDoChat, useProjetosDoUsuario, useSugestaoTarefaChat,
} from "@/hooks/chat/useCriarTarefaDoChat";
import type { ChatMensagem } from "@/hooks/chat/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mensagem: ChatMensagem | null;
  textoInicial?: string;
}

export function CriarTarefaDoChatDialog({ open, onOpenChange, mensagem, textoInicial }: Props) {
  const [projetoId, setProjetoId] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataPrazo, setDataPrazo] = useState<string>("");
  const [prioridade, setPrioridade] = useState<"baixa" | "media" | "alta" | "urgente">("media");
  const [copiarAnexos, setCopiarAnexos] = useState(true);
  const [aplicouSugestao, setAplicouSugestao] = useState(false);

  const { data: projetos, isLoading: loadingProjetos } = useProjetosDoUsuario();
  const sugestao = useSugestaoTarefaChat(
    mensagem?.id ?? null,
    projetoId || null,
    open && !!projetoId,
  );
  const criar = useCriarTarefaDoChat();

  // Reset ao abrir/fechar
  useEffect(() => {
    if (open) {
      setProjetoId("");
      setTitulo(textoInicial?.slice(0, 250) ?? "");
      setDescricao(textoInicial ?? mensagem?.conteudo ?? "");
      setDataPrazo("");
      setPrioridade("media");
      setCopiarAnexos(true);
      setAplicouSugestao(false);
    }
  }, [open, mensagem?.id, textoInicial]);

  // Aplica sugestão IA quando chega (uma vez por seleção de projeto)
  useEffect(() => {
    if (!sugestao.data || aplicouSugestao) return;
    setTitulo((t) => t.trim() ? t : sugestao.data.titulo);
    setDescricao((d) => d.trim() ? d : sugestao.data.descricao);
    setDataPrazo((p) => p || (sugestao.data.data_prazo ?? ""));
    setPrioridade((pr) => pr === "media" ? sugestao.data.prioridade : pr);
    setAplicouSugestao(true);
  }, [sugestao.data, aplicouSugestao]);

  // Resetar flag quando muda de projeto
  useEffect(() => {
    setAplicouSugestao(false);
  }, [projetoId]);

  const podeSalvar = !!projetoId && titulo.trim().length > 0 && !!mensagem;

  const handleSalvar = async () => {
    if (!mensagem || !projetoId) return;
    await criar.mutateAsync({
      mensagem_id: mensagem.id,
      projeto_id: projetoId,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      data_prazo: dataPrazo || null,
      prioridade,
      copiar_anexos: copiarAnexos,
    });
    onOpenChange(false);
  };

  const anexosNaMensagem = mensagem?.anexos?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-4 w-4" /> Criar tarefa a partir da mensagem
          </DialogTitle>
          <DialogDescription>
            A IA sugere título, descrição e prazo com base no contexto da conversa. Revise e confirme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Projeto</Label>
            <Select value={projetoId} onValueChange={setProjetoId} disabled={loadingProjetos}>
              <SelectTrigger>
                <SelectValue placeholder={loadingProjetos ? "Carregando..." : "Selecione um projeto"} />
              </SelectTrigger>
              <SelectContent>
                {(projetos ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.cor || "hsl(var(--primary))" }}
                      />
                      {p.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {projetoId && sugestao.isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 animate-pulse" />
              Analisando contexto da conversa...
            </div>
          )}

          <div>
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={250}
              placeholder="Título da tarefa"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={5}
              placeholder="Descrição (com contexto da conversa)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Prazo
              </Label>
              <Input
                type="date"
                value={dataPrazo}
                onChange={(e) => setDataPrazo(e.target.value)}
              />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {anexosNaMensagem > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={copiarAnexos}
                onChange={(e) => setCopiarAnexos(e.target.checked)}
                className="h-4 w-4"
              />
              Copiar {anexosNaMensagem} anexo(s) para a tarefa
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={!podeSalvar || criar.isPending}>
            {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ListPlus className="h-4 w-4 mr-2" />}
            Criar tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
