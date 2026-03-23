import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AccessProfile } from "@/hooks/useErpAccessProfiles";

// Mirror of API_MODULES structure for the checkbox tree
const AVAILABLE_MODULES = [
  {
    id: "geral",
    name: "Geral",
    apis: [
      { id: "clientes", name: "Clientes" },
      { id: "fornecedores-query", name: "Fornecedores (Consulta)" },
      { id: "fornecedores-sync", name: "Fornecedores (Sync)" },
      { id: "empresas", name: "Empresas" },
      { id: "projetos", name: "Projetos" },
    ],
  },
  {
    id: "cadastros",
    name: "Cadastros Auxiliares",
    apis: [
      { id: "plano-contas", name: "Plano de Contas" },
      { id: "portadores", name: "Portadores" },
      { id: "categorias", name: "Categorias" },
      { id: "departamentos", name: "Departamentos" },
      { id: "parcelas", name: "Parcelas" },
      { id: "dre", name: "DRE" },
      { id: "bancos", name: "Bancos" },
      { id: "tipos-documento", name: "Tipos de Documento" },
      { id: "tipos-entrega", name: "Tipos de Entrega" },
      { id: "finalidades", name: "Finalidades de Transferência" },
      { id: "tipos-atividade", name: "Tipos de Atividade" },
      { id: "tipos-anexo", name: "Tipos de Anexo" },
    ],
  },
  {
    id: "referencia",
    name: "Tabelas de Referência",
    apis: [
      { id: "cnae", name: "CNAE" },
      { id: "cidades", name: "Cidades" },
      { id: "paises", name: "Países" },
      { id: "bandeiras", name: "Bandeiras de Cartão" },
      { id: "origens", name: "Origens de Lançamento" },
    ],
  },
  {
    id: "financas",
    name: "Finanças",
    apis: [
      { id: "contas-pagar", name: "Contas a Pagar" },
      { id: "contas-receber", name: "Contas a Receber" },
      { id: "boletos", name: "Boletos" },
      { id: "contas-correntes", name: "Contas Correntes" },
      { id: "lancamentos-cc", name: "Lançamentos CC" },
      { id: "exportacao", name: "Exportação ERP" },
      { id: "orcamentos", name: "Orçamentos de Caixa" },
      { id: "pesquisar", name: "Pesquisar Lançamentos" },
      { id: "movimentos", name: "Movimentos Financeiros" },
      { id: "resumo-fin", name: "Resumo Financeiro" },
    ],
  },
  {
    id: "complementar",
    name: "Dados Complementares",
    apis: [
      { id: "anexos", name: "Anexos" },
      { id: "webhook-inbound", name: "Webhook Inbound" },
      { id: "webhook-subscriptions", name: "Webhook Subscriptions" },
      { id: "webhook-dispatcher", name: "Webhook Dispatcher" },
    ],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile?: AccessProfile | null;
  onSubmit: (data: { nome: string; descricao: string; modules: { module_id: string; api_id: string | null }[] }) => void;
  submitting?: boolean;
}

export default function AccessProfileForm({ open, onOpenChange, profile, onSubmit, submitting }: Props) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  // Selected: Set of "moduleId" (full module) or "moduleId::apiId" (individual API)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile) {
      setNome(profile.nome);
      setDescricao(profile.descricao || "");
      const s = new Set<string>();
      for (const m of profile.modules) {
        if (m.api_id) {
          s.add(`${m.module_id}::${m.api_id}`);
        } else {
          s.add(m.module_id);
        }
      }
      setSelected(s);
    } else {
      setNome("");
      setDescricao("");
      setSelected(new Set());
    }
  }, [profile, open]);

  const isModuleFullySelected = (moduleId: string) => selected.has(moduleId);

  const isApiSelected = (moduleId: string, apiId: string) => {
    return selected.has(moduleId) || selected.has(`${moduleId}::${apiId}`);
  };

  const toggleModule = (moduleId: string) => {
    const next = new Set(selected);
    if (next.has(moduleId)) {
      next.delete(moduleId);
      // Also remove any individual APIs from this module
      const mod = AVAILABLE_MODULES.find(m => m.id === moduleId);
      mod?.apis.forEach(a => next.delete(`${moduleId}::${a.id}`));
    } else {
      next.add(moduleId);
      // Remove individual APIs since module-level covers all
      const mod = AVAILABLE_MODULES.find(m => m.id === moduleId);
      mod?.apis.forEach(a => next.delete(`${moduleId}::${a.id}`));
    }
    setSelected(next);
  };

  const toggleApi = (moduleId: string, apiId: string) => {
    const next = new Set(selected);
    const key = `${moduleId}::${apiId}`;

    if (next.has(moduleId)) {
      // Module was fully selected, switch to individual APIs minus this one
      next.delete(moduleId);
      const mod = AVAILABLE_MODULES.find(m => m.id === moduleId);
      mod?.apis.forEach(a => {
        if (a.id !== apiId) next.add(`${moduleId}::${a.id}`);
      });
    } else if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      // Check if all APIs are now selected → upgrade to module-level
      const mod = AVAILABLE_MODULES.find(m => m.id === moduleId);
      if (mod) {
        const allSelected = mod.apis.every(a => a.id === apiId || next.has(`${moduleId}::${a.id}`));
        if (allSelected) {
          mod.apis.forEach(a => next.delete(`${moduleId}::${a.id}`));
          next.add(moduleId);
        }
      }
    }
    setSelected(next);
  };

  const selectAll = () => {
    const s = new Set<string>();
    AVAILABLE_MODULES.forEach(m => s.add(m.id));
    setSelected(s);
  };

  const deselectAll = () => setSelected(new Set());

  const handleSubmit = () => {
    if (!nome.trim()) return;
    const modules: { module_id: string; api_id: string | null }[] = [];
    for (const key of selected) {
      if (key.includes("::")) {
        const [moduleId, apiId] = key.split("::");
        modules.push({ module_id: moduleId, api_id: apiId });
      } else {
        modules.push({ module_id: key, api_id: null });
      }
    }
    onSubmit({ nome: nome.trim(), descricao: descricao.trim(), modules });
  };

  const toggleExpanded = (moduleId: string) => {
    const next = new Set(expandedModules);
    if (next.has(moduleId)) next.delete(moduleId);
    else next.add(moduleId);
    setExpandedModules(next);
  };

  const getModuleSelectedCount = (mod: typeof AVAILABLE_MODULES[0]) => {
    if (selected.has(mod.id)) return mod.apis.length;
    return mod.apis.filter(a => selected.has(`${mod.id}::${a.id}`)).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{profile ? "Editar Perfil" : "Novo Perfil de Acesso"}</DialogTitle>
          <DialogDescription>Defina quais módulos e APIs este perfil pode visualizar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-nome">Nome do Perfil *</Label>
            <Input id="profile-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Equipe Financeira" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-desc">Descrição</Label>
            <Input id="profile-desc" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Módulos e APIs</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>Selecionar Todos</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAll}>Limpar</Button>
              </div>
            </div>
            <ScrollArea className="h-[300px] border rounded-lg p-2">
              <div className="space-y-1">
                {AVAILABLE_MODULES.map(mod => {
                  const count = getModuleSelectedCount(mod);
                  const isExpanded = expandedModules.has(mod.id);
                  return (
                    <div key={mod.id}>
                      <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md">
                        <Checkbox
                          checked={isModuleFullySelected(mod.id)}
                          onCheckedChange={() => toggleModule(mod.id)}
                        />
                        <button
                          className="flex items-center gap-2 flex-1 text-left"
                          onClick={() => toggleExpanded(mod.id)}
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className="text-sm font-medium">{mod.name}</span>
                          {count > 0 && (
                            <Badge variant={count === mod.apis.length ? "default" : "secondary"} className="text-[10px]">
                              {count}/{mod.apis.length}
                            </Badge>
                          )}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="ml-8 space-y-0.5 mb-1">
                          {mod.apis.map(api => (
                            <div key={api.id} className="flex items-center gap-2 py-1 px-2 hover:bg-muted/30 rounded">
                              <Checkbox
                                checked={isApiSelected(mod.id, api.id)}
                                onCheckedChange={() => toggleApi(mod.id, api.id)}
                              />
                              <span className="text-xs text-muted-foreground">{api.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting || !nome.trim()}>
            {submitting ? "Salvando..." : profile ? "Salvar" : "Criar Perfil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
