import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { callExportApi, fmtDateTime, formatBRL } from "@/lib/utils/api-helpers";

const ENDPOINTS = [
  { fn: "contas-pagar-api", method: "GET", path: "/listar", auth: "JWT/Key", desc: "Listagem paginada" },
  { fn: "contas-pagar-api", method: "GET", path: "/consultar", auth: "JWT/Key", desc: "Consultar por ID" },
  { fn: "contas-pagar-api", method: "POST", path: "/incluir", auth: "JWT/Key", desc: "Incluir título" },
  { fn: "contas-pagar-api", method: "PUT", path: "/alterar", auth: "JWT/Key", desc: "Alterar título" },
  { fn: "contas-pagar-api", method: "DELETE", path: "/excluir", auth: "JWT/Key", desc: "Excluir título" },
  { fn: "contas-pagar-api", method: "POST", path: "/upsert", auth: "JWT/Key", desc: "Upsert unitário" },
  { fn: "contas-pagar-api", method: "POST", path: "/upsert-lote", auth: "JWT/Key", desc: "Upsert lote" },
  { fn: "contas-pagar-api", method: "POST", path: "/registrar-pagamento", auth: "JWT/Key", desc: "Registrar baixa" },
  { fn: "contas-pagar-api", method: "POST", path: "/lancar-pagamento", auth: "JWT/Key", desc: "Lançar pagamento" },
  { fn: "contas-pagar-api", method: "POST", path: "/cancelar-pagamento", auth: "JWT/Key", desc: "Cancelar baixa" },
  { fn: "contas-pagar-api", method: "POST", path: "/cancelar", auth: "JWT/Key", desc: "Cancelar título" },
  { fn: "contas-pagar-api", method: "POST", path: "/estornar", auth: "JWT/Key", desc: "Estornar pagamento" },
  { fn: "contas-pagar-api", method: "GET", path: "/parcelas", auth: "JWT/Key", desc: "Listar parcelas" },
  { fn: "contas-pagar-api", method: "GET", path: "/pagamentos", auth: "JWT/Key", desc: "Histórico pagamentos" },
  { fn: "contas-pagar-api", method: "GET", path: "/anexos", auth: "JWT/Key", desc: "Comprovantes" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/status", auth: "JWT/Key", desc: "Status fila" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/pending", auth: "JWT/Key", desc: "Pendentes provisão" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/paid", auth: "JWT/Key", desc: "Pendentes baixa" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/cancelled", auth: "JWT/Key", desc: "Cancelados" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/history", auth: "JWT/Key", desc: "Histórico exportação" },
  { fn: "contas-pagar-export-api", method: "POST", path: "/confirm", auth: "JWT/Key", desc: "Confirmar exportação" },
  { fn: "contas-pagar-export-api", method: "POST", path: "/export-batch", auth: "JWT/Key", desc: "Exportar lote" },
  { fn: "contas-pagar-export-api", method: "POST", path: "/retry-failed", auth: "JWT/Key", desc: "Reprocessar erros" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/reconciliation", auth: "JWT/Key", desc: "Reconciliação" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/export-summary", auth: "JWT/Key", desc: "Resumo exportação" },
  { fn: "erp-export-payment", method: "POST", path: "/", auth: "JWT", desc: "Exportar pagamento" },
  { fn: "erp-webhook-inbound", method: "POST", path: "/", auth: "API Key", desc: "Webhook inbound ERP" },
];

export default function RelatorioAPxERP() {
  const navigate = useNavigate();
  const [logOpen, setLogOpen] = useState(true);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["ap-export-summary"],
    queryFn: () => callExportApi("/export-summary"),
    staleTime: 60_000,
  });

  const { data: reconc, isLoading: reconcLoading } = useQuery({
    queryKey: ["ap-reconciliation"],
    queryFn: () => callExportApi("/reconciliation"),
    staleTime: 60_000,
  });

  const { data: syncLog, isLoading: logLoading } = useQuery({
    queryKey: ["erp-sync-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_sync_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return data as any[];
    },
    staleTime: 30_000,
  });

  const resumo = reconc?.resumo || {};
  const summaryData = summary || {};

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6 print:p-2">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-[#1B2A4A]">Relatório AP x ERP</h1>
              <p className="text-sm text-muted-foreground">Diagnóstico técnico de integração</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </div>

        {/* Reconciliation KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              {reconcLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold text-[#2563EB]">{resumo.total_titulos ?? "—"}</div>
              )}
              <p className="text-xs text-muted-foreground">Total Títulos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              {reconcLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold text-[#16A34A]">{resumo.exportados ?? "—"}</div>
              )}
              <p className="text-xs text-muted-foreground">Exportados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              {reconcLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold text-[#DC2626]">{resumo.com_erro ?? "—"}</div>
              )}
              <p className="text-xs text-muted-foreground">Com Erro</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              {reconcLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold text-[#1B2A4A]">{resumo.taxa_sincronizacao ?? "—"}%</div>
              )}
              <p className="text-xs text-muted-foreground">Taxa Sincronização</p>
            </CardContent>
          </Card>
        </div>

        {/* Export Summary KPIs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1B2A4A]">Resumo de Exportação</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-lg font-bold text-[#EA580C]">{summaryData.total_exported ?? "—"}</div>
                  <p className="text-xs text-muted-foreground">Total Exportados</p>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-lg font-bold text-[#16A34A]">{formatBRL(summaryData.total_value_exported)}</div>
                  <p className="text-xs text-muted-foreground">Valor Exportado</p>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-lg font-bold text-[#2563EB]">{summaryData.total_pending ?? "—"}</div>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-lg font-bold text-[#DC2626]">{summaryData.total_errors ?? "—"}</div>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SVG Lifecycle Flowchart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1B2A4A]">Ciclo de Vida do Título AP</CardTitle>
          </CardHeader>
          <CardContent>
            <svg viewBox="0 0 920 160" className="w-full h-auto">
              <defs>
                <marker id="arrowG" viewBox="0 0 10 10" refX="10" refY="5" markerWidth={6} markerHeight={6} orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#16A34A" />
                </marker>
                <marker id="arrowO" viewBox="0 0 10 10" refX="10" refY="5" markerWidth={6} markerHeight={6} orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#EA580C" />
                </marker>
                <marker id="arrowB" viewBox="0 0 10 10" refX="10" refY="5" markerWidth={6} markerHeight={6} orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563EB" />
                </marker>
                <marker id="arrowR" viewBox="0 0 10 10" refX="10" refY="5" markerWidth={6} markerHeight={6} orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#DC2626" />
                </marker>
              </defs>

              {[
                { x: 10, label: "Cadastro", sub: "CadastroTituloAP", color: "#16A34A" },
                { x: 160, label: "Aprovação", sub: "Fila Financeiro", color: "#EA580C" },
                { x: 310, label: "Aceito", sub: "Painel Central", color: "#16A34A" },
                { x: 460, label: "Provisão ERP", sub: "Fila Export.", color: "#2563EB" },
                { x: 610, label: "Pagamento", sub: "Baixa Manual", color: "#16A34A" },
                { x: 760, label: "Baixa ERP", sub: "Fila Export.", color: "#2563EB" },
              ].map((node, i) => (
                <g key={i}>
                  <rect x={node.x} y={20} width={130} height={50} rx={10} fill={node.color} opacity={0.12} stroke={node.color} strokeWidth={1.5} />
                  <text x={node.x + 65} y={42} textAnchor="middle" fill={node.color} fontSize={12} fontWeight={700}>{node.label}</text>
                  <text x={node.x + 65} y={58} textAnchor="middle" fill="#6B7280" fontSize={9}>{node.sub}</text>
                  {i < 5 && (
                    <line x1={node.x + 130} y1={45} x2={node.x + 160} y2={45} stroke={node.color} strokeWidth={1.5} markerEnd={`url(#arrow${node.color === "#16A34A" ? "G" : node.color === "#EA580C" ? "O" : "B"})`} />
                  )}
                </g>
              ))}

              <path d="M 225 70 L 225 105 L 75 105 L 75 70" fill="none" stroke="#DC2626" strokeWidth={1.2} strokeDasharray="4,3" markerEnd="url(#arrowR)" />
              <text x={150} y={100} textAnchor="middle" fill="#DC2626" fontSize={9}>Rejeição</text>

              <path d="M 375 70 L 375 130 L 525 130 L 525 70" fill="none" stroke="#6B7280" strokeWidth={1.2} strokeDasharray="4,3" />
              <text x={450} y={125} textAnchor="middle" fill="#6B7280" fontSize={9}>Cancelamento</text>
              <rect x={470} y={115} width={110} height={25} rx={6} fill="#6B7280" opacity={0.1} stroke="#6B7280" strokeWidth={1} />
              <text x={525} y={132} textAnchor="middle" fill="#6B7280" fontSize={9}>Cancel. ERP</text>

              <path d="M 675 70 L 675 130 L 825 130 L 825 70" fill="none" stroke="#16A34A" strokeWidth={1.2} strokeDasharray="4,3" />
              <text x={750} y={125} textAnchor="middle" fill="#16A34A" fontSize={9}>Conciliação Bancária</text>

              <rect x={10} y={145} width={12} height={12} rx={3} fill="#16A34A" opacity={0.3} />
              <text x={28} y={155} fontSize={10} fill="#6B7280">Interno (BiMaster)</text>
              <rect x={170} y={145} width={12} height={12} rx={3} fill="#EA580C" opacity={0.3} />
              <text x={188} y={155} fontSize={10} fill="#6B7280">Aprovação</text>
              <rect x={280} y={145} width={12} height={12} rx={3} fill="#2563EB" opacity={0.3} />
              <text x={298} y={155} fontSize={10} fill="#6B7280">ERP Externo</text>
              <rect x={400} y={145} width={12} height={12} rx={3} fill="#DC2626" opacity={0.3} />
              <text x={418} y={155} fontSize={10} fill="#6B7280">Rejeição / Erro</text>
            </svg>
          </CardContent>
        </Card>

        {/* Endpoints Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1B2A4A]">Endpoints do Módulo AP ({ENDPOINTS.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F9FAFB]">
                    <TableHead>Function</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Auth</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ENDPOINTS.map((ep, i) => (
                    <TableRow key={i} className={i % 2 ? "bg-[#F9FAFB]" : ""}>
                      <TableCell className="text-xs font-mono">{ep.fn}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{ep.method}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{ep.path}</TableCell>
                      <TableCell className="text-xs">{ep.auth}</TableCell>
                      <TableCell className="text-xs">{ep.desc}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 text-[10px]">Ativo</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Sync Log */}
        <Collapsible open={logOpen} onOpenChange={setLogOpen}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="text-lg text-[#1B2A4A]">Log de Sincronização ERP (últimos 50)</CardTitle>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${logOpen ? "rotate-180" : ""}`} />
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {logLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#F9FAFB]">
                          <TableHead>Data</TableHead>
                          <TableHead>Operação</TableHead>
                          <TableHead>Tabela</TableHead>
                          <TableHead>Ref. ERP</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(syncLog || []).map((log: any, i: number) => (
                          <TableRow key={log.id || i} className={i % 2 ? "bg-[#F9FAFB]" : ""}>
                            <TableCell className="text-xs">{fmtDateTime(log.created_at)}</TableCell>
                            <TableCell className="text-xs">{log.operacao || log.action || "—"}</TableCell>
                            <TableCell className="text-xs">{log.tabela_origem || log.entity_type || "—"}</TableCell>
                            <TableCell className="text-xs font-mono">{log.erp_reference || log.registro_id?.substring(0, 8) || "—"}</TableCell>
                            <TableCell>
                              <Badge className={
                                log.sync_status === "sucesso" || log.sync_status === "success"
                                  ? "bg-green-100 text-green-800 text-[10px]"
                                  : log.sync_status === "erro" || log.sync_status === "error"
                                    ? "bg-red-100 text-red-800 text-[10px]"
                                    : "bg-yellow-100 text-yellow-800 text-[10px]"
                              }>
                                {log.sync_status || "pendente"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </DashboardLayout>
  );
}
