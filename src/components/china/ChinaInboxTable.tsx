import { useEffect, useMemo, useState, Fragment } from "react";
import {
  ChevronRight, ChevronDown, CheckCircle2, XCircle, Eye, Clock,
  AlertTriangle, FileText, ExternalLink, Layers, EyeOff, X,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import { ChinaQuickReject } from "./ChinaQuickReject";
import type { ChinaInboxItem } from "@/hooks/useChinaInbox";
import { useNavigate } from "react-router-dom";

interface Props {
  items: ChinaInboxItem[];
  isBrasilUser: boolean;
  isChinaUser: boolean;
  agrupar: boolean;
  onApprove: (item: ChinaInboxItem) => void;
  onReject: (item: ChinaInboxItem, motivo: string) => void;
  onView: (item: ChinaInboxItem) => void;
  onCorrigir?: (item: ChinaInboxItem) => void;
  /** Marca documento como visto (registra ciência sem aprovar/rejeitar). */
  onCiencia?: (item: ChinaInboxItem) => void;
  loading?: boolean;
}

interface Group {
  key: string;
  submissao_id: string;
  produto_codigo: string;
  produto_nome: string;
  numero_ordem: string | null;
  itens: ChinaInboxItem[];
  oldestHours: number;
  ajustes: number;
  pendentes: number;
}

function buildGroups(items: ChinaInboxItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const k = it.submissao_id;
    let g = map.get(k);
    if (!g) {
      g = {
        key: k,
        submissao_id: it.submissao_id,
        produto_codigo: it.produto_codigo,
        produto_nome: it.produto_nome,
        numero_ordem: it.numero_ordem,
        itens: [],
        oldestHours: 0,
        ajustes: 0,
        pendentes: 0,
      };
      map.set(k, g);
    }
    g.itens.push(it);
    if (it.horas_pendentes > g.oldestHours) g.oldestHours = it.horas_pendentes;
    if (it.status === "rejeitado") g.ajustes += 1;
    else g.pendentes += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.oldestHours - a.oldestHours);
}

function urgencyBadge(hours: number, isAjuste: boolean) {
  if (isAjuste) {
    return (
      <Badge variant="destructive" className="text-[10px] h-4 gap-1">
        <AlertTriangle className="h-3 w-3" />
        Ajustar
      </Badge>
    );
  }
  if (hours >= 24) {
    return (
      <Badge className="text-[10px] h-4 gap-1 bg-warning text-warning-foreground">
        <Clock className="h-3 w-3" />
        +24h
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] h-4 gap-1">
      <Clock className="h-3 w-3" />
      {hours}h
    </Badge>
  );
}

