import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useProjeto, useProjetos } from "@/hooks/useProjetos";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
  useUserDepartments,
  useAllDepartments,
} from "@/hooks/useUserDepartments";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";

const CORES = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
];

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

type Regime = (typeof REGIMES)[number]["value"];

interface Props {
  projetoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditarProjetoDialog({ projetoId, open, onOpenChange }: Props) {
  const { data: projeto, isLoading } = useProjeto(open ? projetoId : undefined);
  const { updateProjetoConfig } = useProjetos();
  const { isAdmin, role } = usePermissions();
  const isManagerRole =
    isAdmin ||
    ["gerente", "coordenador", "supervisor"].includes(
      (role || "").toLowerCase(),
    );
  const canConfigurePrazos = isManagerRole;

  const { data: userDepartments = [] } = useUserDepartments();
  const { data: allDepartments = [] } = useAllDepartments();
  const departamentosList = isAdmin ? allDepartments : userDepartments;

  // Vínculos atuais
  const { data: vinculosAtuais = [] } = useQuery({
    queryKey: ["projeto-departamentos-atuais", projetoId],
    enabled: open && !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_departamentos")
        .select("departamento_id")
        .eq("projeto_id", projetoId);
      if (error) throw error;
      return (data || []).map((r: any) => r.departamento_id as string);
    },
  });

