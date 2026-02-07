import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  MapPin,
  Users,
  TrendingUp,
  Phone,
  Mail,
  Eye,
  Building2,
  DollarSign,
  Calendar,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WhitespaceRow } from "@/hooks/useWhitespaceAnalysis";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  row: WhitespaceRow | null;
  open: boolean;
  onClose: () => void;
  onOpenCliente360: (clienteCodigo: string) => void;
}

interface ClienteVizinho {
  codigo: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  data_ultima_compra: string | null;
  valor_ultima_compra: number | null;
  status_bloqueio: string | null;
}

const formatNumber = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

const formatCurrency = (n: number) => {
  if (n >= 1e9) return `R$ ${(n / 1e9).toFixed(1)} bi`;
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1)} mi`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toFixed(0)} mil`;
  return `R$ ${n.toFixed(0)}`;
};

export function WhitespaceMunicipioSheet({ row, open, onClose, onOpenCliente360 }: Props) {
  const clientesQuery = useQuery({
    queryKey: ["whitespace-clientes-vizinhos", row?.microrregiao_id],
    queryFn: async (): Promise<ClienteVizinho[]> => {
      if (!row?.microrregiao_id) return [];

      const { data, error } = await supabase
        .from("clientes")
        .select(
          "codigo, nome, cidade, uf, telefone, celular, email, data_ultima_compra, valor_ultima_compra, status_bloqueio, ibge_municipio_id"
        )
        .not("ibge_municipio_id", "is", null)
        .order("data_ultima_compra", { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Filter by microrregiao via a second query on ibge_municipios
      const { data: municipioIds, error: mError } = await supabase
        .from("ibge_municipios")
        .select("id")
        .eq("microrregiao_id", row.microrregiao_id);

      if (mError) throw mError;

      const idSet = new Set((municipioIds || []).map((m) => m.id));
      return (data || []).filter((c) => c.ibge_municipio_id && idSet.has(c.ibge_municipio_id)) as ClienteVizinho[];
    },
    enabled: open && !!row?.microrregiao_id,
    staleTime: 5 * 60 * 1000,
  });

  if (!row) return null;

  const penetracao = Number(row.penetracao_micro);
  const score = Math.round(Number(row.score_expansao));
  const clientes = clientesQuery.data || [];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {row.municipio_nome} — {row.uf}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 space-y-6">
            {/* Municipality header stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Users} label="População" value={formatNumber(Number(row.populacao))} />
              <StatCard icon={DollarSign} label="PIB/Capita" value={`R$ ${formatNumber(Math.round(Number(row.pib_per_capita)))}`} />
              <StatCard icon={Building2} label="Microrregião" value={row.microrregiao_nome} small />
              <StatCard icon={TrendingUp} label="Score Expansão" value={formatNumber(score)} highlight />
            </div>

            {/* Microrregião context */}
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Contexto da Microrregião</h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Penetração</span>
                <Badge
                  variant="default"
                  className={
                    penetracao >= 70
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : penetracao >= 40
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }
                >
                  {penetracao}%
                </Badge>
              </div>
              <Progress value={penetracao} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Number(row.municipios_ativos_micro)} ativos de {Number(row.total_municipios_micro)} municípios</span>
                <span>Receita micro: {formatCurrency(Number(row.receita_micro))}</span>
              </div>
              {row.vendedor_nome && (
                <p className="text-xs text-muted-foreground">
                  Vendedor no território: <span className="font-medium text-foreground">{row.vendedor_nome}</span>
                </p>
              )}
            </div>

            {/* Score explanation */}
            <div className="rounded-lg border bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Por que este Score?</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Score = PIB per Capita × Penetração da Micro.
                Este município tem PIB/capita de <strong>R$ {formatNumber(Math.round(Number(row.pib_per_capita)))}</strong> e a microrregião já tem <strong>{penetracao}%</strong> de penetração ({Number(row.municipios_ativos_micro)}/{Number(row.total_municipios_micro)} municípios ativos), indicando logística existente e mercado validado.
              </p>
            </div>

            {/* Neighboring clients */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Clientes Vizinhos na Microrregião
                </h3>
                {!clientesQuery.isLoading && (
                  <Badge variant="secondary">{clientes.length} clientes</Badge>
                )}
              </div>

              {clientesQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : clientes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum cliente ativo encontrado nesta microrregião.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Cliente</TableHead>
                        <TableHead className="text-xs">Cidade</TableHead>
                        <TableHead className="text-xs">Contato</TableHead>
                        <TableHead className="text-xs text-right">Última Compra</TableHead>
                        <TableHead className="text-xs w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientes.map((c) => (
                        <TableRow key={c.codigo}>
                          <TableCell className="text-xs">
                            <div>
                              <p className="font-medium truncate max-w-[160px]" title={c.nome}>{c.nome}</p>
                              {c.status_bloqueio && c.status_bloqueio !== "N" && (
                                <Badge variant="destructive" className="text-[10px] mt-0.5">Bloqueado</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {c.cidade || "—"}{c.uf ? `/${c.uf}` : ""}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1.5">
                              {(c.telefone || c.celular) && (
                                <a
                                  href={`tel:${c.celular || c.telefone}`}
                                  className="text-primary hover:text-primary/80"
                                  title={c.celular || c.telefone || ""}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {c.email && (
                                <a
                                  href={`mailto:${c.email}`}
                                  className="text-primary hover:text-primary/80"
                                  title={c.email}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {c.data_ultima_compra ? (
                              <div>
                                <p>{format(new Date(c.data_ultima_compra), "dd/MM/yy", { locale: ptBR })}</p>
                                {c.valor_ultima_compra != null && (
                                  <p className="text-muted-foreground">
                                    R$ {formatNumber(Math.round(c.valor_ultima_compra))}
                                  </p>
                                )}
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Ver 360°"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCliente360(c.codigo);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
  small,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-1 ${highlight ? "bg-primary/5 border-primary/20" : ""}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={`font-semibold ${small ? "text-xs" : "text-sm"} ${highlight ? "text-primary" : ""} truncate`} title={value}>
        {value}
      </p>
    </div>
  );
}
