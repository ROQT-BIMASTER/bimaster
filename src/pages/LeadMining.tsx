import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import {
  Search,
  Pickaxe,
  Star,
  Globe,
  Phone,
  MapPin,
  ExternalLink,
  Copy,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  MoreHorizontal,
  Users,
  Loader2,
  Eye,
  UserPlus,
  Filter,
  TrendingUp,
  Sparkles,
  Ban,
} from "lucide-react";
import { useLeadMining, LeadMinerado } from "@/hooks/useLeadMining";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  novo: { label: "Novo", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", icon: Sparkles },
  qualificado: { label: "Qualificado", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300", icon: CheckCircle },
  descartado: { label: "Descartado", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300", icon: XCircle },
  convertido: { label: "Convertido", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300", icon: UserPlus },
};

const LeadMining = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUF, setSelectedUF] = useState<string>("");
  const [selectedCidade, setSelectedCidade] = useState<string>("");
  const [maxResults, setMaxResults] = useState<number>(60);
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterRating, setFilterRating] = useState<number>(0);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [detailLead, setDetailLead] = useState<LeadMinerado | null>(null);

  const filters = useMemo(() => ({
    status: filterStatus,
    ratingMinimo: filterRating,
  }), [filterStatus, filterRating]);

  const {
    leads,
    isLoading,
    stats,
    isMining,
    miningProgress,
    mine,
    updateStatus,
    convertToProspect,
    isConverting,
  } = useLeadMining(filters);

  // Load IBGE states
  const estadosQuery = useQuery({
    queryKey: ["ibge-estados-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ibge_estados")
        .select("sigla, nome")
        .order("nome")
        .returns<Array<{ sigla: string; nome: string }>>();
      return data || [];
    },
  });
  const estados = estadosQuery.data || [];

  // Load IBGE cities filtered by state
  const cidadesQuery = useQuery<Array<{ nome: string }>>({
    queryKey: ["ibge-cidades-select", selectedUF],
    queryFn: async (): Promise<Array<{ nome: string }>> => {
      if (!selectedUF) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (supabase as any).from("ibge_municipios").select("nome").eq("uf", selectedUF).order("nome");
      return res.data || [];
    },
    enabled: !!selectedUF,
  });
  const cidades = cidadesQuery.data || [];

  const handleMine = async () => {
    if (!searchQuery.trim()) {
      toast({ title: "Informe o que deseja buscar", variant: "destructive" });
      return;
    }
    await mine({
      query: searchQuery,
      cidade: selectedCidade || undefined,
      uf: selectedUF || undefined,
      maxResults,
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(new Set(leads.map((l) => l.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleSelectLead = (id: string, checked: boolean) => {
    const next = new Set(selectedLeads);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedLeads(next);
  };

  const handleBulkAction = async (action: string) => {
    const ids = Array.from(selectedLeads);
    if (ids.length === 0) return;

    if (action === "converter") {
      await convertToProspect(ids);
    } else {
      await updateStatus({ ids, status: action });
    }
    setSelectedLeads(new Set());
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast({ title: "Telefone copiado!" });
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground text-xs">N/A</span>;
    return (
      <div className="flex items-center gap-1">
        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
        <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Pickaxe className="h-8 w-8 text-primary" />
            Mineração de Leads
          </h1>
          <p className="text-muted-foreground mt-1">
            Encontre novos clientes potenciais usando o Google Places
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total Minerados", value: stats?.total || 0, color: "border-l-blue-500" },
            { label: "Novos", value: stats?.novos || 0, color: "border-l-sky-500" },
            { label: "Qualificados", value: stats?.qualificados || 0, color: "border-l-green-500" },
            { label: "Convertidos", value: stats?.convertidos || 0, color: "border-l-purple-500" },
            { label: "Descartados", value: stats?.descartados || 0, color: "border-l-red-500" },
          ].map((stat) => (
            <Card key={stat.label} className={`border-l-4 ${stat.color}`}>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search Area */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Label>O que buscar</Label>
                <Input
                  placeholder="Ex: supermercados, distribuidora de alimentos, padarias..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleMine()}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={selectedUF} onValueChange={(v) => { setSelectedUF(v); setSelectedCidade(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {estados.map((e) => (
                      <SelectItem key={e.sigla} value={e.sigla}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cidade</Label>
                <Select value={selectedCidade} onValueChange={setSelectedCidade} disabled={!selectedUF}>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedUF ? "Selecione" : "Selecione o estado"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {cidades.map((c) => (
                      <SelectItem key={c.nome} value={c.nome}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-end gap-4 mt-4">
              <div className="flex-1 max-w-xs">
                <Label>Máximo de resultados: {maxResults}</Label>
                <Slider
                  value={[maxResults]}
                  onValueChange={([v]) => setMaxResults(v)}
                  min={20}
                  max={200}
                  step={20}
                  className="mt-2"
                />
              </div>
              <Button
                onClick={handleMine}
                disabled={isMining || !searchQuery.trim()}
                className="gap-2"
                size="lg"
              >
                {isMining ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Minerando...
                  </>
                ) : (
                  <>
                    <Pickaxe className="h-4 w-4" />
                    Minerar Leads
                  </>
                )}
              </Button>
            </div>
            {miningProgress && (
              <p className="text-sm text-muted-foreground mt-2 animate-pulse">
                {miningProgress}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Filters & Bulk Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="novo">Novos</SelectItem>
                <SelectItem value="qualificado">Qualificados</SelectItem>
                <SelectItem value="descartado">Descartados</SelectItem>
                <SelectItem value="convertido">Convertidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <Select value={String(filterRating)} onValueChange={(v) => setFilterRating(Number(v))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Qualquer rating</SelectItem>
                <SelectItem value="3">3+ estrelas</SelectItem>
                <SelectItem value="4">4+ estrelas</SelectItem>
                <SelectItem value="4.5">4.5+ estrelas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedLeads.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="secondary">{selectedLeads.size} selecionado(s)</Badge>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("qualificado")}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Qualificar
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("descartado")}>
                <Ban className="h-3.5 w-3.5 mr-1" /> Descartar
              </Button>
              <Button
                size="sm"
                onClick={() => handleBulkAction("converter")}
                disabled={isConverting}
              >
                {isConverting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                )}
                Converter em Prospect
              </Button>
            </div>
          )}
        </div>

        {/* Leads Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={leads.length > 0 && selectedLeads.size === leads.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Avaliações</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <Pickaxe className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>Nenhum lead minerado ainda.</p>
                      <p className="text-xs">Use a busca acima para encontrar novos leads.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => {
                    const sc = statusConfig[lead.status] || statusConfig.novo;
                    return (
                      <TableRow key={lead.id} className="group">
                        <TableCell>
                          <Checkbox
                            checked={selectedLeads.has(lead.id)}
                            onCheckedChange={(c) => handleSelectLead(lead.id, !!c)}
                          />
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {lead.nome}
                        </TableCell>
                        <TableCell>
                          {lead.telefone ? (
                            <button
                              onClick={() => copyPhone(lead.telefone!)}
                              className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
                              title="Copiar telefone"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {lead.telefone}
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.cidade && lead.uf ? (
                            <span className="text-sm">{lead.cidade}/{lead.uf}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>{renderStars(lead.rating)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {lead.total_avaliacoes > 0 ? lead.total_avaliacoes : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {lead.website ? (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <Globe className="h-3.5 w-3.5" />
                              Site
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${sc.color} text-xs`} variant="secondary">
                            {sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailLead(lead)}>
                                <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                              </DropdownMenuItem>
                              {lead.telefone && (
                                <DropdownMenuItem onClick={() => copyPhone(lead.telefone!)}>
                                  <Copy className="h-4 w-4 mr-2" /> Copiar telefone
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {lead.status !== "qualificado" && (
                                <DropdownMenuItem onClick={() => updateStatus({ ids: [lead.id], status: "qualificado" })}>
                                  <CheckCircle className="h-4 w-4 mr-2" /> Qualificar
                                </DropdownMenuItem>
                              )}
                              {lead.status !== "descartado" && (
                                <DropdownMenuItem onClick={() => updateStatus({ ids: [lead.id], status: "descartado" })}>
                                  <Ban className="h-4 w-4 mr-2" /> Descartar
                                </DropdownMenuItem>
                              )}
                              {lead.status !== "convertido" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => convertToProspect([lead.id])}>
                                    <UserPlus className="h-4 w-4 mr-2" /> Converter em Prospect
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!detailLead} onOpenChange={() => setDetailLead(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{detailLead?.nome}</DialogTitle>
            </DialogHeader>
            {detailLead && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Telefone</Label>
                    <p className="font-medium">{detailLead.telefone || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tel. Internacional</Label>
                    <p className="font-medium">{detailLead.telefone_internacional || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Endereço</Label>
                    <p className="font-medium">{detailLead.endereco || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cidade</Label>
                    <p className="font-medium">{detailLead.cidade || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">UF</Label>
                    <p className="font-medium">{detailLead.uf || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">CEP</Label>
                    <p className="font-medium">{detailLead.cep || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Rating</Label>
                    <div className="flex items-center gap-1">
                      {renderStars(detailLead.rating)}
                      <span className="text-muted-foreground ml-1">
                        ({detailLead.total_avaliacoes} avaliações)
                      </span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Website</Label>
                    {detailLead.website ? (
                      <a
                        href={detailLead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {detailLead.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p>—</p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Tipos</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {detailLead.tipos?.length > 0
                        ? detailLead.tipos.map((t) => (
                            <Badge key={t} variant="outline" className="text-xs">
                              {t}
                            </Badge>
                          ))
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">CNPJ</Label>
                    <p className="font-medium">{detailLead.cnpj || "Não informado"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Busca</Label>
                    <p className="font-medium text-xs">{detailLead.busca_query} — {detailLead.busca_regiao}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {detailLead.status !== "convertido" && (
                    <Button
                      onClick={() => {
                        convertToProspect([detailLead.id]);
                        setDetailLead(null);
                      }}
                      className="flex-1"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Converter em Prospect
                    </Button>
                  )}
                  {detailLead.telefone && (
                    <Button
                      variant="outline"
                      onClick={() => copyPhone(detailLead.telefone!)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Telefone
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default LeadMining;
