import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Plus, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { NovoProspectDialog } from "@/components/prospects/NovoProspectDialog";
import { ProspectFullModal } from "@/components/kanban/ProspectFullModal";
import { AIInsightsChat } from "@/components/chat/AIInsightsChat";
import { AtribuirProspectsDialog } from "@/components/admin/AtribuirProspectsDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { InfiniteScrollList } from "@/components/common/InfiniteScrollList";
import { debounce } from "@/lib/utils/query-optimizer";
import { useLanguage } from "@/contexts/LanguageContext";

interface Prospect {
  id: string;
  nome_empresa: string;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
  cnpj: string | null;
  endereco: string | null;
  municipio?: string | null;
  uf?: string | null;
  porte_empresa: string | null;
  status: string;
  categoria: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  observacoes: string | null;
  municipio_id: string | null;
  vendedor?: {
    nome: string;
  } | null;
}

const statusKeys: Record<string, string> = {
  novo: "status.novo",
  em_contato: "status.em_contato",
  proposta_enviada: "status.proposta_enviada",
  negociacao: "status.negociacao",
  ganho: "status.ganho",
  perdido: "status.perdido",
};

const statusColors: Record<string, string> = {
  novo: "bg-blue-500",
  em_contato: "bg-yellow-500",
  proposta_enviada: "bg-orange-500",
  negociacao: "bg-purple-500",
  ganho: "bg-green-500",
  perdido: "bg-red-500",
};

const ProspectsOptimized = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>("todos");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { toast } = useToast();
  const { isAdmin, isSupervisor } = useUserRole();
  const { t } = useLanguage();

  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setDebouncedSearch(value), 300),
    []
  );

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    debouncedSetSearch(value);
  };

  const filters = useMemo(() => {
    const f: Record<string, any> = {};
    if (selectedMunicipio !== "todos") f.municipio_id = selectedMunicipio;
    if (selectedStatus !== "todos") f.status = selectedStatus;
    return f;
  }, [selectedMunicipio, selectedStatus]);

  const {
    data: prospects,
    loading,
    hasMore,
    loadMore,
    refresh,
    totalCount,
  } = usePaginatedQuery<Prospect>({
    table: "prospects",
    select: "*, vendedor:profiles!prospects_vendedor_id_fkey(nome)",
    pageSize: 25,
    filters,
    orderBy: { column: "created_at", ascending: false },
  });

  const filteredProspects = useMemo(() => {
    if (!debouncedSearch.trim()) return prospects;
    const search = debouncedSearch.toLowerCase();
    return prospects.filter(
      (p) =>
        p.nome_empresa?.toLowerCase().includes(search) ||
        p.contato_principal?.toLowerCase().includes(search) ||
        p.email?.toLowerCase().includes(search) ||
        p.telefone?.includes(search) ||
        p.cnpj?.includes(search)
    );
  }, [prospects, debouncedSearch]);

  const renderProspectCard = useCallback((prospect: Prospect) => (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => setSelectedProspect(prospect)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{prospect.nome_empresa}</CardTitle>
            {prospect.contato_principal && (
              <CardDescription className="truncate">{prospect.contato_principal}</CardDescription>
            )}
          </div>
          <Badge className={statusColors[prospect.status] || "bg-gray-500"}>
            {t(statusKeys[prospect.status] || prospect.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {prospect.email && (
          <div className="flex items-center gap-2 truncate">
            <span className="text-muted-foreground">{t("label.email")}:</span>
            <span className="truncate">{prospect.email}</span>
          </div>
        )}
        {prospect.telefone && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t("label.phone")}:</span>
            <span>{prospect.telefone}</span>
          </div>
        )}
        {prospect.vendedor && (
          <div className="flex items-center gap-2 truncate">
            <span className="text-muted-foreground">{t("label.seller")}:</span>
            <span className="truncate">{prospect.vendedor.nome}</span>
          </div>
        )}
      </CardContent>
    </Card>
  ), [t]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t("prospects.title")}</h2>
            <p className="text-muted-foreground">
              {totalCount !== null ? `${totalCount} ${t("prospects.registered")}` : `${t("loading")}`}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="gap-2" onClick={() => setChatOpen(true)}>
              <Sparkles className="h-4 w-4" />
              {t("prospects.ai")}
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("prospects.new")}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("prospects.search")}
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder={t("prospects.filter_status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">{t("prospects.all_status")}</SelectItem>
                  {Object.entries(statusKeys).map(([value, key]) => (
                    <SelectItem key={value} value={value}>{t(key)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(isAdmin || isSupervisor) && (
                <Button variant="outline" onClick={refresh}>
                  {t("prospects.update_list")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <InfiniteScrollList
          items={filteredProspects}
          renderItem={renderProspectCard}
          onLoadMore={loadMore}
          loading={loading}
          hasMore={hasMore}
          emptyMessage={t("prospects.none_found")}
          loadingMessage={t("prospects.loading_list")}
        />

        <NovoProspectDialog onSuccess={refresh} />

        <ProspectFullModal
          prospect={selectedProspect}
          open={!!selectedProspect}
          onOpenChange={(open) => !open && setSelectedProspect(null)}
          onUpdate={refresh}
        />

        <AIInsightsChat open={chatOpen} onOpenChange={setChatOpen} />
      </div>
    </DashboardLayout>
  );
};

export default ProspectsOptimized;
