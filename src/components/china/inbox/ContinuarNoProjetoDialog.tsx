import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Folder, FolderPlus, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useProjetosParaVinculo } from "@/hooks/useChinaTarefaVinculos";
import { useCriarProjetoEspelho, useProjetoEspelhoDaSubmissao } from "@/hooks/useProjetoEspelhoSubmissao";
import { useTemplatesB2C } from "@/hooks/useChecklistB2C";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissaoId: string | null;
  produtoCodigo?: string | null;
  produtoNome?: string | null;
}

/**
 * Diálogo da Mesa China para "Continuar no projeto":
 *  - Vincular a um projeto existente, OU
 *  - Criar um novo projeto-espelho (tipo='china_submissao').
 *
 * Opcionalmente popula o checklist Brasil → China a partir de um template.
 * Se a submissão já possui projeto-espelho, exibe atalho "Abrir projeto".
 */
export function ContinuarNoProjetoDialog({
  open, onOpenChange, submissaoId, produtoCodigo, produtoNome,
}: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"vincular" | "criar">("criar");
  const [search, setSearch] = useState("");
  const [projetoSelecionado, setProjetoSelecionado] = useState<string | null>(null);
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [templateId, setTemplateId] = useState<string>("__none__");

  const { data: projetos = [], isLoading: loadingProjetos } = useProjetosParaVinculo();
  const { data: templates = [] } = useTemplatesB2C();
  const { data: espelhoExistente } = useProjetoEspelhoDaSubmissao(submissaoId);
  const criar = useCriarProjetoEspelho();

  useEffect(() => {
    if (open && produtoCodigo) {
      setNomeProjeto(`Submissão ${produtoCodigo}${produtoNome ? ` — ${produtoNome}` : ""}`);
    }
  }, [open, produtoCodigo, produtoNome]);

  const filteredProjetos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projetos;
    return (projetos as any[]).filter((p) => (p.nome ?? "").toLowerCase().includes(q));
  }, [projetos, search]);

  const close = () => {
    setSearch("");
    setProjetoSelecionado(null);
    setTemplateId("__none__");
    onOpenChange(false);
  };

  const handleAbrirExistente = () => {
    if (!espelhoExistente?.projeto_id) return;
    navigate(`/dashboard/projetos/${espelhoExistente.projeto_id}?tab=submissao_board`);
    close();
  };

  const handleSubmit = async () => {
    if (!submissaoId) return;
    const tpl = templateId !== "__none__" ? templateId : null;
    const res = await criar.mutateAsync({
      submissaoId,
      projetoId: tab === "vincular" ? projetoSelecionado : null,
      projetoNome: tab === "criar" ? nomeProjeto.trim() || null : null,
      templateB2cId: tpl,
    });
    navigate(`/dashboard/projetos/${res.projeto_id}?tab=submissao_board`);
    close();
  };

  const canSubmit =
    !!submissaoId &&
    !criar.isPending &&
    ((tab === "vincular" && !!projetoSelecionado) ||
      (tab === "criar" && nomeProjeto.trim().length >= 3));

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Continuar no projeto</DialogTitle>
        </DialogHeader>

        {espelhoExistente && (
          <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Projeto-espelho já existe
                </p>
                <p className="text-xs text-muted-foreground">
                  Esta submissão já possui um projeto vinculado.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleAbrirExistente} className="gap-1">
              Abrir <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {!espelhoExistente && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="criar" className="gap-1.5">
                <FolderPlus className="h-3.5 w-3.5" /> Criar novo
              </TabsTrigger>
              <TabsTrigger value="vincular" className="gap-1.5">
                <Folder className="h-3.5 w-3.5" /> Vincular existente
              </TabsTrigger>
            </TabsList>

            <TabsContent value="criar" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Nome do projeto</Label>
                <Input
                  className="mt-1 h-8 text-xs"
                  value={nomeProjeto}
                  onChange={(e) => setNomeProjeto(e.target.value)}
                  placeholder="Submissão XYZ-001"
                  maxLength={120}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Mínimo 3 caracteres. Tipo do projeto: china_submissao (espelho).
                </p>
              </div>
            </TabsContent>

            <TabsContent value="vincular" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Projeto</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-7 text-xs"
                    placeholder="Buscar projeto"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="mt-2 h-48 rounded-md border border-border">
                  {loadingProjetos ? (
                    <div className="p-3 text-xs text-muted-foreground">Carregando...</div>
                  ) : filteredProjetos.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">Nenhum projeto encontrado</div>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {(filteredProjetos as any[]).map((p) => (
                        <li
                          key={p.id}
                          onClick={() => setProjetoSelecionado(p.id)}
                          className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/50 ${
                            projetoSelecionado === p.id ? "bg-primary/10" : ""
                          }`}
                        >
                          <Folder className="h-4 w-4 shrink-0" style={{ color: p.cor || undefined }} />
                          <span className="truncate flex-1 font-medium text-foreground">{p.nome}</span>
                          {p.status && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px]">
                              {p.status}
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {!espelhoExistente && (
          <div>
            <Label className="text-xs">Checklist Brasil → China (opcional)</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue placeholder="Sem template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem template (criar vazio)</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Popula o checklist de documentos que o Brasil precisa enviar à China.
            </p>
          </div>
        )}

        {!espelhoExistente && (
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={close}>
              Cancelar
            </Button>
            <Button size="sm" disabled={!canSubmit} onClick={handleSubmit} className="gap-1.5">
              {criar.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              {tab === "criar" ? "Criar e abrir" : "Vincular e abrir"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
