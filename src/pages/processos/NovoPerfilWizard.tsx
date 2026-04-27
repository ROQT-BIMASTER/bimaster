import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, ShieldCheck, Sparkles, Trash2, Workflow } from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useProcessoPerfis, type ProcessoAmbiente } from "@/hooks/useProcessoPerfis";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AMBIENTES: { value: ProcessoAmbiente; label: string }[] = [
  { value: "china", label: "China" },
  { value: "brasil", label: "Brasil" },
  { value: "fabrica", label: "Fábrica" },
  { value: "projeto", label: "Projetos" },
  { value: "tarefa", label: "Tarefas" },
  { value: "universal", label: "Universal" },
];

interface EtapaDraft {
  codigo: string;
  label: string;
  requer_aprovacao: boolean;
}

export default function NovoPerfilWizard() {
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { create } = useProcessoPerfis();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [salvando, setSalvando] = useState(false);

  const [dados, setDados] = useState({
    nome: "",
    descricao: "",
    ambiente: "china" as ProcessoAmbiente,
    padrao: false,
  });

  const [etapas, setEtapas] = useState<EtapaDraft[]>([]);
  const [novaEtapa, setNovaEtapa] = useState<EtapaDraft>({ codigo: "", label: "", requer_aprovacao: false });

  const [regras, setRegras] = useState({
    bloqueioPorChecklist: true,
    aprovacaoFinalObrigatoria: false,
    aplicarAutomaticamente: false,
  });

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  // Validações
  const errosStep1 = (() => {
    const e: string[] = [];
    if (!dados.nome.trim()) e.push("Nome é obrigatório.");
    if (dados.nome.trim().length < 3) e.push("Nome deve ter pelo menos 3 caracteres.");
    return e;
  })();

  const errosStep2 = (() => {
    const e: string[] = [];
    if (etapas.length < 2) e.push("Adicione pelo menos 2 etapas.");
    const codigos = new Set<string>();
    for (const et of etapas) {
      if (codigos.has(et.codigo)) { e.push(`Código duplicado: ${et.codigo}`); break; }
      codigos.add(et.codigo);
    }
    return e;
  })();

  const adicionarEtapa = () => {
    if (!novaEtapa.label.trim()) return;
    const codigo = novaEtapa.codigo.trim() || novaEtapa.label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (etapas.some((e) => e.codigo === codigo)) {
      toast.error("Já existe uma etapa com esse código");
      return;
    }
    setEtapas([...etapas, { ...novaEtapa, codigo, label: novaEtapa.label.trim() }]);
    setNovaEtapa({ codigo: "", label: "", requer_aprovacao: false });
  };

  const removerEtapa = (idx: number) => setEtapas(etapas.filter((_, i) => i !== idx));

  const salvar = async () => {
    if (errosStep1.length || errosStep2.length) return;
    setSalvando(true);
    try {
      // 1. cria perfil
      const perfil = await create.mutateAsync({
        nome: dados.nome.trim(),
        descricao: dados.descricao.trim() || null,
        ambiente: dados.ambiente,
        padrao: dados.padrao,
        ativo: true,
      } as any);

      // 2. cria etapas
      if (etapas.length > 0) {
        const rows = etapas.map((e, idx) => ({
          perfil_id: perfil.id,
          codigo: e.codigo,
          label: e.label,
          ordem: idx,
          requer_aprovacao: e.requer_aprovacao || (regras.aprovacaoFinalObrigatoria && idx === etapas.length - 1),
        }));
        const { error } = await (supabase as any).from("processo_perfil_etapas").insert(rows);
        if (error) throw error;
      }

      toast.success("Perfil criado com sucesso");
      navigate("/dashboard/processos/perfis");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar perfil");
    } finally {
      setSalvando(false);
    }
  };

  const podeAvancarStep1 = errosStep1.length === 0;
  const podeAvancarStep2 = errosStep2.length === 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              Criar Perfil de Processo
            </h1>
            <p className="text-muted-foreground mt-1">Fluxo guiado em 3 etapas com validação.</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-2">
          {[
            { n: 1, label: "Identificação" },
            { n: 2, label: "Etapas" },
            { n: 3, label: "Regras & revisão" },
          ].map((s, idx, arr) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${step >= s.n ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
                  step > s.n ? "bg-primary text-primary-foreground border-primary"
                  : step === s.n ? "border-primary text-primary"
                  : "border-muted text-muted-foreground"
                }`}>
                  {step > s.n ? <CheckCircle2 className="h-4 w-4" /> : s.n}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
              </div>
              {idx < arr.length - 1 && <div className={`flex-1 h-px mx-2 ${step > s.n ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle className="text-base">1. Identificação do perfil</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} placeholder="ex: Lançamento Premium" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={dados.descricao} onChange={(e) => setDados({ ...dados, descricao: e.target.value })} rows={3} placeholder="Quando este perfil deve ser usado..." />
              </div>
              <div>
                <Label>Ambiente *</Label>
                <Select value={dados.ambiente} onValueChange={(v: ProcessoAmbiente) => setDados({ ...dados, ambiente: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AMBIENTES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm">Definir como padrão deste ambiente</Label>
                  <p className="text-xs text-muted-foreground">Aplicado automaticamente quando nenhuma regra específica corresponder.</p>
                </div>
                <Switch checked={dados.padrao} onCheckedChange={(v) => setDados({ ...dados, padrao: v })} />
              </div>

              {errosStep1.length > 0 && (
                <Alert variant="destructive">
                  <AlertTitle>Corrija antes de avançar</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-5">{errosStep1.map((e, i) => <li key={i}>{e}</li>)}</ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle className="text-base">2. Etapas do processo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3">
                  <Label>Código</Label>
                  <Input value={novaEtapa.codigo} onChange={(e) => setNovaEtapa({ ...novaEtapa, codigo: e.target.value })} placeholder="auto" />
                </div>
                <div className="col-span-5">
                  <Label>Rótulo *</Label>
                  <Input value={novaEtapa.label} onChange={(e) => setNovaEtapa({ ...novaEtapa, label: e.target.value })} placeholder="ex: Cadastro" />
                </div>
                <div className="col-span-3 flex items-center gap-2 pb-2">
                  <Switch checked={novaEtapa.requer_aprovacao} onCheckedChange={(v) => setNovaEtapa({ ...novaEtapa, requer_aprovacao: v })} />
                  <span className="text-xs">Aprovação</span>
                </div>
                <div className="col-span-1">
                  <Button onClick={adicionarEtapa} disabled={!novaEtapa.label.trim()} size="icon"><Plus className="h-4 w-4" /></Button>
                </div>
              </div>

              {etapas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 border-dashed border rounded-lg">
                  Nenhuma etapa adicionada. Comece adicionando pelo menos 2 etapas.
                </p>
              ) : (
                <div className="space-y-2">
                  {etapas.map((e, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 border rounded-lg">
                      <Badge variant="outline" className="font-mono">{idx + 1}</Badge>
                      <div className="flex-1">
                        <span className="font-medium text-sm">{e.label}</span>
                        <Badge variant="secondary" className="ml-2 text-xs font-mono">{e.codigo}</Badge>
                        {e.requer_aprovacao && (
                          <Badge variant="outline" className="ml-2 gap-1 text-xs text-warning border-warning/50">
                            <ShieldCheck className="h-3 w-3" /> Aprovação
                          </Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removerEtapa(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {errosStep2.length > 0 && (
                <Alert variant="destructive">
                  <AlertTitle>Corrija antes de avançar</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-5">{errosStep2.map((e, i) => <li key={i}>{e}</li>)}</ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle className="text-base">3. Regras & revisão</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm">Bloqueio por checklist</Label>
                  <p className="text-xs text-muted-foreground">Só avança se documentos e tarefas obrigatórias estiverem concluídos.</p>
                </div>
                <Switch checked={regras.bloqueioPorChecklist} onCheckedChange={(v) => setRegras({ ...regras, bloqueioPorChecklist: v })} />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm">Aprovação obrigatória na última etapa</Label>
                  <p className="text-xs text-muted-foreground">Marca automaticamente a etapa final como "requer aprovação".</p>
                </div>
                <Switch checked={regras.aprovacaoFinalObrigatoria} onCheckedChange={(v) => setRegras({ ...regras, aprovacaoFinalObrigatoria: v })} />
              </div>

              <Alert>
                <Workflow className="h-4 w-4" />
                <AlertTitle>Resumo</AlertTitle>
                <AlertDescription>
                  <div className="text-sm space-y-1 mt-2">
                    <div><b>Nome:</b> {dados.nome}</div>
                    <div><b>Ambiente:</b> {AMBIENTES.find((a) => a.value === dados.ambiente)?.label}</div>
                    <div><b>Etapas:</b> {etapas.length}</div>
                    <div><b>Padrão do ambiente:</b> {dados.padrao ? "Sim" : "Não"}</div>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3))}
              disabled={(step === 1 && !podeAvancarStep1) || (step === 2 && !podeAvancarStep2)}
            >
              Avançar <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Criar perfil"}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