  // Estado do form
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [departamentoIds, setDepartamentoIds] = useState<string[]>([]);
  const [marca, setMarca] = useState("");
  const [categoriaLinha, setCategoriaLinha] = useState("");
  const [origemProjeto, setOrigemProjeto] = useState("brasil");
  const [regimeCalendario, setRegimeCalendario] = useState<Regime>("dias_uteis");
  const [usaFeriados, setUsaFeriados] = useState(true);
  const [ufFeriados, setUfFeriados] = useState("BR");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFimAlvo, setDataFimAlvo] = useState("");
  const [prazoPadraoTarefa, setPrazoPadraoTarefa] = useState(5);
  const [alertaAntecipacaoDias, setAlertaAntecipacaoDias] = useState(2);

  // Pré-preencher quando o projeto carrega
  useEffect(() => {
    if (!open || !projeto) return;
    setNome(projeto.nome ?? "");
    setDescricao(projeto.descricao ?? "");
    setCor(projeto.cor ?? CORES[0]);
    setMarca((projeto as any).marca ?? "");
    setCategoriaLinha((projeto as any).categoria_linha ?? "");
    setOrigemProjeto((projeto as any).origem_projeto ?? "brasil");
    setRegimeCalendario(((projeto as any).regime_calendario as Regime) ?? "dias_uteis");
    setUsaFeriados(projeto.usa_feriados ?? true);
    setUfFeriados(projeto.uf_feriados ?? "BR");
    setDataInicio(projeto.data_inicio ?? "");
    setDataFimAlvo(projeto.data_fim_alvo ?? "");
    setPrazoPadraoTarefa(projeto.prazo_padrao_tarefa ?? 5);
    setAlertaAntecipacaoDias(projeto.alerta_antecipacao_dias ?? 2);
  }, [open, projeto]);

  useEffect(() => {
    if (open) setDepartamentoIds(vinculosAtuais);
  }, [open, vinculosAtuais]);

  const isDevProduto = projeto?.tipo === "desenvolvimento_produto";

  const handleSalvar = async () => {
    if (!projeto) return;
    if (!nome.trim()) return;

    const patch: Parameters<typeof updateProjetoConfig.mutateAsync>[0]["patch"] = {
      nome: nome.trim(),
      descricao: descricao.trim() ? descricao.trim() : null,
      cor,
    };

    if (isDevProduto) {
      patch.marca = marca || null;
      patch.categoria_linha = categoriaLinha.trim() || null;
      patch.origem_projeto = origemProjeto || null;
    }

    if (canConfigurePrazos) {
      patch.regime_calendario = regimeCalendario;
      patch.usa_feriados = usaFeriados;
      patch.uf_feriados = ufFeriados;
      patch.data_inicio = dataInicio || null;
      patch.data_fim_alvo = dataFimAlvo || null;
      patch.prazo_padrao_tarefa = prazoPadraoTarefa;
      patch.alerta_antecipacao_dias = alertaAntecipacaoDias;
    }

    try {
      await updateProjetoConfig.mutateAsync({
        id: projeto.id,
        patch,
        departamento_ids: departamentoIds,
      });
      onOpenChange(false);
    } catch {
      /* toast já tratado no hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar projeto</DialogTitle>
        </DialogHeader>

        {isLoading || !projeto ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Carregando configurações...
          </div>
        ) : (
          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              {isDevProduto && (
                <TabsTrigger value="produto">Desenvolvimento de produto</TabsTrigger>
              )}
              {canConfigurePrazos && (
                <TabsTrigger value="prazos">Prazos</TabsTrigger>
              )}
            </TabsList>

            {/* BÁSICO */}
            <TabsContent value="basico" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome do projeto</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Breve descrição do projeto"
                />
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex gap-2">
                  {CORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCor(c)}
                      className="w-8 h-8 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: cor === c ? "white" : "transparent",
                        transform: cor === c ? "scale(1.2)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Departamentos</Label>
                <div className="flex flex-wrap gap-x-5 gap-y-2 p-3 rounded-lg border border-border/50">
                  {departamentosList.map((d: any) => {
                    const isChecked = departamentoIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            setDepartamentoIds((prev) =>
                              checked
                                ? [...prev, d.id]
                                : prev.filter((id) => id !== d.id),
                            );
                          }}
                        />
                        <span className="text-sm">{d.nome}</span>
                      </label>
                    );
                  })}
                  {departamentosList.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhum departamento disponível.
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Vincular a departamentos permite que todos os membros desses
                  departamentos vejam o projeto.
                </p>
              </div>
            </TabsContent>

            {/* DEV PRODUTO */}
            {isDevProduto && (
              <TabsContent value="produto" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <Select value={marca} onValueChange={setMarca}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MARCAS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Origem</Label>
                    <Select value={origemProjeto} onValueChange={setOrigemProjeto}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORIGENS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoria / Linha</Label>
                  <Input
                    value={categoriaLinha}
                    onChange={(e) => setCategoriaLinha(e.target.value)}
                    placeholder="Ex: Maquiagem, Skincare, Corpo..."
                  />
                </div>
              </TabsContent>
            )}

            {/* PRAZOS */}
            {canConfigurePrazos && (
              <TabsContent value="prazos" className="space-y-5 mt-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <CalendarDays className="h-5 w-5 text-primary mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-foreground">
                      Configuração de prazos
                    </p>
                    <p className="text-muted-foreground mt-1">
                      Define como o sistema calcula prazos das tarefas (dias úteis
                      vs corridos). Metas continuam editáveis pelo Painel de Metas.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Regime de cálculo de prazos</Label>
                  <RadioGroup
                    value={regimeCalendario}
                    onValueChange={(v: any) => setRegimeCalendario(v)}
                    className="space-y-2"
                  >
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

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                  <div>
                    <Label className="text-sm">
                      Considerar feriados nacionais
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Sincronizados via BrasilAPI. Configure feriados em Admin →
                      Calendário Corporativo.
                    </p>
                  </div>
                  <Switch
                    checked={usaFeriados}
                    onCheckedChange={setUsaFeriados}
                    disabled={regimeCalendario === "corridos"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Data de início</Label>
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Entrega-alvo</Label>
                    <Input
                      type="date"
                      value={dataFimAlvo}
                      onChange={(e) => setDataFimAlvo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Prazo padrão por tarefa (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={prazoPadraoTarefa}
                      onChange={(e) =>
                        setPrazoPadraoTarefa(parseInt(e.target.value) || 5)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Alerta de antecipação (dias)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={alertaAntecipacaoDias}
                      onChange={(e) =>
                        setAlertaAntecipacaoDias(parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={
              !projeto ||
              !nome.trim() ||
              updateProjetoConfig.isPending
            }
          >
            {updateProjetoConfig.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
