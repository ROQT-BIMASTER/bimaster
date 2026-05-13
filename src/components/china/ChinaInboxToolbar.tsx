import { useMemo } from "react";
import { Search, X, LayoutGrid, Rows3, Layers, Filter as FilterIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import type { ChinaInboxItem } from "@/hooks/useChinaInbox";
import { useChinaI18n } from "@/hooks/useChinaI18n";

export type InboxViewMode = "table" | "cards";
export type InboxUrgencia = "todos" | "24" | "48" | "72";

export interface InboxFilterState {
  busca: string;
  oc: string; // "todos" | numero_ordem
  tipo: string; // "todos" | tipo_documento
  urgencia: InboxUrgencia;
  agrupar: boolean;
}

interface Props {
  items: ChinaInboxItem[];
  filters: InboxFilterState;
  onFiltersChange: (next: InboxFilterState) => void;
  viewMode: InboxViewMode;
  onViewModeChange: (mode: InboxViewMode) => void;
  isDesktop: boolean;
}

/**
 * Toolbar superior da Caixa de Entrada China — busca, filtros e troca
 * de visualização (tabela/cards) com toggle de agrupamento por produto.
 */
export function ChinaInboxToolbar({
  items, filters, onFiltersChange, viewMode, onViewModeChange, isDesktop,
}: Props) {
  const { t } = useChinaI18n();
  // Listas derivadas — alimentam selects de OC e Tipo
  const ocs = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.numero_ordem && set.add(i.numero_ordem));
    return Array.from(set).sort();
  }, [items]);

  const tipos = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.tipo_documento));
    return Array.from(set).sort();
  }, [items]);

  const tipoLabel = (tp: string) => {
    const cfg = CHINA_DOCUMENT_TYPES.find((c) => c.tipo === tp);
    return cfg ? `${cfg.labelPt} ${cfg.labelCn ?? ""}` : tp;
  };

  const activeCount =
    (filters.busca ? 1 : 0) +
    (filters.oc !== "todos" ? 1 : 0) +
    (filters.tipo !== "todos" ? 1 : 0) +
    (filters.urgencia !== "todos" ? 1 : 0);

  const clear = () =>
    onFiltersChange({
      busca: "",
      oc: "todos",
      tipo: "todos",
      urgencia: "todos",
      agrupar: filters.agrupar,
    });

  return (
    <Card className="p-3 space-y-2">
      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        {/* Busca */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filters.busca}
            onChange={(e) => onFiltersChange({ ...filters, busca: e.target.value })}
            placeholder={t("inbox.toolbar.buscarPlaceholder")}
            className="h-8 pl-8 text-xs"
          />
          {filters.busca && (
            <button
              onClick={() => onFiltersChange({ ...filters, busca: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("inbox.toolbar.limparBusca")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* OC */}
        <Select
          value={filters.oc}
          onValueChange={(v) => onFiltersChange({ ...filters, oc: v })}
        >
          <SelectTrigger className="h-8 text-xs w-full lg:w-[150px]">
            <SelectValue placeholder={t("inbox.toolbar.ocPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" className="text-xs">{t("inbox.toolbar.todasOcs")}</SelectItem>
            {ocs.map((oc) => (
              <SelectItem key={oc} value={oc} className="text-xs">
                {t("inbox.toolbar.ocPlaceholder")} {oc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tipo de documento */}
        <Select
          value={filters.tipo}
          onValueChange={(v) => onFiltersChange({ ...filters, tipo: v })}
        >
          <SelectTrigger className="h-8 text-xs w-full lg:w-[200px]">
            <SelectValue placeholder={t("inbox.toolbar.tipoPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" className="text-xs">{t("inbox.toolbar.todosTipos")}</SelectItem>
            {tipos.map((tp) => (
              <SelectItem key={tp} value={tp} className="text-xs">
                {tipoLabel(tp)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Urgência */}
        <Select
          value={filters.urgencia}
          onValueChange={(v) => onFiltersChange({ ...filters, urgencia: v as InboxUrgencia })}
        >
          <SelectTrigger className="h-8 text-xs w-full lg:w-[140px]">
            <SelectValue placeholder={t("inbox.toolbar.urgenciaPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" className="text-xs">{t("inbox.toolbar.todasIdades")}</SelectItem>
            <SelectItem value="24" className="text-xs">{t("inbox.toolbar.mais24h")}</SelectItem>
            <SelectItem value="48" className="text-xs">{t("inbox.toolbar.mais48h")}</SelectItem>
            <SelectItem value="72" className="text-xs">{t("inbox.toolbar.mais72h")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Limpar filtros */}
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clear}>
            <X className="h-3.5 w-3.5" />
            {t("inbox.toolbar.limpar", { count: activeCount })}
          </Button>
        )}
      </div>

      {/* Linha 2 — toggles de visualização */}
      {isDesktop && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
          <div className="flex items-center gap-2">
            <FilterIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              {t("inbox.toolbar.visualizacao")}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {viewMode === "table" && (
              <Button
                variant={filters.agrupar ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => onFiltersChange({ ...filters, agrupar: !filters.agrupar })}
              >
                <Layers className="h-3.5 w-3.5" />
                {t("inbox.toolbar.agruparProduto")}
                {filters.agrupar && (
                  <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">
                    ON
                  </Badge>
                )}
              </Button>
            )}

            <div className="flex rounded-md border border-border overflow-hidden">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-[11px] rounded-none gap-1 px-2"
                onClick={() => onViewModeChange("table")}
              >
                <Rows3 className="h-3.5 w-3.5" />
                {t("inbox.toolbar.tabela")}
              </Button>
              <Button
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-[11px] rounded-none gap-1 px-2"
                onClick={() => onViewModeChange("cards")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {t("inbox.toolbar.cards")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
