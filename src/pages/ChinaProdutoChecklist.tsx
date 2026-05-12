import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { ChinaTimelineButton } from "@/components/china/timeline/ChinaTimelineButton";
import { Card } from "@/components/ui/card";
import { ChecklistEmbalagensTable } from "@/components/china/ChecklistEmbalagensTable";
import { ChecklistTemplateMenu } from "@/components/china/ChecklistTemplateMenu";
import {
  useChinaProdutoChecklist,
  useChinaChecklistCelulas,
  useEnsureChecklist,
  useUpdateChecklistColunas,
  useUpsertCelula,
  COLUNAS_PADRAO,
  type ChecklistColuna,
} from "@/hooks/useChinaProdutoChecklist";
import { useUIPermissions } from "@/hooks/useUIPermissions";

export default function ChinaProdutoChecklist() {
  const { id } = useParams<{ id: string }>();
  const { canEdit } = useUIPermissions("china_ficha");

  const { data: submissao } = useQuery({
    queryKey: ["china-ficha", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_submissoes" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: cores = [] } = useQuery({
    queryKey: ["china-ficha-cores", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_cores" as any)
        .select("*")
        .eq("submissao_id", id)
        .order("ordem", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: checklist, isLoading: loadingCheck } = useChinaProdutoChecklist(id);
  const ensure = useEnsureChecklist();
  const updateCols = useUpdateChecklistColunas();
  const upsertCell = useUpsertCelula();

  // Auto-create checklist if missing once we have the submission
  useEffect(() => {
    if (id && submissao && !checklist && !loadingCheck && !ensure.isPending) {
      ensure.mutate(id);
    }
  }, [id, submissao, checklist, loadingCheck]);

  const { data: celulas = [] } = useChinaChecklistCelulas(checklist?.id);

  const colunas: ChecklistColuna[] = useMemo(
    () => (checklist?.colunas?.length ? checklist.colunas : COLUNAS_PADRAO),
    [checklist],
  );

  const readOnly = !canEdit;

  const handleAddCol = (col: ChecklistColuna) => {
    if (!checklist) return;
    const next = [...colunas, col];
    updateCols.mutate({ checklistId: checklist.id, colunas: next });
  };
  const handleRemoveCol = (key: string) => {
    if (!checklist) return;
    const next = colunas.filter((c) => c.key !== key).map((c, i) => ({ ...c, ordem: i }));
    updateCols.mutate(
      { checklistId: checklist.id, colunas: next, removedKeys: [key] },
      {
        onSuccess: () => {
          // Toast leve para confirmar remoção (autosave de colunas)
          import("sonner").then(({ toast }) => toast.success("Coluna removida"));
        },
      },
    );
  };
  const handleRenameCol = (key: string, label_pt: string, label_cn: string) => {
    if (!checklist) return;
    const next = colunas.map((c) => (c.key === key ? { ...c, label_pt, label_cn } : c));
    updateCols.mutate({ checklistId: checklist.id, colunas: next });
  };
  const handleApplyTemplate = (cols: ChecklistColuna[]) => {
    if (!checklist) return;
    const normalized = cols.map((c, i) => ({ ...c, ordem: i }));
    // Substitui as colunas atuais pelo template selecionado e remove as
    // células das colunas antigas para não deixar dados órfãos
    // 用所选模板替换当前列，并删除旧列的单元格以避免遗留数据
    const novosKeys = new Set(normalized.map((c) => c.key));
    const removedKeys = colunas
      .map((c) => c.key)
      .filter((k) => !novosKeys.has(k));
    if (removedKeys.length > 0) {
      const ok = window.confirm(
        "Aplicar este modelo substitui as colunas atuais e remove os dados das colunas removidas. Continuar?\n\n应用此模板将替换当前列并删除被移除列的数据。是否继续？",
      );
      if (!ok) return;
    }
    updateCols.mutate({ checklistId: checklist.id, colunas: normalized, removedKeys });
  };
  const handleToggle = (corId: string, colunaKey: string, marcado: boolean) => {
    if (!checklist) return;
    upsertCell.mutate({ checklistId: checklist.id, corId, colunaKey, marcado });
  };
  const handleMockup = (corId: string, path: string | null) => {
    if (!checklist) return;
    upsertCell.mutate({ checklistId: checklist.id, corId, colunaKey: "__mockup__", mockupPath: path });
  };

  if (!id) return null;

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt="Checklist de Embalagens"
        titleCn="包装清单"
        subtitle={submissao ? `${submissao.produto_codigo} — ${submissao.produto_nome}` : undefined}
        icon={ListChecks}
        iconTone="destructive"
        showBack
        backTo={`/dashboard/fabrica-china/produto/${id}`}
        actions={
          <>
            <ChinaTimelineButton scope={{ submissaoId: id }} />
            {checklist && !readOnly && (
              <ChecklistTemplateMenu
                marca={submissao?.marca || null}
                colunasAtuais={colunas}
                onApply={handleApplyTemplate}
              />
            )}
          </>
        }
      />

      {(loadingCheck || !checklist) ? (
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      ) : (
        <Card className="p-4">
          <ChecklistEmbalagensTable
            submissaoId={id}
            checklistId={checklist.id}
            cores={cores}
            colunas={colunas}
            celulas={celulas}
            readOnly={readOnly}
            onAddColuna={handleAddCol}
            onRemoveColuna={handleRemoveCol}
            onRenameColuna={handleRenameCol}
            onToggleCelula={handleToggle}
            onSetMockup={handleMockup}
          />
          <p className="text-[11px] text-muted-foreground mt-3">
            Marcações e mockups são salvos automaticamente. Use templates para reaproveitar a configuração de colunas em outros produtos da mesma marca.
          </p>
        </Card>
      )}
    </ChinaPageShell>
  );
}
