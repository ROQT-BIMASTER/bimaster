import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useProjetos } from "@/hooks/useProjetos";
import { useProjetoModelos } from "@/hooks/useProjetoModelos";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useUserDepartments, useAllDepartments } from "@/hooks/useUserDepartments";
import { ChevronRight, ChevronLeft, Target, Trash2, Plus, CalendarDays, FolderTree, User as UserIcon, Users, Globe2 } from "lucide-react";

const CORES = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4"];
const DEV_DEPARTMENT_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";
const DEV_DEPT_NAME_MATCHES = ["projetos", "projects", "desenvolvimento de produto", "desenvolvimento de produtos"];

const ORIGENS = [
  { value: "china", label: "China (Importação)" },
  { value: "brasil", label: "Brasil (Nacional)" },
  { value: "collab", label: "Collab / Parceria" },
  { value: "recompra", label: "Recompra" },
];

const MARCAS = ["Ruby Rose", "HB", "Maiana", "Outra"];

const REGIMES = [
  { value: "dias_uteis", label: "Apenas dias úteis", desc: "Pula sábado, domingo e feriados" },
  { value: "uteis_com_sabado", label: "Dias úteis + sábado", desc: "Pula apenas domingo e feriados" },
  { value: "corridos", label: "Dias corridos", desc: "Conta todos os dias do calendário" },
] as const;

const TIPOS_META = [
  { value: "entrega", label: "Entrega" },
  { value: "prazo", label: "Prazo" },
  { value: "qualidade", label: "Qualidade" },
  { value: "custo", label: "Custo" },
  { value: "volume", label: "Volume" },
] as const;

type TipoMeta = (typeof TIPOS_META)[number]["value"];

