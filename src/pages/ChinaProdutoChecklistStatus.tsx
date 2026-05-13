import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ListChecks,
  Loader2,
  CheckCircle2,
  Circle,
  ArrowUpRight,
  ArrowDownLeft,
  Paperclip,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { ChinaTimelineButton } from "@/components/china/timeline/ChinaTimelineButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  useMergedChinaChecklist,
  type MergedChecklistCategory,
} from "@/hooks/useMergedChinaChecklist";

interface DocRow {
  id: string;
  tipo_documento: string;
  status: string;
  nome_arquivo: string | null;
  created_at: string;
  oficializado_em: string | null;
  previsao_envio: string | null;
}

const SENT_STATUSES = new Set([
  "enviado",
  "enviado_brasil",
  "pendente",
  "aprovado",
  "ciencia",
  "contestado",
  "rejeitado",
]);

const STATUS_LABEL: Record<string, string> = {
  aprovado: "Aprovado",
  ciencia: "Ciente",
  enviado: "Enviado",
  enviado_brasil: "Enviado ao Brasil",
  pendente: "Pendente análise",
  rejeitado: "Rejeitado",
  contestado: "Contestado",
  rascunho: "Rascunho",
  planejado: "Planejado",
};

const STATUS_CLS: Record<string, string> = {
  aprovado: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  ciencia: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  enviado: "bg-primary/15 text-primary border-primary/30",
  enviado_brasil: "bg-primary/15 text-primary border-primary/30",
  pendente: "bg-primary/15 text-primary border-primary/30",
  contestado: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  rejeitado: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  rascunho: "bg-muted text-muted-foreground border-border",
  planejado: "bg-muted text-muted-foreground border-border",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function isSentToBrazil(doc: DocRow | undefined): boolean {
  if (!doc) return false;
  return SENT_STATUSES.has(doc.status);
}

interface CategoryBlockProps {
  cat: MergedChecklistCategory;
  docsByTipo: Map<string, DocRow>;
  getLabel: (tipo: string) => { pt: string; cn?: string };
  onOpenFocus: (tipo: string) => void;
}

function CategoryBlock({ cat, docsByTipo, getLabel, onOpenFocus }: CategoryBlockProps) {
  const FluxoIcon = cat.fluxo === "china_envia" ? ArrowUpRight : ArrowDownLeft;
  const fluxoLabel = cat.fluxo === "china_envia" ? "China envia" : "Brasil envia";

  const enviados = cat.tipos.reduce(
    (acc, t) => acc + (isSentToBrazil(docsByTipo.get(t)) ? 1 : 0),
    0,
  );
  const total = cat.tipos.length;
  const pct = total > 0 ? Math.round((enviados / total) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FluxoIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
            {fluxoLabel}
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="truncate text-sm font-semibold text-foreground">
            {cat.labelPt}
          </span>
          {cat.labelCn && (
            <span className="truncate text-[11px] text-muted-foreground/80">
              {cat.labelCn}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{enviados}</span> /{" "}
            {total} enviados
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all",
                pct === 100 ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      {cat.tipos.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          Nenhum item configurado nesta categoria.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[42%]">Item do checklist</TableHead>
              <TableHead className="w-[16%]">Status</TableHead>
              <TableHead className="w-[14%] text-center">Enviado ao Brasil</TableHead>
              <TableHead className="w-[16%]">Última atualização</TableHead>
              <TableHead className="w-[12%] text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cat.tipos.map((tipo) => {
              const doc = docsByTipo.get(tipo);
              const label = getLabel(tipo);
              const sent = isSentToBrazil(doc);
              const status = doc?.status ?? "nao_criado";
              const statusLabel =
                status === "nao_criado"
                  ? "Não criado"
                  : STATUS_LABEL[status] ?? status;
              const statusCls =
                status === "nao_criado"
                  ? "bg-muted text-muted-foreground border-border"
                  : STATUS_CLS[status] ?? "bg-muted text-muted-foreground border-border";
              const lastUpdate = doc?.oficializado_em ?? doc?.created_at ?? null;

              return (
                <TableRow key={tipo}>
                  <TableCell className="py-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {label.pt}
                        </p>
                        {label.cn && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {label.cn}
                          </p>
                        )}
                        {doc?.nome_arquivo && (
                          <p className="truncate text-[10.5px] text-muted-foreground/80">
                            {doc.nome_arquivo}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge
                      variant="outline"
                      className={cn("h-5 px-2 text-[10.5px] font-medium", statusCls)}
                    >
                      {statusLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    {sent ? (
                      <span
                        className="inline-flex items-center justify-center"
                        title={`Enviado ao Brasil em ${formatDate(lastUpdate)}`}
                        aria-label="Enviado ao Brasil"
                      >
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center justify-center"
                        title="Ainda não enviado ao Brasil"
                        aria-label="Não enviado ao Brasil"
                      >
                        <Circle className="h-5 w-5 text-muted-foreground/40" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">
                    {formatDate(lastUpdate)}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-primary"
                      onClick={() => onOpenFocus(tipo)}
                    >
                      {doc ? "Abrir" : "Anexar"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

export default function ChinaProdutoChecklistStatus() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const merged = useMergedChinaChecklist(id);

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

  const { data: documentos = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["china-checklist-status-docs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_documentos" as any)
        .select(
          "id, tipo_documento, status, nome_arquivo, created_at, oficializado_em, previsao_envio",
        )
        .eq("submissao_id", id)
        .neq("status", "planejado");
      if (error) throw error;
      return (data || []) as unknown as DocRow[];
    },
  });

  const docsByTipo = useMemo(() => {
    const m = new Map<string, DocRow>();
    // Mantém o doc mais recente por tipo (em caso de múltiplas versões).
    for (const d of documentos) {
      const prev = m.get(d.tipo_documento);
      if (!prev) {
        m.set(d.tipo_documento, d);
        continue;
      }
      const prevTs = new Date(prev.oficializado_em ?? prev.created_at).getTime();
      const curTs = new Date(d.oficializado_em ?? d.created_at).getTime();
      if (curTs > prevTs) m.set(d.tipo_documento, d);
    }
    return m;
  }, [documentos]);

  const getLabel = (tipo: string) => {
    const dt = merged.getDocType(tipo);
    return { pt: dt?.labelPt ?? tipo, cn: dt?.labelCn };
  };

  const handleOpenFocus = (tipo: string) => {
    if (!id) return;
    navigate(
      `/dashboard/fabrica-china/produto/${id}?focus=${encodeURIComponent(tipo)}`,
    );
  };

  if (!id) return null;

  const loading = merged.isLoading || loadingDocs;
  const allCats = merged.categories;

  // Totais globais
  const allTipos = allCats.flatMap((c) => c.tipos);
  const totalGlobal = allTipos.length;
  const enviadosGlobal = allTipos.reduce(
    (acc, t) => acc + (isSentToBrazil(docsByTipo.get(t)) ? 1 : 0),
    0,
  );

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt="Status do Checklist"
        titleCn="清单状态"
        subtitle={
          submissao
            ? `${submissao.produto_codigo} — ${submissao.produto_nome}`
            : undefined
        }
        icon={ListChecks}
        iconTone="primary"
        showBack
        backTo={`/dashboard/fabrica-china/produto/${id}`}
        actions={<ChinaTimelineButton scope={{ submissaoId: id }} />}
      />

      <div className="space-y-3">
        <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Progresso geral
            </p>
            <p className="text-sm font-medium text-foreground">
              <span className="text-base font-semibold">{enviadosGlobal}</span>{" "}
              de <span className="font-semibold">{totalGlobal}</span> itens enviados ao Brasil
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full transition-all",
                  totalGlobal > 0 && enviadosGlobal === totalGlobal
                    ? "bg-emerald-500"
                    : "bg-primary",
                )}
                style={{
                  width: `${totalGlobal > 0 ? Math.round((enviadosGlobal / totalGlobal) * 100) : 0}%`,
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() =>
                navigate(`/dashboard/fabrica-china/produto/${id}?focus=__overview__`)
              }
            >
              Abrir Modo Foco
            </Button>
          </div>
        </Card>

        {loading ? (
          <Card className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </Card>
        ) : allCats.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma categoria configurada para este produto.
          </Card>
        ) : (
          allCats.map((cat) => (
            <CategoryBlock
              key={cat.key}
              cat={cat}
              docsByTipo={docsByTipo}
              getLabel={getLabel}
              onOpenFocus={handleOpenFocus}
            />
          ))
        )}
      </div>
    </ChinaPageShell>
  );
}
