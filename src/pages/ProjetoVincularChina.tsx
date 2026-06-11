import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { Link2, Package, Loader2, Maximize2, Gavel, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getBgPaletteVars } from "@/lib/colorUtils";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditChinaVinculoBadge } from "@/components/china/AuditChinaVinculoBadge";
import { ChinaGradeView } from "@/components/china/ChinaGradeView";
import { ChinaDocPreviewDialog } from "@/components/china/ChinaDocPreviewDialog";
import { VincularChinaTable, type SubmissaoRow } from "@/components/china/VincularChinaTable";
import { VincularChinaSidePanel } from "@/components/china/VincularChinaSidePanel";
import { VincularChinaBulkActions } from "@/components/china/VincularChinaBulkActions";
import { VincularChinaKpis } from "@/components/china/VincularChinaKpis";
import { VincularMailboxSidebar } from "@/components/china/vincular/VincularMailboxSidebar";
import { VincularMailboxList } from "@/components/china/vincular/VincularMailboxList";
import { EncaminharResponsavelDialog } from "@/components/china/vincular/EncaminharResponsavelDialog";
import { EncaminharProjetoDialog } from "@/components/china/vincular/EncaminharProjetoDialog";
import { ContinuarNoProjetoDialog } from "@/components/china/inbox/ContinuarNoProjetoDialog";
import {
  useVincularChinaUserState,
  classifyVincularRows,
  filterByFolder,
  type VincularFolder,
} from "@/hooks/useVincularChinaMailboxData";
import { useToggleSubmissaoFlag } from "@/hooks/useChinaMailboxActions";
import { ChinaSubmissaoExpandido } from "@/components/china/ChinaSubmissaoExpandido";
import { DespachosPanel } from "@/components/processo/DespachosPanel";
import { ProcessDecisionDialog } from "@/components/processo/ProcessDecisionDialog";
import { useAuditChinaVinculo } from "@/hooks/useAuditChinaVinculo";
import { useSubmissaoPendencias } from "@/hooks/useSubmissaoPendencias";
import {
  useSubmissoesChina,
  useProjetosParaVinculo,
  useSecoesETarefas,
  useVinculosExistentes,
  useAllVinculos,
  useProdutoBrasilPorSubmissao,
  useCreateVinculo,
  useDeleteVinculo,
} from "@/hooks/useChinaTarefaVinculos";
import {
  useDocumentosDaSubmissao,
  useCoresDaSubmissao,
  useDocVinculosExistentes,
  useCreateDocVinculo,
  useDeleteDocVinculo,
} from "@/hooks/useChinaDocumentoVinculos";
import { useDespachosPorSubmissao } from "@/hooks/useDespachoDocumentos";
import { CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useUserDepartments } from "@/hooks/useUserDepartments";
import { AccessDenied } from "@/components/common/AccessDenied";
import { FileText, ChevronRight, Unlink } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const DEV_DEPARTMENT_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";

function getStatusBadgeVariant(status: string): "secondary" | "default" | "warning" | "success" | "destructive" | "outline" {
  switch (status) {
    case "rascunho": return "secondary";
    case "enviado": return "default";
    case "em_revisao": return "warning";
    case "aprovado": return "success";
    case "enviado_brasil": return "default";
    case "arte_enviada": return "outline";
    case "rejeitado": return "destructive";
    default: return "secondary";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "rascunho": return "Rascunho";
    case "enviado": return "Enviado";
    case "em_revisao": return "Em Revisão";
    case "aprovado": return "Aprovado";
    case "enviado_brasil": return "Enviado ao Brasil";
    case "arte_enviada": return "Docs Enviados";
    case "rejeitado": return "Rejeitado";
    default: return status;
  }
}

