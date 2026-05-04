import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Settings2, RotateCcw, Sparkles, LayoutTemplate } from "lucide-react";
import { TemplatesManagerDialog } from "./kanban/TemplatesManagerDialog";
import {
  useKanbanPreferencias,
  COLUNA_ORDEM,
  DEFAULT_COLUNAS,
  getColunaConfig,
  type ModoVisao,
  type ColunasConfig,
  type ColunaKey,
} from "@/hooks/useKanbanPreferencias";
import type { KanbanPipeline } from "@/hooks/useKanbanAprovacoes";

/**
 * Templates pré-configurados por departamento. Aplicam labels semânticos
 * que se encaixam no vocabulário do time, mantendo a estrutura universal
 * de colunas (em_analise / em_revisao / aprovado / rejeitado / aguardando_outros).
 */
const TEMPLATES: { id: string; nome: string; descricao: string; colunas: ColunasConfig }[] = [
  {
    id: "padrao",
    nome: "Padrão (genérico)",
    descricao: "Em Análise · Em Revisão · Aprovado · Rejeitado",
    colunas: {
      em_analise: { label: "Em Análise", visivel: true },
      em_revisao: { label: "Em Revisão", visivel: true },
      aguardando_outros: { label: "Aguardando outros", visivel: false },
      aprovado: { label: "Aprovado", visivel: true },
      rejeitado: { label: "Rejeitado", visivel: true },
    },
  },
  {
    id: "marketing",
    nome: "Marketing & Arte",
    descricao: "Briefing · Em Criação · Aprovado · Reprovado",
    colunas: {
      em_analise: { label: "Briefing recebido", visivel: true },
      em_revisao: { label: "Em criação / ajustes", visivel: true },
      aguardando_outros: { label: "Aguardando cliente", visivel: true },
      aprovado: { label: "Aprovado para veiculação", visivel: true },
      rejeitado: { label: "Reprovado", visivel: true },
    },
  },
  {
    id: "regulatorio",
    nome: "Regulatório",
    descricao: "Análise técnica · Pendências · Conforme · Não conforme",
    colunas: {
      em_analise: { label: "Análise técnica", visivel: true },
      em_revisao: { label: "Pendências do dossiê", visivel: true },
      aguardando_outros: { label: "Aguardando órgão", visivel: true },
      aprovado: { label: "Conforme", visivel: true },
      rejeitado: { label: "Não conforme", visivel: true },
    },
  },
  {
    id: "fabrica",
    nome: "Fábrica & PLM",
    descricao: "Submissão · Ajustes BOM · Liberado · Reprovado",
    colunas: {
      em_analise: { label: "Submissão", visivel: true },
      em_revisao: { label: "Ajustes de BOM/ficha", visivel: true },
      aguardando_outros: { label: "Aguardando fornecedor", visivel: true },
      aprovado: { label: "Liberado para produção", visivel: true },
      rejeitado: { label: "Reprovado", visivel: true },
    },
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Recebido · Conferência · Aprovado p/ pagto · Rejeitado",
    colunas: {
      em_analise: { label: "Recebido", visivel: true },
      em_revisao: { label: "Conferência / pendências", visivel: true },
      aguardando_outros: { label: "Aguardando alçada", visivel: true },
      aprovado: { label: "Aprovado para pagamento", visivel: true },
      rejeitado: { label: "Rejeitado", visivel: true },
    },
  },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelinesDisponiveis: KanbanPipeline[];
  showModoVisao?: boolean;
}

export function KanbanConfigSheet({
  open,
  onOpenChange,
  pipelinesDisponiveis,
  showModoVisao = true,
}: Props) {
  const { prefs, update } = useKanbanPreferencias();
  const [modo, setModo] = useState<ModoVisao>(prefs.modo_visao);
  const [pipes, setPipes] = useState<string[]>(prefs.pipelines_visiveis);
  const [colunas, setColunas] = useState<ColunasConfig>(prefs.colunas_config ?? {});
  const [templatesOpen, setTemplatesOpen] = useState(false);
  useEffect(() => {
    if (open) {
      setModo(prefs.modo_visao);
      setPipes(prefs.pipelines_visiveis);
      setColunas(prefs.colunas_config ?? {});
    }
  }, [open, prefs]);

  function togglePipe(id: string) {
    setPipes((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function setColuna(key: ColunaKey, patch: Partial<{ label: string; visivel: boolean }>) {
    setColunas((cur) => {
      const atual = cur[key] ?? DEFAULT_COLUNAS[key];
      return { ...cur, [key]: { ...atual, ...patch } };
    });
  }

  function resetColunas() {
    setColunas({});
  }

  async function salvar() {
    await update.mutateAsync({
      modo_visao: modo,
      pipelines_visiveis: pipes,
      colunas_config: colunas,
    });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" /> Configurar Kanban
          </SheetTitle>
          <SheetDescription className="text-xs">
            Suas preferências são pessoais e ficam salvas para a próxima vez.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {showModoVisao && (
            <div className="space-y-1.5">
              <Label className="text-xs">Modo de visão</Label>
              <Select value={modo} onValueChange={(v) => setModo(v as ModoVisao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minhas">Minhas pendências</SelectItem>
                  <SelectItem value="equipe">Equipe (projetos onde participo)</SelectItem>
                  <SelectItem value="coordenacao">
                    Coordenação (projetos que coordeno)
                  </SelectItem>
                  <SelectItem value="todas">Todas (admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Templates (sistema + meus + equipe + departamento) */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Templates
            </Label>
            <p className="text-[10px] text-muted-foreground">
              Aplique um template pronto, crie um pessoal, ou compartilhe com sua
              equipe ou departamento — incluindo responsável por etapa.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs h-8"
              onClick={() => setTemplatesOpen(true)}
            >
              <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" />
              Gerenciar templates de Kanban
            </Button>
          </div>

          <Separator />

          {/* Colunas universais */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Colunas do Kanban</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={resetColunas}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar padrão
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Renomeie ou oculte colunas. As colunas representam o estado macro
              do documento — a jornada específica de cada pipeline aparece ao
              clicar no card.
            </p>

            <div className="space-y-2 pt-1">
              {COLUNA_ORDEM.map((k) => {
                const cfg = getColunaConfig({ ...prefs, colunas_config: colunas } as any, k);
                return (
                  <div
                    key={k}
                    className="flex items-center gap-2 rounded-md border border-border p-2"
                  >
                    <Switch
                      checked={cfg.visivel}
                      onCheckedChange={(v) => setColuna(k, { visivel: v })}
                    />
                    <Input
                      value={cfg.label}
                      onChange={(e) => setColuna(k, { label: e.target.value })}
                      className="h-7 text-xs flex-1"
                      placeholder={DEFAULT_COLUNAS[k].label}
                    />
                    <span className="text-[9px] text-muted-foreground/70 font-mono">
                      {k}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Pipelines visíveis */}
          <div className="space-y-1.5">
            <Label className="text-xs">Pipelines visíveis</Label>
            <p className="text-[10px] text-muted-foreground">
              Vazio = todos os pipelines ativos.
            </p>
            <ScrollArea className="h-48 rounded-md border border-border p-2">
              <div className="space-y-1">
                {pipelinesDisponiveis.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum pipeline configurado.
                  </p>
                )}
                {pipelinesDisponiveis.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      checked={pipes.length === 0 ? true : pipes.includes(p.id)}
                      onCheckedChange={() => togglePipe(p.id)}
                    />
                    <span className="text-xs">{p.nome}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {p.etapas.length} etapa{p.etapas.length === 1 ? "" : "s"}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={update.isPending}>
            {update.isPending && (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            )}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
