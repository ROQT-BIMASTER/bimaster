/**
 * VincularDocAprovadoDialog — wizard para vincular um documento aprovado do
 * chat a um dos 4 cofres oficiais (Submissão China, Briefing, Projeto, Tarefa).
 *
 * Opções visíveis dependem das permissões de módulo do usuário. Em todos os
 * destinos a tabulação (categoria/tipo) é obrigatória.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Building2, Briefcase, FolderKanban, ListChecks } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useMergedChinaChecklist } from "@/hooks/useMergedChinaChecklist";
import { CATEGORIA_LABELS as BRIEF_CATS } from "@/hooks/useBriefingCofre";
import { useVincularDocAprovado, type VincDestino } from "@/hooks/chat/useVincularDocAprovado";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documento: {
    id: string;
    storage_path: string;
    titulo: string;
    mime_type: string | null;
    size_bytes: number | null;
  } | null;
}

const PROJ_CATS: { value: string; label: string }[] = [
  { value: "geral", label: "Geral" },
  { value: "briefing", label: "Briefing" },
  { value: "arte_final", label: "Arte Final" },
  { value: "rotulo", label: "Rótulo" },
  { value: "ficha_tecnica", label: "Ficha Técnica" },
  { value: "laudo", label: "Laudo" },
  { value: "certificado", label: "Certificado" },
  { value: "orcamento", label: "Orçamento" },
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "art", label: "ART" },
  { value: "contrato", label: "Contrato" },
  { value: "outro", label: "Outro" },
];

export function VincularDocAprovadoDialog({ open, onOpenChange, documento }: Props) {
  const { hasModulePermission } = useModulePermissions();
  const hasChina = hasModulePermission("china_brasil");
  const hasBriefings = hasModulePermission("briefings");
  const hasProjetos = hasModulePermission("projetos");

  const [destino, setDestino] = useState<VincDestino | null>(null);
  // china
  const [submissaoId, setSubmissaoId] = useState("");
  const [categoriaChina, setCategoriaChina] = useState("");
  const [tipoChina, setTipoChina] = useState("");
  // briefing
  const [briefingId, setBriefingId] = useState("");
  const [categoriaBrief, setCategoriaBrief] = useState("");
  // projeto / tarefa
  const [projetoId, setProjetoId] = useState("");
  const [tarefaId, setTarefaId] = useState("");
  const [categoriaProj, setCategoriaProj] = useState("");

  const vinc = useVincularDocAprovado();

  // reset on close
  useEffect(() => {
    if (!open) {
      setDestino(null);
      setSubmissaoId(""); setCategoriaChina(""); setTipoChina("");
      setBriefingId(""); setCategoriaBrief("");
      setProjetoId(""); setTarefaId(""); setCategoriaProj("");
    }
  }, [open]);

  // listas — todas filtradas server-side por RLS / SECURITY DEFINER
  const submissoes = useQuery({
    queryKey: ["vinc-submissoes-china"],
    enabled: open && destino === "china_checklist",
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "rpc_chat_vinculo_submissoes_china",
      );
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        produto_codigo: string | null;
        produto_nome: string | null;
        status: string | null;
      }[];
    },
  });

  const briefings = useQuery({
    queryKey: ["vinc-briefings"],
    enabled: open && destino === "briefing",
    queryFn: async () => {
      // RLS de `briefings` já restringe a membros/criador/admin
      const { data, error } = await (supabase as any)
        .from("briefings")
        .select("id, titulo")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as { id: string; titulo: string }[];
    },
  });

  const projetos = useQuery({
    queryKey: ["vinc-projetos-acessiveis"],
    enabled: open && (destino === "projeto" || destino === "tarefa"),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "get_accessible_projetos",
        { _target_user_id: null, _include_all: false },
      );
      if (error) throw error;
      return (data ?? []).map((p: any) => ({ id: p.id, nome: p.nome })) as {
        id: string;
        nome: string;
      }[];
    },
  });

  const tarefas = useQuery({
    queryKey: ["vinc-tarefas", projetoId],
    enabled: open && destino === "tarefa" && !!projetoId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "rpc_chat_vinculo_tarefas_projeto",
        { p_projeto_id: projetoId },
      );
      if (error) throw error;
      return (data ?? []) as { id: string; titulo: string; status: string | null }[];
    },
  });

  const checklist = useMergedChinaChecklist(destino === "china_checklist" ? submissaoId : null);
  const tiposChinaDisp = useMemo(() => {
    if (!categoriaChina) return [];
    const cat = checklist.categories.find((c) => c.key === categoriaChina);
    if (!cat) return [];
    return cat.tipos
      .filter((t) => !checklist.hiddenSet.has(t))
      .map((t) => checklist.getDocType(t))
      .filter((dt): dt is NonNullable<typeof dt> => !!dt);
  }, [categoriaChina, checklist]);

  if (!documento) return null;

  const docBase = {
    documento_id: documento.id,
    storage_path_origem: documento.storage_path,
    nome_arquivo: documento.titulo,
    mime_type: documento.mime_type,
    size_bytes: documento.size_bytes,
  };

  const isPending =
    vinc.vincularChina.isPending || vinc.vincularBriefing.isPending ||
    vinc.vincularProjeto.isPending || vinc.vincularTarefa.isPending;

  const canSubmit = (() => {
    if (destino === "china_checklist") return !!submissaoId && !!categoriaChina && !!tipoChina;
    if (destino === "briefing") return !!briefingId && !!categoriaBrief;
    if (destino === "projeto") return !!projetoId && !!categoriaProj;
    if (destino === "tarefa") return !!projetoId && !!tarefaId && !!categoriaProj;
    return false;
  })();

  const submit = async () => {
    if (!canSubmit) return;
    const close = () => onOpenChange(false);
    if (destino === "china_checklist") {
      vinc.vincularChina.mutate(
        { ...docBase, submissao_id: submissaoId, tipo_documento: tipoChina },
        { onSuccess: close },
      );
    } else if (destino === "briefing") {
      vinc.vincularBriefing.mutate(
        { ...docBase, briefing_id: briefingId, categoria: categoriaBrief },
        { onSuccess: close },
      );
    } else if (destino === "projeto") {
      vinc.vincularProjeto.mutate(
        { ...docBase, projeto_id: projetoId, categoria: categoriaProj },
        { onSuccess: close },
      );
    } else if (destino === "tarefa") {
      vinc.vincularTarefa.mutate(
        { ...docBase, projeto_id: projetoId, tarefa_id: tarefaId, categoria: categoriaProj },
        { onSuccess: close },
      );
    }
  };

  const destinos: { key: VincDestino; label: string; icon: any; enabled: boolean }[] = [
    { key: "china_checklist", label: "Checklist de Submissão (China)", icon: Building2, enabled: hasChina },
    { key: "briefing",        label: "Cofre de Briefing",              icon: Briefcase,  enabled: hasBriefings },
    { key: "projeto",         label: "Cofre do Projeto",               icon: FolderKanban, enabled: hasProjetos },
    { key: "tarefa",          label: "Anexo oficial da Tarefa",        icon: ListChecks, enabled: hasProjetos },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular ao Cofre Oficial</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> {documento.titulo}
          </DialogDescription>
        </DialogHeader>

        {!destino ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Escolha o destino oficial:</p>
            {destinos.filter(d => d.enabled).map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDestino(d.key)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-md border border-border p-3 text-left text-sm",
                  "hover:bg-accent hover:border-primary transition-colors",
                )}
              >
                <d.icon className="h-4 w-4 text-primary shrink-0" />
                <span>{d.label}</span>
              </button>
            ))}
            {destinos.every((d) => !d.enabled) && (
              <p className="text-xs text-muted-foreground italic">
                Você não tem acesso a nenhum módulo com cofre disponível.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {/* CHINA */}
            {destino === "china_checklist" && (
              <>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Submissão</label>
                  <Select value={submissaoId} onValueChange={(v) => { setSubmissaoId(v); setCategoriaChina(""); setTipoChina(""); }}>
                    <SelectTrigger><SelectValue placeholder={submissoes.isLoading ? "Carregando..." : "Selecione"} /></SelectTrigger>
                    <SelectContent>
                      {(submissoes.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.nome_submissao || s.codigo_externo || s.id.slice(0,8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {submissaoId && (
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Categoria</label>
                    <Select value={categoriaChina} onValueChange={(v) => { setCategoriaChina(v); setTipoChina(""); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {checklist.categories.map((c) => (
                          <SelectItem key={c.key} value={c.key}>{c.labelPt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {categoriaChina && (
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo de Documento</label>
                    <Select value={tipoChina} onValueChange={setTipoChina}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {tiposChinaDisp.map((dt) => (
                          <SelectItem key={dt.tipo} value={dt.tipo}>{dt.labelPt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {/* BRIEFING */}
            {destino === "briefing" && (
              <>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Briefing</label>
                  <Select value={briefingId} onValueChange={setBriefingId}>
                    <SelectTrigger><SelectValue placeholder={briefings.isLoading ? "Carregando..." : "Selecione"} /></SelectTrigger>
                    <SelectContent>
                      {(briefings.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.titulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Categoria</label>
                  <Select value={categoriaBrief} onValueChange={setCategoriaBrief}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(BRIEF_CATS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* PROJETO / TAREFA */}
            {(destino === "projeto" || destino === "tarefa") && (
              <>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Projeto</label>
                  <Select value={projetoId} onValueChange={(v) => { setProjetoId(v); setTarefaId(""); }}>
                    <SelectTrigger><SelectValue placeholder={projetos.isLoading ? "Carregando..." : "Selecione"} /></SelectTrigger>
                    <SelectContent>
                      {(projetos.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {destino === "tarefa" && projetoId && (
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Tarefa</label>
                    <Select value={tarefaId} onValueChange={setTarefaId}>
                      <SelectTrigger><SelectValue placeholder={tarefas.isLoading ? "Carregando..." : "Selecione"} /></SelectTrigger>
                      <SelectContent>
                        {(tarefas.data ?? []).map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.titulo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Categoria do cofre</label>
                  <Select value={categoriaProj} onValueChange={setCategoriaProj}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {PROJ_CATS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {destino && (
            <Button variant="ghost" size="sm" onClick={() => setDestino(null)} disabled={isPending}>
              Voltar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          {destino && (
            <Button size="sm" onClick={submit} disabled={!canSubmit || isPending} className="gap-1.5">
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Arquivar no cofre
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