export const TEMPLATES = {
  generico: {
    label: "Projeto Genérico",
    desc: "Seções padrão para tarefas do dia a dia",
    secoes: [
      "Atribuídas recentemente",
      "A fazer hoje",
      "A fazer na próxima semana",
      "A fazer mais tarde",
    ],
  },
  desenvolvimento_produto: {
    label: "Desenvolvimento de Produto",
    desc: "Pipeline completo: Criação → Embalagem → Regulatório → Lançamento",
    secoes: [
      "Criação / Identidade",
      "Desenvolvimento de Produtos",
      "Desenvolvimento de Embalagem",
      "Informações dos Produtos (Briefing)",
      "Assuntos Regulatórios",
      "Criação / Artes",
    ],
  },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

interface MetaInicial {
  titulo: string;
  tipo: TipoMeta;
  valor_alvo: number;
  unidade: string;
  data_alvo: string;
  peso: number;
}

interface NovoProjetoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovoProjetoDialog({ open, onOpenChange }: NovoProjetoDialogProps) {
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [template, setTemplate] = useState<TemplateKey>("generico");
  const [departamentoIds, setDepartamentoIds] = useState<string[]>([]);
  const [marca, setMarca] = useState("");
  const [categoriaLinha, setCategoriaLinha] = useState("");
  const [origemProjeto, setOrigemProjeto] = useState("brasil");

  // Prazos & Metas
  const [regimeCalendario, setRegimeCalendario] = useState<"corridos" | "dias_uteis" | "uteis_com_sabado">("dias_uteis");
  const [usaFeriados, setUsaFeriados] = useState(true);
  const [ufFeriados, setUfFeriados] = useState("BR");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFimAlvo, setDataFimAlvo] = useState("");
  const [prazoPadraoTarefa, setPrazoPadraoTarefa] = useState(5);
  const [alertaAntecipacaoDias, setAlertaAntecipacaoDias] = useState(2);
  const [metasIniciais, setMetasIniciais] = useState<MetaInicial[]>([]);

  const { createProjeto } = useProjetos();
  const { isAdmin, role } = usePermissions();
  const isManagerRole = isAdmin || ["gerente", "coordenador", "supervisor"].includes((role || "").toLowerCase());
  const { data: userDepartments = [] } = useUserDepartments();
  const { data: allDepartments = [] } = useAllDepartments();

  const isDevTeam = isAdmin || userDepartments.some((d) => d.id === DEV_DEPARTMENT_ID);
  const isDevProduto = template === "desenvolvimento_produto";
  const canConfigurePrazos = isManagerRole;

  // Steps: 1 = básico | 2 = (apenas se devProduto) marca/origem | 3 = prazos&metas (se gerente/admin)
  const steps: number[] = [1];
  if (isDevProduto) steps.push(2);
  if (canConfigurePrazos) steps.push(3);
  const totalSteps = steps.length;
  const currentStepNumber = steps[step - 1];

  const handleSubmit = async () => {
    if (!nome.trim()) return;
    await createProjeto.mutateAsync({
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      cor,
      template,
      departamento_ids: departamentoIds.length > 0 ? departamentoIds : undefined,
      ...(isDevProduto
        ? {
            marca: marca || undefined,
            categoriaLinha: categoriaLinha || undefined,
            origemProjeto,
          }
        : {}),
      ...(canConfigurePrazos
        ? {
            regime_calendario: regimeCalendario,
            usa_feriados: usaFeriados,
            uf_feriados: ufFeriados,
            data_inicio: dataInicio || undefined,
            data_fim_alvo: dataFimAlvo || undefined,
            prazo_padrao_tarefa: prazoPadraoTarefa,
            alerta_antecipacao_dias: alertaAntecipacaoDias,
            metas_iniciais: metasIniciais
              .filter((m) => m.titulo.trim() && m.valor_alvo > 0)
              .map((m) => ({
                titulo: m.titulo.trim(),
                tipo: m.tipo,
                valor_alvo: m.valor_alvo,
                unidade: m.unidade || undefined,
                data_alvo: m.data_alvo || undefined,
                peso: m.peso || 1,
              })),
          }
        : {}),
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setNome("");
    setDescricao("");
    setCor(CORES[0]);
    setTemplate("generico");
    setDepartamentoIds([]);
    setMarca("");
    setCategoriaLinha("");
    setOrigemProjeto("brasil");
    setRegimeCalendario("dias_uteis");
    setUsaFeriados(true);
    setUfFeriados("BR");
    setDataInicio("");
    setDataFimAlvo("");
    setPrazoPadraoTarefa(5);
    setAlertaAntecipacaoDias(2);
    setMetasIniciais([]);
    setStep(1);
    onOpenChange(false);
  };

  const adicionarMeta = () => {
    setMetasIniciais((prev) => [
      ...prev,
      { titulo: "", tipo: "entrega", valor_alvo: 100, unidade: "%", data_alvo: dataFimAlvo || "", peso: 1 },
    ]);
  };

  const removerMeta = (idx: number) => {
    setMetasIniciais((prev) => prev.filter((_, i) => i !== idx));
  };

  const atualizarMeta = <K extends keyof MetaInicial>(idx: number, key: K, value: MetaInicial[K]) => {
    setMetasIniciais((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m)));
  };

  const canNext = step === 1 ? nome.trim().length > 0 : true;
  const isLastStep = step === totalSteps;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Novo Projeto
            {totalSteps > 1 && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                Passo {step} de {totalSteps}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1 — básico */}
        {currentStepNumber === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do projeto</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Institucional | Ruby Rose" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Breve descrição do projeto" />
            </div>

            <div className="space-y-2">
              <Label>Template</Label>
              <RadioGroup value={template} onValueChange={(v) => setTemplate(v as TemplateKey)} className="space-y-2">
                {(isDevTeam ? Object.entries(TEMPLATES) : Object.entries(TEMPLATES).filter(([k]) => k === "generico")).map(([key, t]) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 cursor-pointer hover:bg-muted/30 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <RadioGroupItem value={key} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {CORES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCor(c)}
                    className="w-8 h-8 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: cor === c ? "white" : "transparent", transform: cor === c ? "scale(1.2)" : "scale(1)" }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Departamentos (opcional)</Label>
              <div className="flex flex-wrap gap-x-5 gap-y-2 p-3 rounded-lg border border-border/50">
                {(isAdmin ? allDepartments : userDepartments).map((d: any) => {
                  const isChecked = departamentoIds.includes(d.id);
                  return (
                    <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          setDepartamentoIds((prev) => (checked ? [...prev, d.id] : prev.filter((id) => id !== d.id)));
                        }}
                      />
                      <span className="text-sm">{d.nome}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Vincular a departamentos permite que todos os membros desses departamentos vejam o projeto.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2 — DevProduto extras */}
        {currentStepNumber === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dados adicionais para o projeto de desenvolvimento de produto.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Select value={marca} onValueChange={setMarca}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {MARCAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select value={origemProjeto} onValueChange={setOrigemProjeto}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORIGENS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria / Linha</Label>
              <Input value={categoriaLinha} onChange={(e) => setCategoriaLinha(e.target.value)} placeholder="Ex: Maquiagem, Skincare, Corpo..." />
            </div>
          </div>
        )}

        {/* STEP 3 — Prazos & Metas (somente Admin/Gerente/Coordenador) */}
        {currentStepNumber === 3 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <CalendarDays className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-foreground">Configuração de prazos e metas</p>
                <p className="text-muted-foreground mt-1">
                  Define como o sistema calcula prazos das tarefas (dias úteis vs corridos) e estabelece metas
                  formais que serão acompanhadas no Painel de Metas.
                </p>
              </div>
            </div>

            {/* Regime do calendário */}
            <div className="space-y-2">
              <Label>Regime de cálculo de prazos</Label>
              <RadioGroup value={regimeCalendario} onValueChange={(v: any) => setRegimeCalendario(v)} className="space-y-2">
                {REGIMES.map((r) => (
                  <label
                    key={r.value}
                    className="flex items-start gap-3 p-2.5 rounded-lg border border-border/50 cursor-pointer hover:bg-muted/30 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <RadioGroupItem value={r.value} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Feriados */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
              <div>
                <Label className="text-sm">Considerar feriados nacionais</Label>
                <p className="text-[11px] text-muted-foreground">
                  Sincronizados via BrasilAPI. Configure feriados em Admin → Calendário Corporativo.
                </p>
              </div>
              <Switch checked={usaFeriados} onCheckedChange={setUsaFeriados} disabled={regimeCalendario === "corridos"} />
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Entrega-alvo</Label>
                <Input type="date" value={dataFimAlvo} onChange={(e) => setDataFimAlvo(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prazo padrão por tarefa (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={prazoPadraoTarefa}
                  onChange={(e) => setPrazoPadraoTarefa(parseInt(e.target.value) || 5)}
                />
              </div>
              <div className="space-y-2">
                <Label>Alerta de antecipação (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={alertaAntecipacaoDias}
                  onChange={(e) => setAlertaAntecipacaoDias(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Metas iniciais */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Metas iniciais ({metasIniciais.length})
                </Label>
                <Button type="button" size="sm" variant="outline" onClick={adicionarMeta}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar meta
                </Button>
              </div>
              {metasIniciais.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 rounded-lg border border-dashed border-border text-center">
                  Nenhuma meta cadastrada. Você poderá adicionar depois pelo Painel de Metas.
                </p>
              ) : (
                <div className="space-y-2">
                  {metasIniciais.map((m, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-border/60 space-y-2 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Título da meta (ex: Lançar 5 SKUs no Q1)"
                          value={m.titulo}
                          onChange={(e) => atualizarMeta(idx, "titulo", e.target.value)}
                          className="flex-1"
                        />
                        <Button type="button" size="icon" variant="ghost" onClick={() => removerMeta(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <Select value={m.tipo} onValueChange={(v: TipoMeta) => atualizarMeta(idx, "tipo", v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIPOS_META.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Alvo"
                          value={m.valor_alvo}
                          onChange={(e) => atualizarMeta(idx, "valor_alvo", parseFloat(e.target.value) || 0)}
                          className="h-9 text-xs"
                        />
                        <Input
                          placeholder="Unidade"
                          value={m.unidade}
                          onChange={(e) => atualizarMeta(idx, "unidade", e.target.value)}
                          className="h-9 text-xs"
                        />
                        <Input
                          type="date"
                          value={m.data_alvo}
                          onChange={(e) => atualizarMeta(idx, "data_alvo", e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Peso:</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={m.peso}
                          onChange={(e) => atualizarMeta(idx, "peso", parseInt(e.target.value) || 1)}
                          className="h-8 w-20 text-xs"
                        />
                        <Badge variant="outline" className="text-[10px]">
                          Ponderação no score do projeto
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview na última etapa */}
        {isLastStep && (
          <div className="space-y-2 pt-2">
            <Label className="text-muted-foreground text-xs">Preview do projeto</Label>
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0"
                style={{ backgroundColor: cor }}
              >
                <span className="text-white text-lg font-bold">{nome.charAt(0) || "?"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{nome || "Nome do projeto"}</p>
                {descricao && <p className="text-xs text-muted-foreground truncate">{descricao}</p>}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {TEMPLATES[template].label}
                  </span>
                  {marca && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{marca}</span>}
                  {canConfigurePrazos && (
                    <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {REGIMES.find((r) => r.value === regimeCalendario)?.label}
                    </span>
                  )}
                  {metasIniciais.length > 0 && (
                    <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {metasIniciais.length} meta(s)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
            {!isLastStep ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!nome.trim() || createProjeto.isPending}>
                {createProjeto.isPending ? "Criando..." : "Criar Projeto"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
