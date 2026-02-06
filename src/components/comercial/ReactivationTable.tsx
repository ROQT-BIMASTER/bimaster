import { useState, useMemo, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Users, Phone, Smartphone } from "lucide-react";
import type { ClienteReativacao, RiskLevel } from "@/hooks/useClienteReativacao";
import { ClienteDetailSheet } from "./ClienteDetailSheet";
import { BulkActionsBar } from "./BulkActionsBar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import React from "react";

const riskBadgeConfig: Record<RiskLevel, { label: string; className: string }> = {
  atencao: { label: "Atenção", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300 dark:border-amber-700" },
  alerta: { label: "Alerta", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-orange-300 dark:border-orange-700" },
  critico: { label: "Crítico", className: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300 dark:border-red-700" },
  inativo: { label: "Inativo", className: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300 border-gray-300 dark:border-gray-700" },
};

interface Props {
  clientes: ClienteReativacao[];
  filterRisco?: RiskLevel | null;
  filterUF?: string | null;
  filterDiasRange?: { min: number; max: number } | null;
}

export const ReactivationTable = React.forwardRef<HTMLDivElement, Props>(
  ({ clientes, filterRisco, filterUF: externalFilterUF, filterDiasRange }, ref) => {
    const [busca, setBusca] = useState("");
    const [filtroUF, setFiltroUF] = useState<string>("todos");
    const [filtroRiscoLocal, setFiltroRiscoLocal] = useState<string>("todos");
    const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
    const [clienteAberto, setClienteAberto] = useState<ClienteReativacao | null>(null);

    const ufs = useMemo(() => {
      const set = new Set(clientes.map((c) => c.uf).filter(Boolean) as string[]);
      return Array.from(set).sort();
    }, [clientes]);

    const riscoAtivo = filterRisco || (filtroRiscoLocal !== "todos" ? (filtroRiscoLocal as RiskLevel) : null);
    const ufAtivo = externalFilterUF || (filtroUF !== "todos" ? filtroUF : null);

    const filtrados = useMemo(() => {
      return clientes.filter((c) => {
        if (riscoAtivo && c.nivel_risco !== riscoAtivo) return false;
        if (ufAtivo && c.uf !== ufAtivo) return false;
        if (filterDiasRange) {
          if (c.dias_sem_compra < filterDiasRange.min || c.dias_sem_compra > filterDiasRange.max) return false;
        }
        if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
        return true;
      });
    }, [clientes, riscoAtivo, ufAtivo, filterDiasRange, busca]);

    const formatCurrency = (v: number | null) =>
      v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

    const formatDate = (d: string | null) => {
      if (!d) return "—";
      try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
    };

    const toggleAll = () => {
      const visibleIds = filtrados.slice(0, 100).map((c) => c.id);
      const allSelected = visibleIds.every((id) => selecionados.has(id));
      if (allSelected) {
        setSelecionados(new Set());
      } else {
        setSelecionados(new Set(visibleIds));
      }
    };

    const toggleOne = (id: string) => {
      setSelecionados((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const clientesSelecionados = clientes.filter((c) => selecionados.has(c.id));
    const allVisibleSelected = filtrados.slice(0, 100).length > 0 && filtrados.slice(0, 100).every((c) => selecionados.has(c.id));

    return (
      <>
        <Card ref={ref}>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Top Clientes para Ação Imediata
                <Badge variant="secondary" className="ml-2">{filtrados.length}</Badge>
                {(externalFilterUF || filterDiasRange) && (
                  <span className="text-xs text-muted-foreground font-normal">
                    (filtro via gráfico ativo)
                  </span>
                )}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-8 h-9 w-[200px]"
                  />
                </div>
                {!filterRisco && (
                  <Select value={filtroRiscoLocal} onValueChange={setFiltroRiscoLocal}>
                    <SelectTrigger className="h-9 w-[140px]">
                      <SelectValue placeholder="Nível de risco" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os níveis</SelectItem>
                      <SelectItem value="atencao">Atenção</SelectItem>
                      <SelectItem value="alerta">Alerta</SelectItem>
                      <SelectItem value="critico">Crítico</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {!externalFilterUF && (
                  <Select value={filtroUF} onValueChange={setFiltroUF}>
                    <SelectTrigger className="h-9 w-[100px]">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas UF</SelectItem>
                      {ufs.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead className="text-center">Dias s/ Compra</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Valor Última</TableHead>
                    <TableHead className="text-right">Maior Compra</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.slice(0, 100).map((c) => {
                    const badge = riskBadgeConfig[c.nivel_risco];
                    const isSelected = selecionados.has(c.id);
                    const isBloqueado = c.status_bloqueio && c.status_bloqueio.toLowerCase() !== "ativo" && c.status_bloqueio.toLowerCase() !== "normal" && c.status_bloqueio !== "";
                    const contactPhone = c.celular || c.telefone;

                    return (
                      <TableRow
                        key={c.id}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setClienteAberto(c)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(c.id)}
                            aria-label={`Selecionar ${c.nome}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium max-w-[180px] truncate" title={c.nome}>
                          {c.nome}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {[c.cidade, c.uf].filter(Boolean).join("/") || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={badge.className}>
                            {c.dias_sem_compra}d — {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {contactPhone ? (
                            <a
                              href={`tel:${contactPhone.replace(/\D/g, "")}`}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              title={contactPhone}
                            >
                              {c.celular ? <Smartphone className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                              <span className="max-w-[100px] truncate">{contactPhone}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(c.valor_ultima_compra)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(c.valor_maior_compra)}</TableCell>
                        <TableCell>
                          {isBloqueado ? (
                            <Badge variant="destructive" className="text-xs">Bloq.</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">Ativo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum cliente encontrado com os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filtrados.length > 100 && (
              <div className="text-center text-xs text-muted-foreground py-2 border-t">
                Exibindo 100 de {filtrados.length} clientes. Use os filtros para refinar.
              </div>
            )}
          </CardContent>
        </Card>

        <BulkActionsBar
          selecionados={clientesSelecionados}
          onClearSelection={() => setSelecionados(new Set())}
        />

        <ClienteDetailSheet
          cliente={clienteAberto}
          open={!!clienteAberto}
          onOpenChange={(open) => !open && setClienteAberto(null)}
        />
      </>
    );
  }
);

ReactivationTable.displayName = "ReactivationTable";
