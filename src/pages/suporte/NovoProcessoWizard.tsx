import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, Loader2, Workflow, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { useProcesso, useProcessos } from "@/hooks/suporte/useProcessos";
import { ProcessoCanvas } from "@/components/suporte/ProcessoCanvas";
import { ProcessoConfigSLA } from "@/components/suporte/ProcessoConfigSLA";
import { StepVinculoProjetos } from "@/components/suporte/wizard/StepVinculoProjetos";
import { StepRevisao } from "@/components/suporte/wizard/StepRevisao";
import { toast } from "sonner";

const STEPS = [
  { id: 1, label: "Identidade" },
  { id: 2, label: "Etapas (BPMN)" },
  { id: 3, label: "SLA & escalonamento" },
  { id: 4, label: "Vínculo com Projetos" },
  { id: 5, label: "Revisão & publicação" },
];

export default function NovoProcessoWizard() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!routeId;

  const [processoId, setProcessoId] = useState<string | null>(routeId ?? null);
  const [step, setStep] = useState(1);

  const { data: filas = [] } = useSuporteFilas();
  const { data: proc } = useProcesso(processoId);

  // Passo 1 (identidade)
  const [nome, setNome] = useState(proc?.processo?.nome ?? "");
  const [descricao, setDescricao] = useState(proc?.processo?.descricao ?? "");
  const [cor, setCor] = useState(proc?.processo?.cor ?? "#6366f1");
  const [filaDonaId, setFilaDonaId] = useState(proc?.processo?.fila_dona_id ?? "");
  const [saving, setSaving] = useState(false);
  const [publicando, setPublicando] = useState(false);

  // Sincroniza defaults quando o proc carrega em modo edit
  const [hidratado, setHidratado] = useState(false);
  if (isEdit && proc?.processo && !hidratado) {
    setNome(proc.processo.nome);
    setDescricao(proc.processo.descricao ?? "");
    setCor(proc.processo.cor ?? "#6366f1");
    setFilaDonaId(proc.processo.fila_dona_id);
    setHidratado(true);
  }

  const salvarIdentidade = async () => {
    if (!nome.trim() || !filaDonaId) {
      toast.error("Informe nome e fila dona.");
      return;
    }
    setSaving(true);
    try {
      if (processoId) {
        const { error } = await supabase
          .from("processos_operacionais" as any)
          .update({ nome: nome.trim(), descricao, cor, fila_dona_id: filaDonaId })
          .eq("id", processoId);
        if (error) throw error;
      } else {
        const { data: uid } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("processos_operacionais" as any)
          .insert({
            nome: nome.trim(),
            descricao,
            cor,
            fila_dona_id: filaDonaId,
            criador_id: uid.user?.id ?? null,
            ativo: false,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        setProcessoId((data as any).id);
      }
      setStep((s) => Math.min(5, s + 1));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar identidade.");
    } finally {
      setSaving(false);
    }
  };

  const publicar = async () => {
    if (!processoId) return;
    setPublicando(true);
    try {
      const { data, error } = await supabase.rpc("rpc_validar_processo" as any, {
        _processo_id: processoId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) {
        toast.error(
          `Publicação bloqueada: ${(result?.erros ?? []).join(" ") || "verifique o processo."}`,
        );
        return;
      }
      const { error: upErr } = await supabase
        .from("processos_operacionais" as any)
        .update({ ativo: true })
        .eq("id", processoId);
      if (upErr) throw upErr;
      const avisos = (result?.avisos ?? []) as string[];
      if (avisos.length) {
        toast.warning(`Publicado com avisos: ${avisos.join(" ")}`);
      } else {
        toast.success("Processo publicado.");
      }
      navigate(`/dashboard/suporte/processos/${processoId}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao publicar.");
    } finally {
      setPublicando(false);
    }
  };

  const canGoNext = step === 1 ? !!nome.trim() && !!filaDonaId : !!processoId;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/suporte/rotinas-fixas">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Workflow className="h-6 w-6 text-primary" />
              {isEdit ? "Editar processo operacional" : "Novo processo operacional"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure BPMN, SLA, escalonamento e vínculo com projetos em um só lugar.
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 flex-wrap">
          {STEPS.map((s) => {
            const done = s.id < step;
            const active = s.id === step;
            const disabled = !processoId && s.id > 1;
            return (
              <button
                key={s.id}
                disabled={disabled}
                onClick={() => !disabled && setStep(s.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                      : "border-border bg-card text-muted-foreground"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span className="h-5 w-5 rounded-full bg-background/60 inline-flex items-center justify-center text-[10px] font-semibold">
                  {done ? <Check className="h-3 w-3" /> : s.id}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Passo 1 */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identidade do processo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <Label>Nome</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Fluxo de aprovação de crédito"
                />
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  value={descricao ?? ""}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Fila dona</Label>
                <Select value={filaDonaId} onValueChange={setFilaDonaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a fila responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {filas.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: f.cor ?? "#94a3b8" }}
                          />
                          {f.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Cor do processo</Label>
                <Input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="w-24 h-9 p-1"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Passo 2 - Canvas BPMN */}
        {step === 2 && processoId && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Etapas & swimlanes</CardTitle>
              <p className="text-xs text-muted-foreground">
                Adicione rotinas fixas como etapas (via botão "+ Etapa" no canvas). Arraste
                para reposicionar; conecte para criar ligações com SLA de handoff.
              </p>
            </CardHeader>
            <CardContent>
              <ProcessoCanvas processoId={processoId} />
            </CardContent>
          </Card>
        )}

        {/* Passo 3 - SLA */}
        {step === 3 && processoId && <ProcessoConfigSLA processoId={processoId} />}

        {/* Passo 4 - Vínculo com projetos */}
        {step === 4 && processoId && <StepVinculoProjetos processoId={processoId} />}

        {/* Passo 5 - Revisão */}
        {step === 5 && processoId && (
          <StepRevisao processoId={processoId} onPublicar={publicar} publicando={publicando} />
        )}

        {/* Navegação */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <div className="flex items-center gap-2">
            {processoId && (
              <Badge variant="secondary" className="text-xs">
                Rascunho salvo
              </Badge>
            )}
            {step === 1 ? (
              <Button size="sm" onClick={salvarIdentidade} disabled={saving || !canGoNext}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Salvar e continuar
              </Button>
            ) : step < 5 ? (
              <Button
                size="sm"
                onClick={() => setStep((s) => Math.min(5, s + 1))}
                disabled={!canGoNext}
              >
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
