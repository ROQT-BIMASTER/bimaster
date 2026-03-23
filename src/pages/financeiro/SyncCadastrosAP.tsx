import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, AlertTriangle, Loader2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { callApi, fmtDateTime } from "@/lib/utils/api-helpers";

function AlertRow({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-[#DC2626] py-1">
      <AlertTriangle className="h-3.5 w-3.5" />
      {message}
    </div>
  );
}

export default function SyncCadastrosAP() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("fornecedores");
  const [lastSyncForn, setLastSyncForn] = useState<string | null>(null);
  const [lastSyncCat, setLastSyncCat] = useState<string | null>(null);
  const [lastSyncCC, setLastSyncCC] = useState<string | null>(null);

  // Fornecedores
  const { data: fornecedores, isLoading: fornLoading } = useQuery({
    queryKey: ["sync-fornecedores"],
    queryFn: () => callApi("clientes-api", { path: "/listar", pagina: 1, registros_por_pagina: 100 }),
    staleTime: 60_000,
  });

  // Categorias
  const { data: categorias, isLoading: catLoading } = useQuery({
    queryKey: ["sync-categorias"],
    queryFn: () => callApi("categorias-api", { path: "/listar" }),
    staleTime: 60_000,
  });

  // Contas Correntes
  const { data: contasCC, isLoading: ccLoading } = useQuery({
    queryKey: ["sync-contas-correntes"],
    queryFn: () => callApi("contas-correntes-api", { path: "/resumo" }),
    staleTime: 60_000,
  });

  // Parcelas (Condições)
  const { data: parcelas, isLoading: parcLoading } = useQuery({
    queryKey: ["sync-parcelas"],
    queryFn: () => callApi("parcelas-api", { path: "/listar" }),
    staleTime: 60_000,
  });

  // Sync mutations - fetch from ERP then refresh
  const syncFornMutation = useMutation({
    mutationFn: () => callApi("clientes-api", { path: "/sync", lote: true }),
    onSuccess: () => {
      toast.success("Fornecedores sincronizados do ERP");
      setLastSyncForn(new Date().toISOString());
      qc.invalidateQueries({ queryKey: ["sync-fornecedores"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao sincronizar fornecedores"),
  });

  const syncCCMutation = useMutation({
    mutationFn: async () => {
      // First fetch current data from ERP, then upsert
      const erpData = await callApi("contas-correntes-api", { path: "/listar-erp" });
      const contas = erpData?.data || erpData?.contas || [];
      if (contas.length === 0) {
        toast.info("Nenhuma conta corrente retornada do ERP");
        return;
      }
      return callApi("contas-correntes-api", { path: "/upsert-lote", lote: 1, fin_conta_corrente_cadastro: contas });
    },
    onSuccess: () => {
      toast.success("Contas correntes sincronizadas");
      setLastSyncCC(new Date().toISOString());
      qc.invalidateQueries({ queryKey: ["sync-contas-correntes"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao sincronizar contas correntes"),
  });

  const syncCatMutation = useMutation({
    mutationFn: async () => {
      // Fetch categories from ERP and sync
      const erpData = await callApi("categorias-api", { path: "/sync" });
      return erpData;
    },
    onSuccess: () => {
      toast.success("Categorias sincronizadas do ERP");
      setLastSyncCat(new Date().toISOString());
      qc.invalidateQueries({ queryKey: ["sync-categorias"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao sincronizar categorias"),
  });

  function renderSkeleton() {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  function LastSyncIndicator({ timestamp }: { timestamp: string | null }) {
    if (!timestamp) return null;
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Última sincronização: {fmtDateTime(timestamp)}
      </span>
    );
  }

  const fornList = fornecedores?.clientes_cadastro || fornecedores?.data || [];
  const catList = categorias?.data || categorias?.categorias || [];
  const ccList = contasCC?.data || contasCC?.contas || [];
  const parcList = parcelas?.data || parcelas?.parcelas || [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-[#1B2A4A]">Sync Cadastros Auxiliares AP</h1>
            <p className="text-sm text-muted-foreground">Sincronize fornecedores, categorias e contas correntes com o ERP</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="contas">Contas Correntes</TabsTrigger>
            <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
          </TabsList>

          {/* Fornecedores */}
          <TabsContent value="fornecedores" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{fornList.length} registros</span>
                <LastSyncIndicator timestamp={lastSyncForn} />
              </div>
              <Button size="sm" onClick={() => syncFornMutation.mutate()} disabled={syncFornMutation.isPending}>
                {syncFornMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                Sincronizar do ERP
              </Button>
            </div>
            {fornLoading ? renderSkeleton() : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB]">
                      <TableHead>Código Huggs</TableHead>
                      <TableHead>Cód. Integração</TableHead>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fornList.map((f: any, i: number) => (
                      <TableRow key={f.id || i} className={i % 2 ? "bg-[#F9FAFB]" : ""}>
                        <TableCell className="text-xs font-mono">{f.codigo_cliente_huggs || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {f.codigo_cliente_integracao || (
                            <span className="text-[#DC2626] flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Sem integração
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{f.razao_social || f.nome || "—"}</TableCell>
                        <TableCell className="text-xs">{f.cnpj_cpf || "—"}</TableCell>
                        <TableCell>
                          <Badge className={f.inativo === "S" ? "bg-gray-100 text-gray-700 text-xs" : "bg-green-100 text-green-800 text-xs"}>
                            {f.inativo === "S" ? "Inativo" : "Ativo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Categorias */}
          <TabsContent value="categorias" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{catList.length} registros</span>
                <LastSyncIndicator timestamp={lastSyncCat} />
              </div>
              <Button size="sm" onClick={() => syncCatMutation.mutate()} disabled={syncCatMutation.isPending}>
                {syncCatMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                Sincronizar do ERP
              </Button>
            </div>
            {catLoading ? renderSkeleton() : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB]">
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Grupo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catList.map((c: any, i: number) => (
                      <TableRow key={c.id || c.codigo || i} className={i % 2 ? "bg-[#F9FAFB]" : ""}>
                        <TableCell className="text-xs font-mono">{c.codigo || "—"}</TableCell>
                        <TableCell>{c.descricao || c.nome || "—"}</TableCell>
                        <TableCell className="text-xs">{c.tipo || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {c.codigo_grupo || (
                            <span className="text-[#EA580C] flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Sem grupo
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Contas Correntes */}
          <TabsContent value="contas" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{ccList.length} registros</span>
                <LastSyncIndicator timestamp={lastSyncCC} />
              </div>
              <Button size="sm" onClick={() => syncCCMutation.mutate()} disabled={syncCCMutation.isPending}>
                {syncCCMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                Sincronizar Lote
              </Button>
            </div>
            {ccLoading ? renderSkeleton() : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB]">
                      <TableHead>Cód. Int.</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Saldo Inicial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ccList.map((c: any, i: number) => (
                      <TableRow key={c.id || i} className={i % 2 ? "bg-[#F9FAFB]" : ""}>
                        <TableCell className="text-xs font-mono">
                          {c.cCodCCInt || (
                            <span className="text-[#DC2626] flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Sem cód.
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{c.cDescricao || c.descricao || "—"}</TableCell>
                        <TableCell className="text-xs">{c.cBanco || "—"}</TableCell>
                        <TableCell className="text-xs">{c.cTipo || "—"}</TableCell>
                        <TableCell className="text-xs">{c.nSaldoInicial != null ? `R$ ${Number(c.nSaldoInicial).toLocaleString("pt-BR")}` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Parcelas */}
          <TabsContent value="parcelas" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{parcList.length} registros</span>
            </div>
            {parcLoading ? renderSkeleton() : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB]">
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>N° Parcelas</TableHead>
                      <TableHead>Intervalo (dias)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcList.map((p: any, i: number) => (
                      <TableRow key={p.id || i} className={i % 2 ? "bg-[#F9FAFB]" : ""}>
                        <TableCell className="text-xs font-mono">{p.codigo || p.nCodParc || "—"}</TableCell>
                        <TableCell>{p.descricao || p.cDescricao || "—"}</TableCell>
                        <TableCell className="text-xs">{p.num_parcelas || p.nQtdeParc || "—"}</TableCell>
                        <TableCell className="text-xs">{p.intervalo_dias || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
