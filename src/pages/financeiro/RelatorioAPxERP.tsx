import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function callExportApi(path: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/contas-pagar-export-api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
  if (!res.ok) return null;
  return res.json();
}

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
  { fn: "contas-pagar-export-api", method: "GET", path: "/status", auth: "API Key", desc: "Status fila" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/pending", auth: "API Key", desc: "Pendentes provisão" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/paid", auth: "API Key", desc: "Pendentes baixa" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/history", auth: "API Key", desc: "Histórico exportação" },
  { fn: "contas-pagar-export-api", method: "POST", path: "/confirm", auth: "API Key", desc: "Confirmar exportação" },
  { fn: "contas-pagar-export-api", method: "POST", path: "/export-batch", auth: "API Key", desc: "Exportar lote" },
  { fn: "contas-pagar-export-api", method: "POST", path: "/retry-failed", auth: "API Key", desc: "Reprocessar erros" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/reconciliation", auth: "API Key", desc: "Reconciliação" },
  { fn: "contas-pagar-export-api", method: "GET", path: "/export-summary", auth: "API Key", desc: "Resumo exportação" },
  { fn: "erp-export-payment", method: "POST", path: "/", auth: "JWT", desc: "Exportar pagamento" },
  { fn: "erp-webhook-inbound", method: "POST", path: "/", auth: "API Key", desc: "Webhook inbound ERP" },
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy HH:mm"); } catch { return d; }
}

export default function RelatorioAPxERP() {
  const navigate = useNavigate();
  const [logOpen, setLogOpen] = useState(true);

  // Export summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["ap-export-summary"],
    queryFn: () => callExportApi("/export-summary"),
    staleTime: 60_000,
  });

  // Reconciliation
  const { data: reconc, isLoading: reconcLoading } = useQuery({
    queryKey: ["ap-reconciliation"],
    queryFn: () => callExportApi("/reconciliation"),
    staleTime: 60_000,
  });

  // ERP sync log
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

  return (
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

      {/* KPIs */}
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

      {/* Lifecycle Flowchart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B2A4A]">Ciclo de Vida do Título AP</CardTitle>
        </CardHeader>
        <CardContent>
          <svg viewBox="0 0 900 100" className="w-full h-auto">
            {/* Nodes */}
            {[
              { x: 10, label: "Lançamento", color: "#16A34A" },
              { x: 155, label: "Aprovação", color: "#EA580C" },
              { x: 300, label: "Aceito", color: "#16A34A" },
              { x: 445, label: "Provisão ERP", color: "#6B7280" },
              { x: 590, label: "Pagamento", color: "#16A34A" },
              { x: 735, label: "Baixa ERP", color: "#6B7280" },
            ].map((node, i) => (
              <g key={i}>
                <rect x={node.x} y={25} width={120} height={40} rx={8} fill={node.color} opacity={0.15} stroke={node.color} strokeWidth={1.5} />
                <text x={node.x + 60} y={50} textAnchor="middle" fill={node.color} fontSize={11} fontWeight={600}>{node.label}</text>
                {i < 5 && (
                  <line x1={node.x + 120} y1={45} x2={node.x + 155} y2={45} stroke="#9CA3AF" strokeWidth={1.5} markerEnd="url(#arrow)" />
                )}
              </g>
            ))}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth={6} markerHeight={6} orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#9CA3AF" />
              </marker>
            </defs>
            {/* Legend */}
            <rect x={10} y={80} width={10} height={10} rx={2} fill="#16A34A" opacity={0.3} />
            <text x={25} y={89} fontSize={9} fill="#6B7280">Implementado</text>
            <rect x={120} y={80} width={10} height={10} rx={2} fill="#EA580C" opacity={0.3} />
            <text x={135} y={89} fontSize={9} fill="#6B7280">Em construção</text>
            <rect x={230} y={80} width={10} height={10} rx={2} fill="#6B7280" opacity={0.3} />
            <text x={245} y={89} fontSize={9} fill="#6B7280">ERP externo</text>
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
                        <TableHead>Evento</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Ref. ERP</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(syncLog || []).map((log: any, i: number) => (
                        <TableRow key={log.id || i} className={i % 2 ? "bg-[#F9FAFB]" : ""}>
                          <TableCell className="text-xs">{fmtDate(log.created_at)}</TableCell>
                          <TableCell className="text-xs">{log.evento || log.event_type || "—"}</TableCell>
                          <TableCell className="text-xs">{log.empresa_id || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{log.erp_reference || log.referencia_erp || "—"}</TableCell>
                          <TableCell>
                            <Badge className={
                              log.status === "sucesso" || log.status === "success"
                                ? "bg-green-100 text-green-800 text-[10px]"
                                : log.status === "erro" || log.status === "error"
                                  ? "bg-red-100 text-red-800 text-[10px]"
                                  : "bg-yellow-100 text-yellow-800 text-[10px]"
                            }>
                              {log.status || "pendente"}
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
  );
}
