import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSystemProfiles } from "@/hooks/useSystemProfiles";
import {
  useCalendarioEventosMutations,
  type CalendarioEvento,
  type EventoInput,
} from "@/hooks/useCalendarioEventos";

const CORES = [
  { valor: "#6366f1", nome: "Índigo" },
  { valor: "#0ea5e9", nome: "Azul" },
  { valor: "#10b981", nome: "Verde" },
  { valor: "#f59e0b", nome: "Âmbar" },
  { valor: "#ef4444", nome: "Vermelho" },
  { valor: "#ec4899", nome: "Rosa" },
  { valor: "#8b5cf6", nome: "Roxo" },
  { valor: "#64748b", nome: "Cinza" },
];

const CATEGORIAS = [
  { valor: "geral", nome: "Geral" },
  { valor: "reuniao", nome: "Reunião" },
  { valor: "viagem", nome: "Viagem" },
  { valor: "treinamento", nome: "Treinamento" },
  { valor: "feriado", nome: "Feriado" },
  { valor: "prazo", nome: "Prazo" },
];

const ANTECEDENCIAS = [
  { valor: 15, nome: "15 minutos antes" },
  { valor: 60, nome: "1 hora antes" },
  { valor: 1440, nome: "1 dia antes" },
  { valor: 2880, nome: "2 dias antes" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Data pré-selecionada (Y-M-D) ao criar. */
  dataInicial?: string | null;
  /** Evento existente (modo edição). */
  evento?: CalendarioEvento | null;
}

/** Criação e edição de eventos avulsos do Calendário Geral. */
export function EventoCalendarioDialog({ open, onOpenChange, dataInicial, evento }: Props) {
  const editando = !!evento;
  const { criar, atualizar } = useCalendarioEventosMutations();
  const { data: perfis = [] } = useSystemProfiles();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("10:00");
  const [local, setLocal] = useState("");
  const [cor, setCor] = useState(CORES[0].valor);
  const [categoria, setCategoria] = useState("geral");
  const [participantes, setParticipantes] = useState<string[]>([]);
  const [buscaPessoa, setBuscaPessoa] = useState("");

  const [lembreteAtivo, setLembreteAtivo] = useState(false);
  const [antecedencia, setAntecedencia] = useState(60);
  const [canalEmail, setCanalEmail] = useState(true);
  const [canalNotificacao, setCanalNotificacao] = useState(true);

  const [frequencia, setFrequencia] = useState<"nenhuma" | "semanal" | "mensal">("nenhuma");
  const [intervalo, setIntervalo] = useState(1);
  const [ate, setAte] = useState("");

  useEffect(() => {
    if (!open) return;
    if (evento) {
      setTitulo(evento.titulo);
      setDescricao(evento.descricao || "");
      setDataInicio(evento.data_inicio);
      setDataFim(evento.data_fim);
      setDiaInteiro(evento.dia_inteiro);
      setHoraInicio(evento.hora_inicio?.slice(0, 5) || "09:00");
      setHoraFim(evento.hora_fim?.slice(0, 5) || "10:00");
      setLocal(evento.local || "");
      setCor(evento.cor);
      setCategoria(evento.categoria);
      setParticipantes(evento.participantes);
    } else {
      const base = dataInicial || new Date().toISOString().slice(0, 10);
      setTitulo("");
      setDescricao("");
      setDataInicio(base);
      setDataFim(base);
      setDiaInteiro(true);
      setHoraInicio("09:00");
      setHoraFim("10:00");
      setLocal("");
      setCor(CORES[0].valor);
      setCategoria("geral");
      setParticipantes([]);
    }
    setBuscaPessoa("");
    setLembreteAtivo(false);
    setAntecedencia(60);
    setFrequencia("nenhuma");
    setIntervalo(1);
    setAte("");
  }, [open, evento, dataInicial]);

  const pessoasFiltradas = useMemo(() => {
    const q = buscaPessoa.trim().toLowerCase();
    const lista = q
      ? perfis.filter((p) => (p.nome || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q))
      : perfis;
    return lista.slice(0, 60);
  }, [perfis, buscaPessoa]);

  const salvando = criar.isPending || atualizar.isPending;

  const handleSalvar = async () => {
    if (!titulo.trim()) {
      toast.error("Informe o título do evento.");
      return;
    }
    if (!dataInicio || !dataFim || dataFim < dataInicio) {
      toast.error("Verifique as datas: o término não pode ser anterior ao início.");
      return;
    }
    if (!diaInteiro && horaFim <= horaInicio && dataInicio === dataFim) {
      toast.error("O horário de término deve ser posterior ao de início.");
      return;
    }
    if (frequencia !== "nenhuma" && !ate) {
      toast.error("Defina até quando a série se repete.");
      return;
    }

    const input: EventoInput = {
      titulo,
      descricao,
      data_inicio: dataInicio,
      data_fim: dataFim,
      dia_inteiro: diaInteiro,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      local,
      cor,
      categoria,
      participantes,
      lembrete: lembreteAtivo
        ? { ativo: true, antecedenciaMinutos: antecedencia, email: canalEmail, notificacao: canalNotificacao }
        : undefined,
      recorrencia: { frequencia, intervalo, ate: ate || null },
    };

    try {
      if (editando && evento) {
        await atualizar.mutateAsync({ id: evento.id, input });
        toast.success("Evento atualizado.");
      } else {
        const qtd = await criar.mutateAsync(input);
        toast.success(qtd > 1 ? `Série criada com ${qtd} ocorrências.` : "Evento criado.");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar o evento.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>
            Eventos avulsos aparecem no Calendário Geral e não pertencem a nenhum projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="evento-titulo">Título</Label>
            <Input
              id="evento-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Reunião de planejamento"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="evento-inicio">Início</Label>
              <Input
                id="evento-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  if (!dataFim || e.target.value > dataFim) setDataFim(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evento-fim">Término</Label>
              <Input id="evento-fim" type="date" value={dataFim} min={dataInicio} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="evento-dia-inteiro" className="text-sm font-normal">Dia inteiro</Label>
            <Switch id="evento-dia-inteiro" checked={diaInteiro} onCheckedChange={setDiaInteiro} />
          </div>

          {!diaInteiro && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="evento-hora-inicio">Hora de início</Label>
                <Input id="evento-hora-inicio" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evento-hora-fim">Hora de término</Label>
                <Input id="evento-hora-fim" type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="evento-local">Local</Label>
              <Input
                id="evento-local"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Sala, endereço ou link"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.valor} value={c.valor}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {CORES.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  aria-label={c.nome}
                  onClick={() => setCor(c.valor)}
                  style={{ backgroundColor: c.valor }}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform",
                    cor === c.valor ? "ring-2 ring-offset-2 ring-ring scale-110" : "hover:scale-105",
                  )}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evento-descricao">Descrição</Label>
            <Textarea
              id="evento-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Pauta, observações ou instruções"
            />
          </div>

          <div className="space-y-2">
            <Label>Participantes ({participantes.length})</Label>
            <Input
              value={buscaPessoa}
              onChange={(e) => setBuscaPessoa(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
            />
            <ScrollArea className="h-40 rounded-md border border-border p-2">
              <div className="space-y-1">
                {pessoasFiltradas.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={participantes.includes(p.id)}
                      onCheckedChange={(v) =>
                        setParticipantes((prev) => (v ? [...prev, p.id] : prev.filter((x) => x !== p.id)))
                      }
                    />
                    <span className="truncate">{p.nome || p.email}</span>
                  </label>
                ))}
                {pessoasFiltradas.length === 0 && (
                  <p className="px-1.5 py-2 text-xs text-muted-foreground">Nenhuma pessoa encontrada.</p>
                )}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              Ao incluir participantes, o evento passa a ser compartilhado com eles.
            </p>
          </div>

          {!editando && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label>Repetir</Label>
                  <Select value={frequencia} onValueChange={(v) => setFrequencia(v as typeof frequencia)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Não repetir</SelectItem>
                      <SelectItem value="semanal">Semanalmente</SelectItem>
                      <SelectItem value="mensal">Mensalmente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {frequencia !== "nenhuma" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="evento-intervalo">A cada</Label>
                      <Input
                        id="evento-intervalo"
                        type="number"
                        min={1}
                        max={12}
                        value={intervalo}
                        onChange={(e) => setIntervalo(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="evento-ate">Até</Label>
                      <Input id="evento-ate" type="date" min={dataInicio} value={ate} onChange={(e) => setAte(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="evento-lembrete" className="text-sm font-normal">Lembrete automático</Label>
              <Switch id="evento-lembrete" checked={lembreteAtivo} onCheckedChange={setLembreteAtivo} />
            </div>
            {lembreteAtivo && (
              <div className="space-y-3">
                <Select value={String(antecedencia)} onValueChange={(v) => setAntecedencia(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANTECEDENCIAS.map((a) => (
                      <SelectItem key={a.valor} value={String(a.valor)}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={canalEmail} onCheckedChange={(v) => setCanalEmail(!!v)} />
                    E-mail
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={canalNotificacao} onCheckedChange={(v) => setCanalNotificacao(!!v)} />
                    Notificação
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
