import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  briefingId: string;
  briefingTitulo: string;
  projetoId: string;
  projetoNome?: string | null;
  onTarefaCriada: (tarefaId: string) => void;
}

interface Secao {
  id: string;
  nome: string;
  ordem: number | null;
}

export function GerarTarefaDialog({
  open,
  onOpenChange,
  briefingId,
  briefingTitulo,
  projetoId,
  projetoNome,
  onTarefaCriada,
}: Props) {
  const navigate = useNavigate();
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [secaoId, setSecaoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState<string>("");
  const [loadingSecoes, setLoadingSecoes] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitulo(`Briefing: ${briefingTitulo}`.slice(0, 200));
    setDescricao(
      `Tarefa gerada a partir do briefing.\nAcesse o briefing em /dashboard/briefings/${briefingId}`,
    );
    setPrazo("");
  }, [open, briefingId, briefingTitulo]);

  useEffect(() => {
    if (!open || !projetoId) return;
    let canceled = false;
    setLoadingSecoes(true);
    (async () => {
      const { data, error } = await supabase
        .from("projeto_secoes")
        .select("id, nome, ordem")
        .eq("projeto_id", projetoId)
        .order("ordem", { ascending: true, nullsFirst: false })
        .order("nome");
      if (canceled) return;
      if (error) {
        toast.error("Erro ao carregar seções");
        setSecoes([]);
      } else {
        const list = (data ?? []) as Secao[];
        setSecoes(list);
        setSecaoId((prev) => prev ?? list[0]?.id ?? null);
      }
      setLoadingSecoes(false);
    })();
    return () => {
      canceled = true;
    };
  }, [open, projetoId]);

  const salvar = async () => {
    if (!secaoId) {
      toast.error("Selecione uma seção");
      return;
    }
    if (!titulo.trim()) {
      toast.error("Informe um título");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;

      const { data: tarefa, error: errIns } = await supabase
        .from("projeto_tarefas")
        .insert({
          projeto_id: projetoId,
          secao_id: secaoId,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          data_prazo: prazo || null,
          criador_id: uid,
          responsavel_id: uid,
          canal_criacao: "briefing",
          tem_briefing: true,
          status: "pendente",
        })
        .select("id")
        .single();

      if (errIns || !tarefa) {
        throw new Error(errIns?.message ?? "Falha ao criar tarefa");
      }

      const { error: errUpd } = await supabase
        .from("briefings")
        .update({ tarefa_id: tarefa.id, projeto_id: projetoId })
        .eq("id", briefingId);
      if (errUpd) throw new Error(errUpd.message);

      toast.success("Tarefa criada e vinculada ao briefing", {
        action: {
          label: "Abrir tarefa",
          onClick: () =>
            navigate(`/dashboard/projetos/${projetoId}n${tarefa.id}`),
        },
      });
      onTarefaCriada(tarefa.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar tarefa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar tarefa no projeto</DialogTitle>
          <DialogDescription>
            {projetoNome
              ? `Cria uma nova tarefa em ${projetoNome} e vincula ao briefing.`
              : "Cria uma nova tarefa no projeto vinculado e a associa ao briefing."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Seção
            </Label>
            <Select
              value={secaoId ?? undefined}
              onValueChange={(v) => setSecaoId(v)}
              disabled={loadingSecoes || secoes.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingSecoes
                      ? "Carregando seções…"
                      : secoes.length === 0
                        ? "Projeto sem seções"
                        : "Selecione uma seção"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {secoes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Título
            </Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Descrição
            </Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Prazo (opcional)
            </Label>
            <Input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving || !secaoId || !titulo.trim()}>
            {saving ? "Criando…" : "Criar tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