export default function ProjetoVincularChina() {
  const { isAdmin } = usePermissions();
  const { data: userDepartments = [] } = useUserDepartments();
  const isDevTeam = isAdmin || userDepartments.some(d => d.id === DEV_DEPARTMENT_ID);

  const { bgColor, setBgColor } = usePageBgColor("vincular_china");


  // States — selectedId, folder e busca persistem na URL para sobreviver a refresh
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSel = searchParams.get("sel");
  const initialFolder = (searchParams.get("folder") as VincularFolder | null) || "nao_vinculadas";
  const initialSearch = searchParams.get("q") || "";

  const [selectedSubmissaoId, setSelectedSubmissaoId] = useState<string | null>(initialSel);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [checkedTarefas, setCheckedTarefas] = useState<Set<string>>(new Set());
  const [gradeOpen, setGradeOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [focusSubmissao, setFocusSubmissao] = useState<any>(null);
  const [vinculosOpen, setVinculosOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionProcessId, setDecisionProcessId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterProjeto, setFilterProjeto] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [desvincularTarget, setDesvincularTarget] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [kpiStatusFilter, setKpiStatusFilter] = useState<string>(searchParams.get("kpi") || "todos");
  const [kpisOpen, setKpisOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("vincular_kpis_open") !== "false";
  });
  const [recentlyLinkedId, setRecentlyLinkedId] = useState<string | null>(null);
  const [folder, setFolder] = useState<VincularFolder>(initialFolder);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [encaminharOpen, setEncaminharOpen] = useState(false);
  const [encaminharProjetoOpen, setEncaminharProjetoOpen] = useState(false);
  const [continuarProjetoOpen, setContinuarProjetoOpen] = useState(false);
  const queryClient = useQueryClient();
  const toggleFlag = useToggleSubmissaoFlag();
  const { flags, snoozes } = useVincularChinaUserState();

  // Sincroniza estado relevante de volta para a URL (preserva refresh / share link)
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedSubmissaoId) next.set("sel", selectedSubmissaoId); else next.delete("sel");
    if (folder && folder !== "nao_vinculadas") next.set("folder", folder); else next.delete("folder");
    if (searchTerm) next.set("q", searchTerm); else next.delete("q");
    if (kpiStatusFilter && kpiStatusFilter !== "todos") next.set("kpi", kpiStatusFilter); else next.delete("kpi");
    const cur = searchParams.toString();
    const nxt = next.toString();
    if (cur !== nxt) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubmissaoId, folder, searchTerm, kpiStatusFilter]);

  // Persistir colapso dos KPIs em localStorage + atalho "k"
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vincular_kpis_open", String(kpisOpen));
    }
  }, [kpisOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setKpisOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Data queries
  const { data: submissoes = [], isLoading: loadingSub } = useSubmissoesChina("");
  const { data: projetos = [] } = useProjetosParaVinculo();
  const { data: secoesData } = useSecoesETarefas(selectedProjetoId);
  const { data: vinculos = [] } = useVinculosExistentes(selectedProjetoId);
  const { data: allVinculos = [] } = useAllVinculos();
  const { data: produtoBrasilMap } = useProdutoBrasilPorSubmissao();
  const createVinculo = useCreateVinculo();
  const deleteVinculo = useDeleteVinculo();
  const { auditTarefaProduto, loading: auditLoading, result: auditResult } = useAuditChinaVinculo();

  // Document queries for selected submission
  const { data: documentos = [] } = useDocumentosDaSubmissao(selectedSubmissaoId);
  const { data: cores = [] } = useCoresDaSubmissao(selectedSubmissaoId);
  const { data: docVinculos = [] } = useDocVinculosExistentes(selectedProjetoId);
  const createDocVinculo = useCreateDocVinculo();
  const deleteDocVinculo = useDeleteDocVinculo();

  // Real pendências from DB
  const submissaoIds = useMemo(() => submissoes.map((s: any) => s.id), [submissoes]);
  const { data: pendenciasMap } = useSubmissaoPendencias(submissaoIds);

  // Doc counts per submissao
  const { data: docCountsRaw } = useQuery({
    queryKey: ["china-doc-counts", submissaoIds],
    enabled: submissaoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_documentos")
        .select("submissao_id")
        .in("submissao_id", submissaoIds);
      if (error) throw error;
      const map = new Map<string, number>();
      (data || []).forEach((d: any) => map.set(d.submissao_id, (map.get(d.submissao_id) || 0) + 1));
      return map;
    },
  });
  const docCounts = docCountsRaw ?? new Map<string, number>();

  const submissaoVinculadas = useMemo(() => {
    const set = new Set<string>();
    allVinculos.forEach(v => set.add(v.submissao_id));
    if (produtoBrasilMap) produtoBrasilMap.forEach((_v, k) => set.add(k));
    return set;
  }, [allVinculos, produtoBrasilMap]);

  // Conta tarefas vinculadas por submissão (para "Projeto X · 3 tarefas")
  const tarefasPorSubmissao = useMemo(() => {
    const m = new Map<string, number>();
    allVinculos.forEach(v => m.set(v.submissao_id, (m.get(v.submissao_id) || 0) + 1));
    return m;
  }, [allVinculos]);

  // Build table rows with real pendências
  const tableData: SubmissaoRow[] = useMemo(() => {
    return submissoes
      .filter((s: any) => s.produto_codigo && s.produto_nome && s.produto_codigo !== "null")
      // Esta tela é a Mesa do Intermediador (Brasil): só mostra o que a China efetivamente enviou ao Brasil
      .filter((s: any) => s.status === "enviado_brasil")
      .map((s: any) => {
        const isLinked = submissaoVinculadas.has(s.id);
        const linkedVinculo = allVinculos.find(v => v.submissao_id === s.id);
        // Fonte 1: vínculo de tarefa (com join projeto). Fonte 2: produtos_brasil.
        // Fallback: lista de projetos ativos.
        const pbVinculo = produtoBrasilMap?.get(s.id);
        const projetoIdLinked = linkedVinculo?.projeto_id || pbVinculo?.projeto_id;
        const projetoFromJoin = (linkedVinculo as any)?.projeto;
        const projetoFromList = projetoIdLinked
          ? projetos.find((p: any) => p.id === projetoIdLinked)
          : null;
        const projetoNome = projetoFromJoin?.nome || projetoFromList?.nome || pbVinculo?.nome;
        const projetoCor = projetoFromJoin?.cor || projetoFromList?.cor || pbVinculo?.cor;
        const pend = pendenciasMap?.get(s.id);

        return {
          ...s,
          isLinked,
          projetoNome,
          projetoCor,
          projetoId: projetoIdLinked,
          tarefasVinculadas: tarefasPorSubmissao.get(s.id) || 0,
          pendencias: pend?.pendentes ?? 0,
          totalChecklist: pend?.total ?? 0,
          docCount: docCounts.get(s.id) ?? 0,
        };
      });
  }, [submissoes, submissaoVinculadas, allVinculos, projetos, produtoBrasilMap, pendenciasMap, docCounts, tarefasPorSubmissao]);

  const selectedSubmissao = useMemo(
    () => submissoes.find((s: any) => s.id === selectedSubmissaoId),
    [submissoes, selectedSubmissaoId]
  );

  const selectedRow = useMemo(
    () => tableData.find(r => r.id === selectedSubmissaoId) || null,
    [tableData, selectedSubmissaoId]
  );

  const secoes = secoesData?.secoes || [];
  const tarefas = secoesData?.tarefas || [];

  const vinculadasCount = useMemo(() => tableData.filter(r => r.isLinked).length, [tableData]);
  const progressPct = tableData.length > 0 ? Math.round((vinculadasCount / tableData.length) * 100) : 0;

  // KPIs computados a partir de TODAS as submissões válidas (não só as enviado_brasil
  // que alimentam o mailbox), para refletir o pipeline completo.
  const kpiData = useMemo(() => {
    const valid = (submissoes as any[]).filter(
      (s) => s.produto_codigo && s.produto_nome && s.produto_codigo !== "null"
    );
    const now = Date.now();
    const atrasados = tableData.filter((r) => {
      if (r.isLinked) return false;
      const t = (r as any).data_envio ? new Date((r as any).data_envio).getTime() : ((r as any).created_at ? new Date((r as any).created_at).getTime() : 0);
      return t > 0 && now - t > 48 * 3600 * 1000;
    }).length;
    const comPendencias = tableData.filter((r) => (r.pendencias ?? 0) > 0).length;
    return {
      total: valid.length,
      enviados: valid.filter((r) => r.status === "enviado").length,
      emRevisao: valid.filter((r) => r.status === "em_revisao").length,
      aprovados: valid.filter((r) => r.status === "aprovado").length,
      rejeitados: valid.filter((r) => r.status === "rejeitado").length,
      enviadosBrasil: valid.filter((r) => r.status === "enviado_brasil").length,
      vinculados: vinculadasCount,
      atrasados,
      comPendencias,
    };
  }, [submissoes, tableData, vinculadasCount]);

  // Handlers
  const handleRowClick = (row: SubmissaoRow) => {
    setSelectedSubmissaoId(row.id);
  };

  const handleFocusClick = (row: SubmissaoRow) => {
    setFocusSubmissao(row);
  };

  const handleToggleTarefa = (tarefaId: string) => {
    setCheckedTarefas(prev => {
      const next = new Set(prev);
      next.has(tarefaId) ? next.delete(tarefaId) : next.add(tarefaId);
      return next;
    });
  };

  const handleVincular = async () => {
    if (!selectedSubmissaoId || !selectedProjetoId || checkedTarefas.size === 0) return;
    setVinculando(true);

    try {
      // Step 1: Audit
      const firstTarefaId = Array.from(checkedTarefas)[0];
      const firstTarefa = tarefas.find((t: any) => t.id === firstTarefaId);
      let auditPromise: Promise<any> | null = null;
      if (selectedSubmissao && firstTarefa) {
        auditPromise = auditTarefaProduto({
          tarefa: { titulo: firstTarefa.titulo, estagio: firstTarefa.estagio || undefined },
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
        }).catch(() => null);
      }

      // Step 2: Create task vinculos
      toast.info("Criando vínculos com tarefas...");
      const vinculosByTarefa = new Map<string, string>();
      vinculos.forEach(v => vinculosByTarefa.set(v.tarefa_id, v.id));
      for (const tarefaId of checkedTarefas) {
        const tarefa = tarefas.find((t: any) => t.id === tarefaId);
        if (vinculosByTarefa.has(tarefaId)) continue;
        await createVinculo.mutateAsync({
          submissao_id: selectedSubmissaoId,
          tarefa_id: tarefaId,
          secao_id: tarefa?.secao_id || null,
          projeto_id: selectedProjetoId,
        });
      }
      setCheckedTarefas(new Set());

      // Step 3: Create produto Brasil
      if (selectedSubmissao && selectedProjetoId) {
        try {
          toast.info("Criando produto Brasil...");
          const { supabase } = await import("@/integrations/supabase/client");
          
          // Check if produto_brasil already exists for this submissao
          const { data: existingProduto } = await (supabase
            .from("produtos_brasil" as any)
            .select("id")
            .eq("submissao_china_id", selectedSubmissaoId)
            .maybeSingle() as any);
          
          if (!existingProduto) {
            await (supabase.from("produtos_brasil" as any).insert({
              submissao_china_id: selectedSubmissaoId,
              projeto_id: selectedProjetoId,
              china_nome: selectedSubmissao.produto_nome,
              china_codigo: selectedSubmissao.produto_codigo,
              china_ean: selectedSubmissao.ean_unidade || null,
              china_descricao: selectedSubmissao.observacoes_brasil || null,
              status: "aguardando_precadastro",
            }) as any);
          }

          const { data: prodBrasil } = await (supabase
            .from("produtos_brasil" as any)
            .select("id")
            .eq("submissao_china_id", selectedSubmissaoId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single() as any);
          if (prodBrasil?.id) {
            const checklistItems = [
              "Conferência de rotulagem",
              "Conferência de composição",
              "Registro ou notificação (se aplicável)",
              "Categoria ANVISA",
              "Tradução e adequação da descrição",
              "Validação de imagens da embalagem",
              "Verificação de obrigatoriedade de lote e validade",
            ].map(item => ({ produto_brasil_id: prodBrasil.id, item, concluido: false }));
            await (supabase.from("produto_brasil_checklist" as any).insert(checklistItems) as any);
          }
        } catch (e) {
          logger.error("VincularChina: erro ao criar produto Brasil", e as Error);
        }

        // Step 4: Register process
        try {
          toast.info("Registrando processo...");
          const { supabase: sb } = await import("@/integrations/supabase/client");
          const { data: existingProcess } = await (sb
            .from("product_process" as any)
            .select("id")
            .eq("produto_tipo", "china")
            .eq("produto_ref_id", selectedSubmissaoId)
            .maybeSingle() as any);

          let processId = existingProcess?.id;
          if (!processId) {
            const { data: { user } } = await sb.auth.getUser();
            const { data: newProcess } = await (sb
              .from("product_process" as any)
              .insert({
                produto_tipo: "china",
                produto_ref_id: selectedSubmissaoId,
                criado_por: user?.id,
                etapa_atual: "projeto",
              })
              .select("id")
              .single() as any);
            processId = newProcess?.id;
          } else {
            await (sb
              .from("product_process" as any)
              .update({ etapa_atual: "projeto" })
              .eq("id", processId)
              .eq("etapa_atual", "ideia") as any);
          }

          if (processId) {
            const { data: { user } } = await sb.auth.getUser();
            const { data: profile } = await sb.from("profiles").select("nome").eq("id", user!.id).maybeSingle();
            const projetoNome = projetos.find((p: any) => p.id === selectedProjetoId)?.nome || selectedProjetoId;

            await (sb.from("process_events" as any).insert({
              process_id: processId,
              tipo_evento: "vinculacao",
              descricao: `Vinculado ao projeto: ${projetoNome}`,
              modulo_origem: "processo",
              usuario_id: user?.id,
              usuario_nome: profile?.nome || user?.email,
              metadata: { projeto_id: selectedProjetoId, projeto_nome: projetoNome },
            }) as any);

            await (sb.from("process_step_history" as any).insert({
              process_id: processId,
              etapa: "projeto",
              status: "em_andamento",
              responsavel_id: user?.id,
              data_inicio: new Date().toISOString(),
            }) as any);
          }
        } catch (e) {
          logger.error("VincularChina: erro ao registrar processo", e as Error);
        }
      }

      if (auditPromise) auditPromise.then(() => {});
      toast.success("Vinculação concluída!");
    } catch (e) {
      logger.error("VincularChina: erro na vinculação", e as Error);
      toast.error("Erro ao vincular");
    } finally {
      setVinculando(false);
    }
  };

  const handleDesvincular = (vinculoId: string) => {
    setDesvincularTarget(vinculoId);
  };

  const confirmDesvincular = () => {
    if (desvincularTarget) {
      deleteVinculo.mutate(desvincularTarget);
      setDesvincularTarget(null);
    }
  };

  // Vincula produto da linha a um projeto (existente ou recém-criado).
  // Cria produto_brasil + processo e abre o painel lateral para escolher tarefas.
  const handleLinkRowToProjeto = async (row: SubmissaoRow, projetoId: string) => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");

      // 1) Cria produto_brasil se ainda não existir
      const { data: existingProduto } = await (supabase
        .from("produtos_brasil" as any)
        .select("id")
        .eq("submissao_china_id", row.id)
        .maybeSingle() as any);

      if (!existingProduto) {
        await (supabase.from("produtos_brasil" as any).insert({
          submissao_china_id: row.id,
          projeto_id: projetoId,
          china_nome: row.produto_nome,
          china_codigo: row.produto_codigo,
          china_ean: row.ean_unidade || null,
          china_descricao: row.observacoes_brasil || null,
          status: "aguardando_precadastro",
        }) as any);
      }

      // 2) Registra processo (idempotente) + evento de vinculação
      const { data: existingProcess } = await (supabase
        .from("product_process" as any)
        .select("id")
        .eq("produto_tipo", "china")
        .eq("produto_ref_id", row.id)
        .maybeSingle() as any);

      let processId = existingProcess?.id;
      const { data: { user } } = await supabase.auth.getUser();
      if (!processId) {
        const { data: newProcess } = await (supabase
          .from("product_process" as any)
          .insert({
            produto_tipo: "china",
            produto_ref_id: row.id,
            criado_por: user?.id,
            etapa_atual: "projeto",
          })
          .select("id")
          .single() as any);
        processId = newProcess?.id;
      } else {
        await (supabase
          .from("product_process" as any)
          .update({ etapa_atual: "projeto" })
          .eq("id", processId)
          .eq("etapa_atual", "ideia") as any);
      }

      if (processId) {
        const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user!.id).maybeSingle();
        const projetoNome = projetos.find((p: any) => p.id === projetoId)?.nome || projetoId;
        await (supabase.from("process_events" as any).insert({
          process_id: processId,
          tipo_evento: "vinculacao",
          descricao: `Vinculado ao projeto: ${projetoNome}`,
          modulo_origem: "processo",
          usuario_id: user?.id,
          usuario_nome: profile?.nome || user?.email,
          metadata: { projeto_id: projetoId, projeto_nome: projetoNome },
        }) as any);
      }

      // 3) Atualiza estado da página: seleciona projeto e abre painel lateral na linha
      setSelectedProjetoId(projetoId);
      setSelectedSubmissaoId(row.id);
      setCheckedTarefas(new Set());

      // 4) Invalida caches para a coluna "Projeto" refletir imediatamente
      await queryClient.invalidateQueries({ queryKey: ["china-produto-brasil-vinculos"] });
      await queryClient.invalidateQueries({ queryKey: ["china-tarefa-vinculos-all"] });

      // 5) Destaque temporário da linha recém-vinculada
      setRecentlyLinkedId(row.id);
      window.setTimeout(() => setRecentlyLinkedId(prev => (prev === row.id ? null : prev)), 2000);

      const projetoNome = projetos.find((p: any) => p.id === projetoId)?.nome || "projeto";
      toast.success(`Vinculado a "${projetoNome}". Selecione as tarefas no painel lateral.`);
    } catch (e: any) {
      logger.error("VincularChina: erro ao vincular linha", e as Error);
      toast.error("Erro ao vincular: " + (e?.message || "tente novamente"));
    }
  };

  const handleToggleDocVinculo = async (docId: string, tarefaId: string) => {
    if (!selectedProjetoId) return;
    const docVinculoMap = new Map<string, string>();
    docVinculos.forEach(v => docVinculoMap.set(`${v.documento_id}-${v.tarefa_id}`, v.id));
    const key = `${docId}-${tarefaId}`;
    const existingId = docVinculoMap.get(key);
    if (existingId) {
      deleteDocVinculo.mutate(existingId);
    } else {
      const tarefa = tarefas.find((t: any) => t.id === tarefaId);
      await createDocVinculo.mutateAsync({
        documento_id: docId,
        tarefa_id: tarefaId,
        secao_id: tarefa?.secao_id || null,
        projeto_id: selectedProjetoId,
      });
    }
  };

  const getDocTypeLabel = (tipo: string) => {
    const dt = CHINA_DOCUMENT_TYPES.find(d => d.tipo === tipo);
    return dt ? dt.labelPt : tipo;
  };

  if (!isDevTeam) {
    return <AccessDenied message="Acesso restrito à equipe de desenvolvimento." />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main
          className="flex-1 overflow-auto"
          style={
            bgColor
              ? ({ backgroundColor: bgColor, color: "hsl(var(--foreground))", ...getBgPaletteVars(bgColor) } as React.CSSProperties)
              : undefined
          }
        >
          <div className="p-4 sm:p-6 space-y-4 w-full">
            {/* Linha 1: Breadcrumb + actions (padrão Central de Trabalho) */}
            <div className="flex items-center justify-between gap-3">
              <Breadcrumb className="min-h-[28px] flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden">
                <BreadcrumbList className="flex-nowrap">
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <RouterLink to="/dashboard">Dashboard</RouterLink>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <RouterLink to="/dashboard/projetos">Projetos</RouterLink>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Vincular China</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex items-center gap-2 shrink-0">
                <SidebarTrigger />
                <ProjetoBgColorPicker value={bgColor} onChange={setBgColor} />
              </div>
            </div>

            {/* Linha 2: Hero (sem ArrowLeft redundante — sidebar já cobre navegação) */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-foreground truncate">Mesa de Vínculo — Documentos da China</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Receba, faça a triagem e encaminhe os envios da China para projetos, despachos e responsáveis.
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <Progress value={progressPct} className="h-2 w-40" />
                  <span className="text-xs font-medium text-foreground">{vinculadasCount}/{tableData.length} encaminhados · {progressPct}%</span>
                </div>
              </div>
              <div className="w-[250px]">
                <Select value={selectedProjetoId || ""} onValueChange={v => { setSelectedProjetoId(v); setCheckedTarefas(new Set()); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione um projeto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projetos.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          {p.cor && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />}
                          {p.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Painel de monitoramento — KPIs */}
            <VincularChinaKpis
              data={kpiData}
              activeFilter={kpiStatusFilter}
              onFilterClick={(key) => {
                setKpiStatusFilter(key);
                if (key === "vinculados") setFolder("vinculadas");
                else if (key === "atrasados") setFolder("nao_vinculadas");
                else if (key === "com_pendencias") setFolder("pendencias");
              }}
              collapsed={!kpisOpen}
              onToggleCollapsed={() => setKpisOpen((v) => !v)}
            />

      {/* Mailbox 3-pane layout */}
      {(() => {
        const { rows: mailboxRows, counts: folderCounts } = classifyVincularRows(tableData, flags, snoozes);
        const baseFolderItems = filterByFolder(mailboxRows, folder);
        const folderItems = (() => {
          if (!kpiStatusFilter || kpiStatusFilter === "todos") return baseFolderItems;
          if (kpiStatusFilter === "vinculados") return baseFolderItems.filter((i: any) => i.isLinked);
          if (kpiStatusFilter === "com_pendencias") return baseFolderItems.filter((i: any) => (i.pendencias ?? 0) > 0);
          if (kpiStatusFilter === "atrasados") {
            const now = Date.now();
            return baseFolderItems.filter((i: any) => {
              if (i.isLinked) return false;
              const t = i.data_envio ? new Date(i.data_envio).getTime() : (i.created_at ? new Date(i.created_at).getTime() : 0);
              return t > 0 && now - t > 48 * 3600 * 1000;
            });
          }
          return baseFolderItems.filter((i: any) => i.status === kpiStatusFilter);
        })();
        const selectedMailRow = mailboxRows.find((r) => r.id === selectedSubmissaoId) || null;

        const handleToggleAllChecks = () => {
          if (folderItems.every((i) => selectedIds.has(i.id))) {
            const next = new Set(selectedIds);
            folderItems.forEach((i) => next.delete(i.id));
            setSelectedIds(next);
          } else {
            const next = new Set(selectedIds);
            folderItems.forEach((i) => next.add(i.id));
            setSelectedIds(next);
          }
        };

        const handleToggleCheck = (id: string) => {
          const next = new Set(selectedIds);
          next.has(id) ? next.delete(id) : next.add(id);
          setSelectedIds(next);
        };

        return (
          <div className="h-[calc(100vh-220px)] overflow-hidden rounded-md border border-border bg-card/20">
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
                <VincularMailboxSidebar
                  folder={folder}
                  counts={folderCounts}
                  onSelect={(f) => { setFolder(f); }}
                  progressPct={progressPct}
                  vinculadas={vinculadasCount}
                  total={tableData.length}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={selectedMailRow ? 36 : 82} minSize={24}>
                <VincularMailboxList
                  items={folderItems}
                  folder={folder}
                  selectedId={selectedSubmissaoId}
                  selectedIds={selectedIds}
                  onSelect={(id) => setSelectedSubmissaoId(id)}
                  onFocus={(item) => setFocusSubmissao(item)}
                  onToggleCheck={handleToggleCheck}
                  onToggleAllChecks={handleToggleAllChecks}
                  onToggleStar={(item) =>
                    toggleFlag.mutate({ submissao_id: item.id, flagged: !item.is_flagged })
                  }
                  onLinkRow={(row, pid) => handleLinkRowToProjeto(row, pid)}
                  projetos={projetos}
                  search={searchTerm}
                  onSearchChange={setSearchTerm}
                  onBulkLink={() => setBulkOpen(true)}
                />
              </ResizablePanel>
              {selectedMailRow && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={46} minSize={28} maxSize={60}>
                    <VincularChinaSidePanel
                      submissao={selectedMailRow}
                      isLinkedToProject={submissaoVinculadas.has(selectedMailRow.id)}
                      selectedProjetoId={selectedProjetoId}
                      onClose={() => setSelectedSubmissaoId(null)}
                      onPreviewDoc={setPreviewDoc}
                      onEncaminharResponsavel={() => setEncaminharOpen(true)}
                      onEncaminharProjeto={() => setEncaminharProjetoOpen(true)}
                      onContinuarNoProjeto={() => setContinuarProjetoOpen(true)}
                      onDecisionClick={(id) => { setDecisionProcessId(id); setDecisionOpen(true); }}
                      secoes={secoes}
                      tarefas={tarefas}
                      vinculos={vinculos}
                      docVinculos={docVinculos}
                      checkedTarefas={checkedTarefas}
                      onToggleTarefa={handleToggleTarefa}
                      onVincular={handleVincular}
                      onToggleDocVinculo={handleToggleDocVinculo}
                      vinculosPending={createVinculo.isPending || vinculando}
                      auditResult={auditResult}
                      auditLoading={auditLoading}
                    />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </div>
        );
      })()}

      {/* Existing vinculos (collapsible) */}
      {allVinculos.length > 0 && (
        <Collapsible open={vinculosOpen} onOpenChange={setVinculosOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Vínculos Existentes
                    <Badge variant="secondary" className="text-[10px] ml-1">{allVinculos.length}</Badge>
                  </CardTitle>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", vinculosOpen && "rotate-90")} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="divide-y">
                  {allVinculos.map((v: any) => {
                    const projeto = projetos.find((p: any) => p.id === v.projeto_id);
                    return (
                      <div key={v.id} className="flex items-center gap-3 py-2.5">
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-mono font-bold text-primary">{v.submissao?.produto_codigo || "—"}</span>
                          <span className="text-xs text-muted-foreground mx-1.5">→</span>
                          <span className="text-sm text-foreground">{projeto?.nome || v.projeto_id}</span>
                        </div>
                        {v.submissao?.status && (
                          <Badge variant={getStatusBadgeVariant(v.submissao.status)} className="text-[10px]">
                            {getStatusLabel(v.submissao.status)}
                          </Badge>
                        )}
                        {v.audit_result && <AuditChinaVinculoBadge result={v.audit_result} compact />}
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
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Bulk Actions Dialog */}
      <VincularChinaBulkActions
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        selectedIds={Array.from(selectedIds)}
        submissoes={tableData}
        onComplete={() => setSelectedIds(new Set())}
      />

      {/* Grade Dialog */}
      <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              Grade de Cores — {selectedSubmissao?.produto_codigo} {selectedSubmissao?.produto_nome}
            </DialogTitle>
          </DialogHeader>
          <ChinaGradeView items={cores as any} />
        </DialogContent>
      </Dialog>

      {/* Document Preview */}
      <ChinaDocPreviewDialog
        open={!!previewDoc}
        onOpenChange={open => { if (!open) setPreviewDoc(null); }}
        arquivoPath={previewDoc?.arquivo_path}
        arquivoUrl={previewDoc?.arquivo_url}
        nomeArquivo={previewDoc?.nome_arquivo}
        tipoDocumento={getDocTypeLabel(previewDoc?.tipo_documento || "")}
      />

      {/* Focus Mode — visual aligned with Projetos environment */}
      <Dialog open={!!focusSubmissao} onOpenChange={open => { if (!open) setFocusSubmissao(null); }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b bg-card shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-primary text-sm font-semibold">
                    {focusSubmissao?.produto_codigo}
                  </span>
                  <Badge variant={getStatusBadgeVariant(focusSubmissao?.status || "")} className="text-[10px] h-5">
                    {getStatusLabel(focusSubmissao?.status || "")}
                  </Badge>
                  <p className="text-sm font-medium text-foreground truncate">
                    {focusSubmissao?.produto_nome}
                  </p>
                </div>
              </div>
              {focusSubmissao?.numero_ordem && (
                <Badge variant="outline" className="text-[10px] shrink-0 mr-8">
                  OC: {focusSubmissao.numero_ordem}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-auto">
            <div className="p-4">
              {focusSubmissao && (
                <ChinaSubmissaoExpandido
                  submissao={focusSubmissao}
                  onPreviewDoc={setPreviewDoc}
                  processoId={undefined}
                  variant="focus"
                />
              )}
              {focusSubmissao && (
                <FocusModeDespachosWrapper submissaoId={focusSubmissao.id} onPreviewDoc={setPreviewDoc} />
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Process Decision */}
      {decisionProcessId && (
        <ProcessDecisionDialog
          open={decisionOpen}
          onOpenChange={setDecisionOpen}
          processId={decisionProcessId}
          submissaoId={decisionProcessId}
          documentos={documentos.map((d: any) => ({ id: d.id, nome_arquivo: d.nome_arquivo, tipo_documento: d.tipo_documento }))}
        />
      )}

      {/* Encaminhar a responsável */}
      <EncaminharResponsavelDialog
        open={encaminharOpen}
        onOpenChange={setEncaminharOpen}
        submissaoId={selectedSubmissaoId}
        produtoCodigo={selectedSubmissao?.produto_codigo}
        produtoNome={selectedSubmissao?.produto_nome}
      />

      {/* Encaminhar a projeto/tarefa */}
      <EncaminharProjetoDialog
        open={encaminharProjetoOpen}
        onOpenChange={setEncaminharProjetoOpen}
        submissaoId={selectedSubmissaoId}
        produtoCodigo={selectedSubmissao?.produto_codigo}
        produtoNome={selectedSubmissao?.produto_nome}
      />

      {/* Continuar no projeto — cria ou vincula projeto-espelho */}
      <ContinuarNoProjetoDialog
        open={continuarProjetoOpen}
        onOpenChange={setContinuarProjetoOpen}
        submissaoId={selectedSubmissaoId}
        produtoCodigo={selectedSubmissao?.produto_codigo}
        produtoNome={selectedSubmissao?.produto_nome}
      />


      {/* Desvincular confirmation */}
      <AlertDialog open={!!desvincularTarget} onOpenChange={open => { if (!open) setDesvincularTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar desvinculação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este vínculo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDesvincular} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

/** Wrapper to fetch focus-mode documents independently */
function FocusModeDespachosWrapper({ submissaoId, onPreviewDoc }: { submissaoId: string; onPreviewDoc: (doc: any) => void }) {
  const { data: focusDocs = [] } = useDocumentosDaSubmissao(submissaoId);
  return (
    <div className="mt-4">
      <DespachosPanel submissaoId={submissaoId} documentos={focusDocs} />
    </div>
  );
}
