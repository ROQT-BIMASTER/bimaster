import { useState, useMemo } from "react";
import { Search, Link2, Unlink, ChevronRight, Package, FolderKanban, CheckCircle2, Circle, Loader2, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuditChinaVinculoBadge } from "@/components/china/AuditChinaVinculoBadge";
import { useAuditChinaVinculo } from "@/hooks/useAuditChinaVinculo";
import {
  useSubmissoesChina,
  useProjetosParaVinculo,
  useSecoesETarefas,
  useVinculosExistentes,
  useAllVinculos,
  useCreateVinculo,
  useDeleteVinculo,
} from "@/hooks/useChinaTarefaVinculos";
import { cn } from "@/lib/utils";

export default function ProjetoVincularChina() {
  const [search, setSearch] = useState("");
  const [selectedSubmissaoId, setSelectedSubmissaoId] = useState<string | null>(null);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [checkedTarefas, setCheckedTarefas] = useState<Set<string>>(new Set());

  const { data: submissoes = [], isLoading: loadingSub } = useSubmissoesChina(search);
  const { data: projetos = [] } = useProjetosParaVinculo();
  const { data: secoesData } = useSecoesETarefas(selectedProjetoId);
  const { data: vinculos = [] } = useVinculosExistentes(selectedProjetoId);
  const { data: allVinculos = [] } = useAllVinculos();
  const createVinculo = useCreateVinculo();
  const deleteVinculo = useDeleteVinculo();
  const { auditTarefaProduto, loading: auditLoading, result: auditResult } = useAuditChinaVinculo();

  const selectedSubmissao = useMemo(
    () => submissoes.find((s: any) => s.id === selectedSubmissaoId),
    [submissoes, selectedSubmissaoId]
  );

  const vinculosByTarefa = useMemo(() => {
    const map = new Map<string, string>();
    vinculos.forEach((v) => map.set(v.tarefa_id, v.id));
    return map;
  }, [vinculos]);

  const submissaoVinculadas = useMemo(() => {
    const set = new Set<string>();
    allVinculos.forEach((v) => set.add(v.submissao_id));
    return set;
  }, [allVinculos]);

  const secoes = secoesData?.secoes || [];
  const tarefas = secoesData?.tarefas || [];

  const handleToggleTarefa = (tarefaId: string) => {
    setCheckedTarefas((prev) => {
      const next = new Set(prev);
      if (next.has(tarefaId)) next.delete(tarefaId);
      else next.add(tarefaId);
      return next;
    });
  };

  const handleVincular = async () => {
    if (!selectedSubmissaoId || !selectedProjetoId || checkedTarefas.size === 0) return;

    // Run audit for first selected task
    const firstTarefaId = Array.from(checkedTarefas)[0];
    const firstTarefa = tarefas.find((t: any) => t.id === firstTarefaId);

    let audit = null;
    if (selectedSubmissao && firstTarefa) {
      audit = await auditTarefaProduto({
        tarefa: {
          titulo: firstTarefa.titulo,
          estagio: firstTarefa.estagio || undefined,
        },
        submissao: {
          produto_codigo: selectedSubmissao.produto_codigo,
          produto_nome: selectedSubmissao.produto_nome,
          status: selectedSubmissao.status,
          formula_codigo: selectedSubmissao.formula_codigo,
          ean_unidade: selectedSubmissao.ean_unidade,
          ean_display: selectedSubmissao.ean_display,
          ean_caixa_master: selectedSubmissao.ean_caixa_master,
          peso_liquido_g: selectedSubmissao.peso_liquido_g,
          peso_bruto_g: selectedSubmissao.peso_bruto_g,
          qty_total: selectedSubmissao.qty_total,
          observacoes_brasil: selectedSubmissao.observacoes_brasil,
          observacoes_china: selectedSubmissao.observacoes_china,
        },
      });
    }

    // Create vinculos for each checked tarefa
    for (const tarefaId of checkedTarefas) {
      const tarefa = tarefas.find((t: any) => t.id === tarefaId);
      if (vinculosByTarefa.has(tarefaId)) continue; // skip already linked
      await createVinculo.mutateAsync({
        submissao_id: selectedSubmissaoId,
        tarefa_id: tarefaId,
        secao_id: tarefa?.secao_id || null,
        projeto_id: selectedProjetoId,
        audit_result: audit || undefined,
      });
    }

    setCheckedTarefas(new Set());
  };

  const handleDesvincular = (vinculoId: string) => {
    deleteVinculo.mutate(vinculoId);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Link2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Vincular Envio China</h1>
          <p className="text-sm text-muted-foreground">
            Associe submissões da fábrica China a tarefas e seções do projeto
          </p>
        </div>
      </div>

      {/* Main content - two panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel - China submissions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Submissões China
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {loadingSub ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : submissoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Nenhuma submissão encontrada</p>
              ) : (
                <div className="divide-y">
                  {submissoes.map((sub: any) => {
                    const isSelected = selectedSubmissaoId === sub.id;
                    const isLinked = submissaoVinculadas.has(sub.id);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSubmissaoId(sub.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-center gap-3",
                          isSelected && "bg-primary/5 border-l-2 border-l-primary"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-primary">{sub.produto_codigo}</span>
                            {isLinked && (
                              <span className="h-2 w-2 rounded-full bg-success shrink-0" title="Já vinculada" />
                            )}
                          </div>
                          <p className="text-sm text-foreground truncate">{sub.produto_nome}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {sub.status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right panel - Project sections & tasks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              Projeto & Tarefas
            </CardTitle>
            <Select value={selectedProjetoId || ""} onValueChange={(v) => { setSelectedProjetoId(v); setCheckedTarefas(new Set()); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um projeto..." />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))
                }
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[320px]">
              {!selectedProjetoId ? (
                <p className="text-sm text-muted-foreground text-center py-10">Selecione um projeto acima</p>
              ) : !selectedSubmissaoId ? (
                <p className="text-sm text-muted-foreground text-center py-10">Selecione uma submissão à esquerda</p>
              ) : secoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Nenhuma seção encontrada</p>
              ) : (
                <div className="px-4 py-2 space-y-3">
                  {secoes.map((secao: any) => {
                    const secaoTarefas = tarefas.filter((t: any) => t.secao_id === secao.id);
                    if (secaoTarefas.length === 0) return null;
                    return (
                      <div key={secao.id}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          {secao.nome}
                        </p>
                        <div className="space-y-1">
                          {secaoTarefas.map((tarefa: any) => {
                            const isLinked = vinculosByTarefa.has(tarefa.id);
                            const isChecked = checkedTarefas.has(tarefa.id);
                            return (
                              <label
                                key={tarefa.id}
                                className={cn(
                                  "flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors",
                                  isLinked && "bg-success/5"
                                )}
                              >
                                {isLinked ? (
                                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                                ) : (
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => handleToggleTarefa(tarefa.id)}
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-foreground">{tarefa.titulo}</span>
                                  {tarefa.codigo && (
                                    <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">{tarefa.codigo}</span>
                                  )}
                                </div>
                                {isLinked && (
                                  <Badge variant="outline" className="text-[10px] text-success border-success/30">
                                    Vinculada
                                  </Badge>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Audit + Action bar */}
            {selectedSubmissaoId && selectedProjetoId && (
              <div className="border-t px-4 py-3 space-y-2">
                <AuditChinaVinculoBadge result={auditResult} loading={auditLoading} />
                <Button
                  onClick={handleVincular}
                  disabled={checkedTarefas.size === 0 || createVinculo.isPending || auditLoading}
                  className="w-full"
                  size="sm"
                >
                  {createVinculo.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Vincular {checkedTarefas.size > 0 ? `(${checkedTarefas.size})` : ""}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Existing vinculos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Vínculos Existentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allVinculos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum vínculo criado ainda</p>
          ) : (
            <div className="divide-y">
              {allVinculos.map((v: any) => {
                const projeto = projetos.find((p: any) => p.id === v.projeto_id);
                return (
                  <div key={v.id} className="flex items-center gap-3 py-2.5">
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono font-bold text-primary">
                        {v.submissao?.produto_codigo || "—"}
                      </span>
                      <span className="text-xs text-muted-foreground mx-1.5">→</span>
                      <span className="text-sm text-foreground">
                        {projeto?.nome || v.projeto_id}
                      </span>
                    </div>
                    {v.audit_result && (
                      <AuditChinaVinculoBadge result={v.audit_result} compact />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDesvincular(v.id)}
                      disabled={deleteVinculo.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

