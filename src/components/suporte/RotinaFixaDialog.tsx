import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Workflow, ArrowRight } from "lucide-react";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import {
  useCreateRotinaFixa,
  useUpdateRotinaFixa,
  useRotinasFixas,
  type RotinaFixa,
} from "@/hooks/suporte/useRotinasFixas";
import {
  useProcessos,
  useEncadeamentoDaRotina,
  useVincularRotinaAoProcesso,
  useDesvincularRotinaDoProcesso,
} from "@/hooks/suporte/useProcessos";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const DIAS = [
  { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" }, { v: 7, l: "Dom" },
];

function useUsuarios() {
  return useQuery({
    queryKey: ["usuarios-basic"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome, email").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rotina?: RotinaFixa | null;
}

export function RotinaFixaDialog({ open, onOpenChange, rotina }: Props) {
  const { data: filas = [] } = useSuporteFilas();
  const { data: usuarios = [] } = useUsuarios();
  const { data: todasRotinas = [] } = useRotinasFixas();
  const { data: processos = [] } = useProcessos();
  const { data: encadeamento } = useEncadeamentoDaRotina(rotina?.id);
  const create = useCreateRotinaFixa();
  const update = useUpdateRotinaFixa();
  const vincular = useVincularRotinaAoProcesso();
  const desvincular = useDesvincularRotinaDoProcesso();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [filaId, setFilaId] = useState<string>("");
  const [responsavel, setResponsavel] = useState<string>("");
  const [lider, setLider] = useState<string>("");
  const [prioridade, setPrioridade] = useState<"baixa"|"media"|"alta"|"critica">("media");
  const [dias, setDias] = useState<number[]>([1,2,3,4,5]);
  const [horario, setHorario] = useState("07:00");
  const [slaResMin, setSlaResMin] = useState<string>("");
  const [checklist, setChecklist] = useState<Array<{ texto: string }>>([]);
  const [novoItem, setNovoItem] = useState("");
  const [geraTarefa, setGeraTarefa] = useState(true);
  const [ativo, setAtivo] = useState(true);

  // Encadeamento (Fase 3)
  const NENHUM = "__nenhum";
  const NOVO = "__novo";
  const [processoOpt, setProcessoOpt] = useState<string>(NENHUM);
  const [novoProcessoNome, setNovoProcessoNome] = useState("");
  const [proximas, setProximas] = useState<string[]>([]);
  const [slaHandoff, setSlaHandoff] = useState<string>("");

  useEffect(() => {
    if (rotina) {
      setTitulo(rotina.titulo);
      setDescricao(rotina.descricao ?? "");
      setFilaId(rotina.fila_id);
      setResponsavel(rotina.responsavel_user_id);
      setLider(rotina.lider_user_id ?? "");
      setPrioridade(rotina.prioridade);
      setDias(rotina.dias_semana);
      setHorario(rotina.horario_geracao?.slice(0,5) ?? "07:00");
      setSlaResMin(rotina.sla_resolucao_min ? String(rotina.sla_resolucao_min) : "");
      setChecklist(Array.isArray(rotina.checklist) ? rotina.checklist : []);
      setGeraTarefa(rotina.gera_tarefa_projeto);
      setAtivo(rotina.ativo);
    } else if (open) {
      setTitulo(""); setDescricao(""); setFilaId(""); setResponsavel(""); setLider("");
      setPrioridade("media"); setDias([1,2,3,4,5]); setHorario("07:00"); setSlaResMin("");
      setChecklist([]); setNovoItem(""); setGeraTarefa(true); setAtivo(true);
      setProcessoOpt(NENHUM); setNovoProcessoNome(""); setProximas([]); setSlaHandoff("");
    }
  }, [rotina, open]);

  // Hidrata seção de encadeamento quando a rotina existente já participa de um processo
  useEffect(() => {
    if (!encadeamento) return;
    if (encadeamento.processo_id) {
      setProcessoOpt(encadeamento.processo_id);
      setProximas(encadeamento.proximas);
      setSlaHandoff(encadeamento.sla_handoff != null ? String(encadeamento.sla_handoff) : "");
    } else {
      setProcessoOpt(NENHUM);
      setProximas([]);
      setSlaHandoff("");
    }
  }, [encadeamento?.processo_id, encadeamento?.etapa_id]);

  const toggleDia = (d: number) => {
    setDias((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  };

  const adicionarChecklist = () => {
    const t = novoItem.trim();
    if (!t) return;
    setChecklist((prev) => [...prev, { texto: t }]);
    setNovoItem("");
  };

  const filaNomePorId = useMemo(() => {
    const m = new Map<string, { nome: string; cor: string | null }>();
    for (const f of filas as any[]) m.set(f.id, { nome: f.nome, cor: f.cor ?? null });
    return m;
  }, [filas]);

  const rotinasDisponiveis = useMemo(() => {
    return (todasRotinas as RotinaFixa[]).filter((r) => r.ativo && r.id !== rotina?.id);
  }, [todasRotinas, rotina?.id]);

  const toggleProxima = (id: string) => {
    setProximas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const salvar = async () => {
    if (!titulo.trim() || !filaId || !responsavel) return;
    const payload: any = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      fila_id: filaId,
      responsavel_user_id: responsavel,
      lider_user_id: lider || null,
      prioridade,
      dias_semana: dias.length ? dias : [1,2,3,4,5],
      horario_geracao: horario,
      sla_resolucao_min: slaResMin ? Number(slaResMin) : null,
      checklist,
      gera_tarefa_projeto: geraTarefa,
      ativo,
    };
    let rotinaId: string;
    if (rotina) {
      await update.mutateAsync({ id: rotina.id, ...payload });
      rotinaId = rotina.id;
    } else {
      const criada = await create.mutateAsync(payload);
      rotinaId = (criada as any)?.id ?? (criada as any);
    }

    // Persistir encadeamento
    if (rotinaId) {
      if (processoOpt === NENHUM) {
        if (encadeamento?.etapa_id) await desvincular.mutateAsync(rotinaId);
      } else {
        await vincular.mutateAsync({
          rotina_id: rotinaId,
          fila_id: filaId,
          processo_id: processoOpt === NOVO ? null : processoOpt,
          novo_processo_nome: processoOpt === NOVO ? novoProcessoNome : null,
          proximas_rotinas: proximas,
          sla_handoff_minutos: slaHandoff ? Number(slaHandoff) : null,
        });
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rotina ? "Editar rotina fixa" : "Nova rotina fixa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Backup diário do ERP" />
          </div>
          <div>
            <Label>Descrição / Roteiro</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Passo a passo que o responsável deve seguir" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fila (departamento)</Label>
              <Select value={filaId} onValueChange={setFilaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a fila" /></SelectTrigger>
                <SelectContent>
                  {filas.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v: any) => setPrioridade(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Responsável (executor)</Label>
              <Select value={responsavel} onValueChange={setResponsavel}>
                <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                <SelectContent>
                  {(usuarios as any[]).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome ?? u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Líder (recebe escalonamento)</Label>
              <Select value={lider || "__none"} onValueChange={(v) => setLider(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Opcional — usa líder da fila" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Usar líder da fila —</SelectItem>
                  {(usuarios as any[]).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome ?? u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Dias da semana</Label>
            <div className="flex gap-2 flex-wrap mt-1">
              {DIAS.map((d) => (
                <Button key={d.v} type="button" size="sm"
                  variant={dias.includes(d.v) ? "default" : "outline"}
                  onClick={() => toggleDia(d.v)}>{d.l}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Horário de geração</Label>
              <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
            <div>
              <Label>SLA de resolução (minutos)</Label>
              <Input type="number" placeholder="Herda da fila" value={slaResMin}
                onChange={(e) => setSlaResMin(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Checklist obrigatório</Label>
            <div className="flex gap-2 mt-1">
              <Input value={novoItem} onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarChecklist())}
                placeholder="Item do checklist" />
              <Button type="button" size="icon" variant="outline" onClick={adicionarChecklist}><Plus className="h-4 w-4" /></Button>
            </div>
            <ul className="space-y-1 mt-2">
              {checklist.map((c, i) => (
                <li key={i} className="flex items-center justify-between text-sm bg-muted/40 rounded px-2 py-1">
                  <span>{c.texto}</span>
                  <Button size="icon" variant="ghost" onClick={() => setChecklist((p) => p.filter((_,j) => j !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-between border rounded px-3 py-2">
            <div>
              <Label>Criar tarefa espelho em Projetos</Label>
              <p className="text-xs text-muted-foreground">Gera a tarefa no projeto associado à fila</p>
            </div>
            <Switch checked={geraTarefa} onCheckedChange={setGeraTarefa} />
          </div>
          <div className="flex items-center justify-between border rounded px-3 py-2">
            <div>
              <Label>Ativa</Label>
              <p className="text-xs text-muted-foreground">Se desligada, deixa de gerar novos tickets</p>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!titulo.trim() || !filaId || !responsavel || create.isPending || update.isPending}>
            {rotina ? "Salvar" : "Criar rotina"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
