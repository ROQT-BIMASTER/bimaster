import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";
import type { ClienteReativacao, RiskLevel } from "@/hooks/useClienteReativacao";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const riskBadgeConfig: Record<RiskLevel, { label: string; className: string }> = {
  atencao: { label: "Atenção", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300 dark:border-amber-700" },
  alerta: { label: "Alerta", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-orange-300 dark:border-orange-700" },
  critico: { label: "Crítico", className: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300 dark:border-red-700" },
  inativo: { label: "Inativo", className: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300 border-gray-300 dark:border-gray-700" },
};

interface Props {
  clientes: ClienteReativacao[];
  filterRisco?: RiskLevel | null;
}

export function ReactivationTable({ clientes, filterRisco }: Props) {
  const [busca, setBusca] = useState("");
  const [filtroUF, setFiltroUF] = useState<string>("todos");
  const [filtroRiscoLocal, setFiltroRiscoLocal] = useState<string>("todos");

  const ufs = useMemo(() => {
    const set = new Set(clientes.map((c) => c.uf).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [clientes]);

  const riscoAtivo = filterRisco || (filtroRiscoLocal !== "todos" ? (filtroRiscoLocal as RiskLevel) : null);

  const filtrados = useMemo(() => {
    return clientes.filter((c) => {
      if (riscoAtivo && c.nivel_risco !== riscoAtivo) return false;
      if (filtroUF !== "todos" && c.uf !== filtroUF) return false;
      if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [clientes, riscoAtivo, filtroUF, busca]);

  const formatCurrency = (v: number | null) =>
    v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return format(new Date(d), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return d;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Top Clientes para Ação Imediata
            <Badge variant="secondary" className="ml-2">{filtrados.length}</Badge>
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Cliente</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>UF</TableHead>
                <TableHead className="text-center">Dias s/ Compra</TableHead>
                <TableHead>Última Compra</TableHead>
                <TableHead className="text-right">Valor Última</TableHead>
                <TableHead className="text-right">Limite Crédito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.slice(0, 100).map((c) => {
                const badge = riskBadgeConfig[c.nivel_risco];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium max-w-[200px] truncate" title={c.nome}>
                      {c.nome}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.cidade || "—"}</TableCell>
                    <TableCell>{c.uf || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={badge.className}>
                        {c.dias_sem_compra}d — {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(c.data_ultima_compra)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(c.valor_ultima_compra)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(c.limite_credito)}</TableCell>
                  </TableRow>
                );
              })}
              {filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
  );
}