export function ChinaInboxTable({
  items, isBrasilUser, isChinaUser, agrupar,
  onApprove, onReject, onView, onCorrigir, onCiencia, loading,
}: Props) {
  const navigate = useNavigate();
  const groups = useMemo(() => buildGroups(items), [items]);

  // Default: expandido se ≤5 docs por grupo
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    buildGroups(items).forEach((g) => { init[g.key] = g.itens.length <= 5; });
    return init;
  });

  const [bulkRejectGroup, setBulkRejectGroup] = useState<Group | null>(null);
  const [singleReject, setSingleReject] = useState<ChinaInboxItem | null>(null);

  // ===== Seleção =====
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSelectionReject, setBulkSelectionReject] = useState(false);

  // Mantém apenas IDs ainda visíveis
  useEffect(() => {
    const visible = new Set(items.map((i) => i.documento_id));
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [items]);

  const toggle = (k: string) => setExpanded((s) => ({ ...s, [k]: !s[k] }));

  const toggleOne = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleGroup = (g: Group, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      g.itens.forEach((it) => {
        if (on) next.add(it.documento_id); else next.delete(it.documento_id);
      });
      return next;
    });
  };
  const toggleAll = (on: boolean) => {
    setSelected(on ? new Set(items.map((i) => i.documento_id)) : new Set());
  };
  const clearSelection = () => setSelected(new Set());

  const groupSelectionState = (g: Group): "none" | "some" | "all" => {
    let count = 0;
    g.itens.forEach((it) => { if (selected.has(it.documento_id)) count += 1; });
    if (count === 0) return "none";
    if (count === g.itens.length) return "all";
    return "some";
  };

  const allState: "none" | "some" | "all" =
    selected.size === 0 ? "none"
      : selected.size === items.length ? "all"
        : "some";

  // Itens selecionados (objetos)
  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.documento_id)),
    [items, selected],
  );
  const selectedAprovaveis = selectedItems.filter((i) => i.status !== "rejeitado");

  // ===== Ações em lote sobre seleção =====
  const handleBulkApprove = () => {
    selectedAprovaveis.forEach((it) => onApprove(it));
    clearSelection();
  };
  const handleBulkCiencia = () => {
    if (!onCiencia) return;
    selectedItems.forEach((it) => onCiencia(it));
    clearSelection();
  };
  const handleBulkRejectConfirm = (motivo: string) => {
    selectedAprovaveis.forEach((it) => onReject(it, motivo));
    setBulkSelectionReject(false);
    clearSelection();
  };

  // ===== Render: barra de ações em lote (sticky no topo da tabela) =====
  const BulkBar = selected.size > 0 ? (
    <div className="sticky top-0 z-20 mb-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 backdrop-blur">
      <span className="text-xs font-medium text-foreground">
        {selected.size} selecionado{selected.size > 1 ? "s" : ""} / 已选 {selected.size}
      </span>
      <span className="text-[11px] text-muted-foreground">
        ({selectedAprovaveis.length} aprovável(is))
      </span>
      <div className="ml-auto flex flex-wrap gap-1.5">
        {isBrasilUser && (
          <>
            <Button
              variant="success" size="sm" className="h-7 text-[11px]"
              disabled={loading || selectedAprovaveis.length === 0}
              onClick={handleBulkApprove}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Aprovar / 批准 ({selectedAprovaveis.length})
            </Button>
            <Button
              variant="outline" size="sm"
              className="h-7 text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={loading || selectedAprovaveis.length === 0}
              onClick={() => setBulkSelectionReject(true)}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Pedir ajuste / 请求修正
            </Button>
          </>
        )}
        {onCiencia && (
          <Button
            variant="outline" size="sm" className="h-7 text-[11px]"
            disabled={loading} onClick={handleBulkCiencia}
            title="Marcar documentos selecionados como vistos"
          >
            <EyeOff className="h-3.5 w-3.5 mr-1" />
            Marcar como visto / 标记已读
          </Button>
        )}
        <Button
          variant="ghost" size="sm" className="h-7 text-[11px]"
          onClick={clearSelection}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Limpar
        </Button>
      </div>
    </div>
  ) : null;

  // ===== Modo achatado (sem agrupamento) =====
  if (!agrupar) {
    return (
      <>
        {BulkBar}
        <Table minWidthClass="min-w-[1000px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[36px]">
                <Checkbox
                  checked={allState === "all" ? true : allState === "some" ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAll(!!v)}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead className="w-[32%]">Documento / 文件</TableHead>
              <TableHead>Produto · OC</TableHead>
              <TableHead className="w-[140px]">Arquivo</TableHead>
              <TableHead className="w-[90px]">Idade</TableHead>
              <TableHead className="w-[260px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => {
              const cfg = CHINA_DOCUMENT_TYPES.find((c) => c.tipo === it.tipo_documento);
              const isAjuste = it.status === "rejeitado";
              const isSel = selected.has(it.documento_id);
              return (
                <TableRow key={it.documento_id} data-state={isSel ? "selected" : undefined}>
                  <TableCell className="py-2">
                    <Checkbox
                      checked={isSel}
                      onCheckedChange={(v) => toggleOne(it.documento_id, !!v)}
                      aria-label="Selecionar documento"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 h-7 w-7 rounded bg-muted flex items-center justify-center text-muted-foreground">
                        {cfg?.icon || <FileText className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">
                          {cfg?.labelPt || it.tipo_documento}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {cfg?.labelCn || ""}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    <div className="truncate max-w-[280px]">
                      <span className="font-medium">{it.produto_codigo}</span>
                      <span className="text-muted-foreground"> · {it.produto_nome}</span>
                    </div>
                    {it.numero_ordem && (
                      <div className="text-[10px] text-muted-foreground">OC {it.numero_ordem}</div>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-[11px] text-muted-foreground truncate max-w-[140px]">
                    {it.nome_arquivo || "—"}
                  </TableCell>
                  <TableCell className="py-2">
                    {urgencyBadge(it.horas_pendentes, isAjuste)}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <div className="inline-flex flex-wrap gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => onView(it)}>
                        <Eye className="h-3.5 w-3.5 mr-1" />Ver
                      </Button>
                      {isBrasilUser && !isAjuste && (
                        <>
                          <Button
                            variant="success" size="sm" className="h-7 text-[11px]"
                            disabled={loading} onClick={() => onApprove(it)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aprovar
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            className="h-7 text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => setSingleReject(it)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />Ajuste
                          </Button>
                        </>
                      )}
                      {isChinaUser && isAjuste && onCorrigir && (
                        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => onCorrigir(it)}>
                          Corrigir
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <ChinaQuickReject
          open={!!singleReject}
          onOpenChange={(o) => !o && setSingleReject(null)}
          loading={loading}
          onConfirm={(motivo) => {
            if (singleReject) onReject(singleReject, motivo);
            setSingleReject(null);
          }}
        />
        <ChinaQuickReject
          open={bulkSelectionReject}
          onOpenChange={(o) => !o && setBulkSelectionReject(false)}
          loading={loading}
          onConfirm={handleBulkRejectConfirm}
        />
      </>
    );
  }

  // ===== Modo agrupado =====
  return (
    <>
      {BulkBar}
      <Table minWidthClass="min-w-[1080px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[36px]">
              <Checkbox
                checked={allState === "all" ? true : allState === "some" ? "indeterminate" : false}
                onCheckedChange={(v) => toggleAll(!!v)}
                aria-label="Selecionar todos"
              />
            </TableHead>
            <TableHead className="w-[28px]"></TableHead>
            <TableHead>Produto / 产品</TableHead>
            <TableHead className="w-[100px]">OC</TableHead>
            <TableHead className="w-[120px]">Documentos</TableHead>
            <TableHead className="w-[90px]">Mais antigo</TableHead>
            <TableHead className="w-[280px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => {
            const isOpen = !!expanded[g.key];
            const aprovaveisDoGrupo = g.itens.filter((i) => i.status !== "rejeitado");
            const groupState = groupSelectionState(g);
            return (
              <Fragment key={g.key}>
                {/* Linha-pai */}
                <TableRow
                  className="bg-muted/20 hover:bg-muted/40 cursor-pointer"
                  onClick={() => toggle(g.key)}
                  data-state={groupState === "all" ? "selected" : undefined}
                >
                  <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={groupState === "all" ? true : groupState === "some" ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleGroup(g, !!v)}
                      aria-label="Selecionar grupo"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">
                          {g.produto_codigo} — {g.produto_nome}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Submissão / 提交 · {g.itens.length} documento(s)
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    {g.numero_ordem ? `OC ${g.numero_ordem}` : "—"}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {g.pendentes > 0 && (
                        <Badge variant="outline" className="text-[10px] h-4 gap-1">
                          <Clock className="h-3 w-3" />
                          {g.pendentes} pendente{g.pendentes > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {g.ajustes > 0 && (
                        <Badge variant="destructive" className="text-[10px] h-4 gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {g.ajustes}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    {urgencyBadge(g.oldestHours, g.ajustes > 0)}
                  </TableCell>
                  <TableCell className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex flex-wrap gap-1 justify-end">
                      {isBrasilUser && aprovaveisDoGrupo.length > 0 && (
                        <>
                          <Button
                            variant="success" size="sm" className="h-7 text-[11px]"
                            disabled={loading}
                            onClick={() => aprovaveisDoGrupo.forEach((it) => onApprove(it))}
                            title={`Aprovar ${aprovaveisDoGrupo.length} documento(s)`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Aprovar todos ({aprovaveisDoGrupo.length})
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            className="h-7 text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => setBulkRejectGroup(g)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Ajuste em todos
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost" size="sm" className="h-7 text-[11px]"
                        onClick={() => navigate(`/dashboard/fabrica-china/submissao/${g.submissao_id}`)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Abrir / 打开
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Filhos */}
                {isOpen && g.itens.map((it) => {
                  const cfg = CHINA_DOCUMENT_TYPES.find((c) => c.tipo === it.tipo_documento);
                  const isAjuste = it.status === "rejeitado";
                  const isSel = selected.has(it.documento_id);
                  return (
                    <TableRow
                      key={it.documento_id}
                      data-state={isSel ? "selected" : undefined}
                      className={cn("border-l-2", isAjuste ? "border-l-destructive" : it.horas_pendentes >= 24 ? "border-l-warning" : "border-l-primary")}
                    >
                      <TableCell className="py-1.5">
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={(v) => toggleOne(it.documento_id, !!v)}
                          aria-label="Selecionar documento"
                        />
                      </TableCell>
                      <TableCell className="py-1.5"></TableCell>
                      <TableCell className="py-1.5 pl-8">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 h-6 w-6 rounded bg-muted flex items-center justify-center text-muted-foreground">
                            {cfg?.icon || <FileText className="h-3 w-3" />}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium truncate">
                              {cfg?.labelPt || it.tipo_documento}
                              <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                {cfg?.labelCn || ""}
                              </span>
                            </div>
                            {it.nome_arquivo && (
                              <div className="text-[10px] text-muted-foreground truncate">
                                📎 {it.nome_arquivo}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5 text-[11px] text-muted-foreground">
                        {it.numero_ordem ? `OC ${it.numero_ordem}` : "—"}
                      </TableCell>
                      <TableCell className="py-1.5"></TableCell>
                      <TableCell className="py-1.5">
                        {urgencyBadge(it.horas_pendentes, isAjuste)}
                      </TableCell>
                      <TableCell className="py-1.5 text-right">
                        <div className="inline-flex flex-wrap gap-1 justify-end">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => onView(it)}>
                            <Eye className="h-3 w-3 mr-0.5" />Ver
                          </Button>
                          {isBrasilUser && !isAjuste && (
                            <>
                              <Button
                                variant="success" size="sm" className="h-6 text-[10px]"
                                disabled={loading} onClick={() => onApprove(it)}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-0.5" />Aprovar
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                className="h-6 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => setSingleReject(it)}
                              >
                                <XCircle className="h-3 w-3 mr-0.5" />Ajuste
                              </Button>
                            </>
                          )}
                          {isChinaUser && isAjuste && onCorrigir && (
                            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => onCorrigir(it)}>
                              Corrigir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      {/* Diálogo de rejeição em lote (por grupo/submissão) */}
      <ChinaQuickReject
        open={!!bulkRejectGroup}
        onOpenChange={(o) => !o && setBulkRejectGroup(null)}
        loading={loading}
        onConfirm={(motivo) => {
          if (bulkRejectGroup) {
            bulkRejectGroup.itens
              .filter((i) => i.status !== "rejeitado")
              .forEach((it) => onReject(it, motivo));
          }
          setBulkRejectGroup(null);
        }}
      />

      {/* Diálogo de rejeição em lote (seleção via checkboxes) */}
      <ChinaQuickReject
        open={bulkSelectionReject}
        onOpenChange={(o) => !o && setBulkSelectionReject(false)}
        loading={loading}
        onConfirm={handleBulkRejectConfirm}
      />

      {/* Diálogo de rejeição individual */}
      <ChinaQuickReject
        open={!!singleReject}
        onOpenChange={(o) => !o && setSingleReject(null)}
        loading={loading}
        onConfirm={(motivo) => {
          if (singleReject) onReject(singleReject, motivo);
          setSingleReject(null);
        }}
      />
    </>
  );
}
