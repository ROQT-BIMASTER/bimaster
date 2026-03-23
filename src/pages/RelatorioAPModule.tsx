import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  ArrowLeft, Printer, ChevronDown, ChevronRight,
  Database, FileText, DollarSign, Building2, Package,
  Layers, RefreshCw, Search, BarChart3, Webhook,
  ArrowDownToLine, ArrowUpFromLine, Shield
} from "lucide-react";

// ═══════════════════════════════════════
// PRINT STYLES
// ═══════════════════════════════════════
const PRINT_STYLE = `
@media print {
  nav, aside, header, .no-print { display: none !important; }
  body { font-size: 11px; }
  .print-break { page-break-before: always; }
}
`;

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════
type Relevancia = "Direto" | "Indireto" | "Auxiliar";
type StatusEndpoint = "Funcional" | "Em construcao" | "A mapear";
type Prioridade = "Alta" | "Media" | "Baixa";

interface EndpointRow {
  rota: string;
  metodo: string;
  descricao: string;
  tabelaSupabase: string;
  status: StatusEndpoint;
  telaFrontend: string;
  observacao: string;
  relevanciaAP: Relevancia;
  modulo: string;
  api: string;
}

interface EndpointFuturo {
  rota: string;
  metodo: string;
  descricao: string;
  tabelaSupabase: string;
  statusConstrucao: string;
  novaTela: string;
  camposInput: string;
  prioridade: Prioridade;
}

interface TelaExistente {
  nome: string;
  rota: string;
  apisConsumidas: string[];
  status: "Funcional" | "Parcial" | "Com pendencias";
}

interface TelaNova {
  nome: string;
  rotaPrevista: string;
  apisConsumidas: string[];
  camposInput: { nome: string; tipo: string }[];
  dependencias: string[];
  statusConstrucao: string;
  complexidade: "Simples" | "Media" | "Alta";
}

// ═══════════════════════════════════════
// HELPER: STATUS COLORS
// ═══════════════════════════════════════
const statusColor = (s: string) => {
  const map: Record<string, string> = {
    "Funcional": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "Em construcao": "bg-amber-100 text-amber-800 border-amber-300",
    "A mapear": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "Parcial": "bg-amber-100 text-amber-800 border-amber-300",
    "Com pendencias": "bg-red-100 text-red-800 border-red-300",
    "Nao iniciada": "bg-slate-100 text-slate-700 border-slate-300",
    "Em especificacao": "bg-blue-100 text-blue-800 border-blue-300",
  };
  return map[s] || "bg-slate-100 text-slate-700 border-slate-300";
};

const prioridadeColor = (p: Prioridade) => {
  const map: Record<Prioridade, string> = {
    "Alta": "bg-red-100 text-red-800 border-red-300",
    "Media": "bg-amber-100 text-amber-800 border-amber-300",
    "Baixa": "bg-blue-100 text-blue-800 border-blue-300",
  };
  return map[p];
};

const relevanciaColor = (r: Relevancia) => {
  const map: Record<Relevancia, string> = {
    "Direto": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "Indireto": "bg-blue-100 text-blue-800 border-blue-300",
    "Auxiliar": "bg-slate-100 text-slate-700 border-slate-300",
  };
  return map[r];
};

const methodColor = (m: string) => {
  const map: Record<string, string> = {
    GET: "bg-emerald-100 text-emerald-800",
    POST: "bg-blue-100 text-blue-800",
    PUT: "bg-amber-100 text-amber-800",
    DELETE: "bg-red-100 text-red-800",
  };
  return map[m] || "bg-slate-100 text-slate-800";
};

// ═══════════════════════════════════════
// DATA: 176 ENDPOINTS (AS-IS)
// ═══════════════════════════════════════
const ENDPOINTS_ASIS: EndpointRow[] = [
  // ── CONTAS A PAGAR (19 endpoints) ── Direto
  { rota: "/query", metodo: "GET", descricao: "Consulta avancada com filtros e paginacao", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "ContasPagarGestao", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/update", metodo: "PUT", descricao: "Atualizacao individual de titulo", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "ContaPagarDetalhe", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/cancelar", metodo: "POST", descricao: "Cancelamento com motivo obrigatorio (suporta batch)", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "ContasPagarGestao", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/registrar-pagamento", metodo: "POST", descricao: "Registrar pagamento/baixa via API", tabelaSupabase: "contas_pagar, pagamentos", status: "Funcional", telaFrontend: "ContaPagarDetalhe", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/consultar", metodo: "GET", descricao: "Consultar titulo por ID ou codigo de integracao", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "ContaPagarDetalhe", observacao: "Integracao CRUD", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/incluir", metodo: "POST", descricao: "Incluir conta a pagar (IncluirContaPagar)", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "-", observacao: "Integracao CRUD", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/alterar", metodo: "PUT", descricao: "Alterar conta a pagar (AlterarContaPagar)", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "-", observacao: "Integracao CRUD", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/excluir", metodo: "DELETE", descricao: "Excluir conta a pagar (ExcluirContaPagar)", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "-", observacao: "Soft delete", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/upsert", metodo: "POST", descricao: "Upsert unitario por codigo_lancamento_integracao", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "-", observacao: "Integracao CRUD", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/upsert-lote", metodo: "POST", descricao: "Upsert em lote (max 500)", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "-", observacao: "Batch processing", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/lancar-pagamento", metodo: "POST", descricao: "Efetuar baixa de pagamento", tabelaSupabase: "contas_pagar, pagamentos", status: "Funcional", telaFrontend: "-", observacao: "Integracao", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/cancelar-pagamento", metodo: "POST", descricao: "Cancelar pagamento/baixa", tabelaSupabase: "contas_pagar, pagamentos", status: "Funcional", telaFrontend: "-", observacao: "Integracao", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/listar", metodo: "GET", descricao: "Listagem paginada (ListarContasPagar)", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "ContasPagarGestao", observacao: "Integracao", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/parcelas", metodo: "GET", descricao: "Consulta parcelas de um titulo", tabelaSupabase: "parcelas", status: "Funcional", telaFrontend: "ContaPagarDetalhe", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/parcelas/sync", metodo: "POST", descricao: "Sync de parcelas do ERP", tabelaSupabase: "parcelas", status: "Funcional", telaFrontend: "-", observacao: "Sync ERP", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/pagamentos", metodo: "GET", descricao: "Historico de pagamentos de um titulo", tabelaSupabase: "pagamentos", status: "Funcional", telaFrontend: "ContaPagarDetalhe", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/estornar", metodo: "POST", descricao: "Estorno de pagamento", tabelaSupabase: "pagamentos", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/anexos", metodo: "GET", descricao: "Consultar comprovantes de um titulo", tabelaSupabase: "anexos", status: "Funcional", telaFrontend: "ContaPagarDetalhe", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },
  { rota: "/anexos", metodo: "POST", descricao: "Registrar comprovante de pagamento", tabelaSupabase: "anexos", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-api" },

  // ── CONTAS A RECEBER (13 endpoints) ── Indireto
  { rota: "/consultar", metodo: "GET", descricao: "Consultar titulo CR por ID ou codigo", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "Integracao CRUD", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/incluir", metodo: "POST", descricao: "Incluir conta a receber", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/alterar", metodo: "PUT", descricao: "Alterar conta a receber", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/excluir", metodo: "DELETE", descricao: "Excluir conta a receber", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/upsert", metodo: "POST", descricao: "Upsert unitario CR", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/upsert-lote", metodo: "POST", descricao: "Upsert em lote CR (max 500)", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/lancar-recebimento", metodo: "POST", descricao: "Registrar recebimento/baixa CR", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/cancelar-recebimento", metodo: "POST", descricao: "Cancelar recebimento CR", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/conciliar", metodo: "POST", descricao: "Conciliar recebimento CR", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/desconciliar", metodo: "POST", descricao: "Desconciliar recebimento CR", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/cancelar", metodo: "POST", descricao: "Cancelar titulo CR", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/listar", metodo: "GET", descricao: "Listagem paginada CR", tabelaSupabase: "contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },
  { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-receber-api" },

  // ── BOLETOS (6 endpoints) ── Indireto
  { rota: "/gerar", metodo: "POST", descricao: "Gerar boleto para titulo CR", tabelaSupabase: "boletos", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "boletos-api" },
  { rota: "/obter", metodo: "GET", descricao: "Obter link e dados do boleto", tabelaSupabase: "boletos", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "boletos-api" },
  { rota: "/cancelar", metodo: "POST", descricao: "Cancelar boleto gerado", tabelaSupabase: "boletos", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "boletos-api" },
  { rota: "/prorrogar", metodo: "POST", descricao: "Prorrogar vencimento do boleto", tabelaSupabase: "boletos", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "boletos-api" },
  { rota: "/listar", metodo: "GET", descricao: "Listar boletos paginado", tabelaSupabase: "boletos", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "boletos-api" },
  { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "boletos-api" },

  // ── CONTAS CORRENTES (9 endpoints) ── Indireto
  { rota: "/", metodo: "GET", descricao: "Listar contas correntes paginado", tabelaSupabase: "contas_correntes", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-correntes-api" },
  { rota: "/resumo", metodo: "GET", descricao: "Listagem resumida de contas correntes", tabelaSupabase: "contas_correntes", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-correntes-api" },
  { rota: "/consultar", metodo: "GET", descricao: "Consultar CC por ID ou codigo", tabelaSupabase: "contas_correntes", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-correntes-api" },
  { rota: "/incluir", metodo: "POST", descricao: "Incluir nova CC", tabelaSupabase: "contas_correntes", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-correntes-api" },
  { rota: "/alterar", metodo: "PUT", descricao: "Alterar CC existente", tabelaSupabase: "contas_correntes", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-correntes-api" },
  { rota: "/excluir", metodo: "DELETE", descricao: "Excluir CC", tabelaSupabase: "contas_correntes", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-correntes-api" },
  { rota: "/upsert", metodo: "POST", descricao: "Upsert unitario CC", tabelaSupabase: "contas_correntes", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-correntes-api" },
  { rota: "/upsert-lote", metodo: "POST", descricao: "Upsert em lote CC (max 500)", tabelaSupabase: "contas_correntes", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-correntes-api" },
  { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "contas-correntes-api" },

  // ── LANCAMENTOS CC (10 endpoints) ── Indireto
  { rota: "/", metodo: "GET", descricao: "Listar lancamentos CC paginado", tabelaSupabase: "lancamentos_cc", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "lancamentos-cc-api" },
  { rota: "/consultar", metodo: "GET", descricao: "Consultar lancamento por ID", tabelaSupabase: "lancamentos_cc", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "lancamentos-cc-api" },
  { rota: "/incluir", metodo: "POST", descricao: "Incluir lancamento CC", tabelaSupabase: "lancamentos_cc", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "lancamentos-cc-api" },
  { rota: "/alterar", metodo: "PUT", descricao: "Alterar lancamento CC", tabelaSupabase: "lancamentos_cc", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "lancamentos-cc-api" },
  { rota: "/excluir", metodo: "DELETE", descricao: "Excluir lancamento CC", tabelaSupabase: "lancamentos_cc", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "lancamentos-cc-api" },
  { rota: "/upsert", metodo: "POST", descricao: "Upsert unitario lancamento CC", tabelaSupabase: "lancamentos_cc", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "lancamentos-cc-api" },
  { rota: "/upsert-lote", metodo: "POST", descricao: "Upsert em lote lancamentos (max 500)", tabelaSupabase: "lancamentos_cc", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "lancamentos-cc-api" },
  { rota: "/extrato", metodo: "GET", descricao: "Extrato de CC com saldos e movimentos", tabelaSupabase: "lancamentos_cc", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "lancamentos-cc-api" },
  { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "lancamentos-cc-api" },
  // missing one — sync
  { rota: "/sync", metodo: "POST", descricao: "Sync de lancamentos do ERP", tabelaSupabase: "lancamentos_cc", status: "Funcional", telaFrontend: "-", observacao: "Sync ERP", relevanciaAP: "Indireto", modulo: "Financas", api: "lancamentos-cc-api" },

  // ── EXPORTACAO ERP (11 endpoints) ── Direto
  { rota: "/pending", metodo: "GET", descricao: "Itens aceitos pendentes de exportacao", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "-", observacao: "Pull ERP", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-export-api" },
  { rota: "/paid", metodo: "GET", descricao: "Itens pagos pendentes de exportacao", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "-", observacao: "Pull ERP", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-export-api" },
  { rota: "/cancelled", metodo: "GET", descricao: "Cancelados pendentes de exportacao", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "-", observacao: "Pull ERP", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-export-api" },
  { rota: "/confirm", metodo: "POST", descricao: "Confirmar recebimento pelo ERP", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-export-api" },
  { rota: "/status", metodo: "GET", descricao: "Status global de pendencias", tabelaSupabase: "-", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-export-api" },
  { rota: "/history", metodo: "GET", descricao: "Historico de exportacoes", tabelaSupabase: "export_queue", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-export-api" },
  { rota: "/export-batch", metodo: "POST", descricao: "Exportacao em lote (ate 200)", tabelaSupabase: "export_queue", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-export-api" },
  { rota: "/retry-failed", metodo: "POST", descricao: "Reprocessar exportacoes com erro", tabelaSupabase: "export_queue", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-export-api" },
  { rota: "/reconciliation", metodo: "GET", descricao: "Reconciliacao BiMaster x ERP", tabelaSupabase: "contas_pagar, export_queue", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-export-api" },
  { rota: "/export-summary", metodo: "GET", descricao: "Resumo por empresa e periodo", tabelaSupabase: "contas_pagar", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-export-api" },
  { rota: "/webhook-push", metodo: "POST", descricao: "Configurar webhook outbound push", tabelaSupabase: "webhook_subscriptions", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Direto", modulo: "Financas", api: "contas-pagar-export-api" },

  // ── ORCAMENTOS CAIXA (4 endpoints) ── Indireto
  { rota: "/listar", metodo: "GET", descricao: "Listar orcamento previsto x realizado", tabelaSupabase: "orcamentos_caixa", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "orcamentos-caixa-api" },
  { rota: "/incluir", metodo: "POST", descricao: "Cadastrar/atualizar orcamento previsto", tabelaSupabase: "orcamentos_caixa", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "orcamentos-caixa-api" },
  { rota: "/incluir-lote", metodo: "POST", descricao: "Upsert em lote de orcamentos (max 500)", tabelaSupabase: "orcamentos_caixa", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "orcamentos-caixa-api" },
  { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "orcamentos-caixa-api" },

  // ── PESQUISAR LANCAMENTOS (2) ── Indireto
  { rota: "/pesquisar", metodo: "POST", descricao: "Pesquisa avancada unificada de titulos", tabelaSupabase: "contas_pagar, contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "pesquisar-lancamentos-api" },
  { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "pesquisar-lancamentos-api" },

  // ── MOVIMENTOS FINANCEIROS (2) ── Indireto
  { rota: "/listar", metodo: "POST", descricao: "Listagem unificada de movimentos", tabelaSupabase: "lancamentos_cc", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "movimentos-financeiros-api" },
  { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "movimentos-financeiros-api" },

  // ── RESUMO FINANCEIRO (5) ── Indireto
  { rota: "/resumo", metodo: "POST", descricao: "Resumo consolidado: saldos, totais, fluxo de caixa", tabelaSupabase: "contas_pagar, contas_receber, lancamentos_cc", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "resumo-financeiro-api" },
  { rota: "/em-aberto", metodo: "POST", descricao: "Lista paginada de titulos em aberto", tabelaSupabase: "contas_pagar, contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "resumo-financeiro-api" },
  { rota: "/lista-financas", metodo: "POST", descricao: "Lista por data/categoria/tipo", tabelaSupabase: "contas_pagar, contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "resumo-financeiro-api" },
  { rota: "/detalhes", metodo: "POST", descricao: "Detalhes de um titulo", tabelaSupabase: "contas_pagar, contas_receber", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "resumo-financeiro-api" },
  { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Financas", api: "resumo-financeiro-api" },

  // ── CLIENTES (19 endpoints) ── Indireto (fornecedores)
  ...Array.from({ length: 10 }, (_, i) => {
    const routes = ["/consultar","/incluir","/alterar","/excluir","/upsert","/upsert-lote","/listar","/listar-resumido","/status","/sync"];
    const methods = ["GET","POST","PUT","DELETE","POST","POST","GET","GET","GET","POST"];
    const descs = ["Consultar cliente/fornecedor","Incluir cliente","Alterar cliente","Excluir cliente","Upsert unitario","Upsert em lote","Listar paginado","Listar resumido","Health check","Sync ERP"];
    return { rota: routes[i], metodo: methods[i], descricao: descs[i], tabelaSupabase: i === 8 ? "-" : "clientes", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "CRUD Principal", relevanciaAP: "Indireto" as Relevancia, modulo: "Geral", api: "clientes-api" };
  }),
  ...Array.from({ length: 5 }, (_, i) => {
    const routes = ["/caracteristicas/incluir","/caracteristicas/alterar","/caracteristicas/excluir","/caracteristicas/listar","/caracteristicas/status"];
    const methods = ["POST","PUT","DELETE","GET","GET"];
    const descs = ["Incluir caracteristica","Alterar caracteristica","Excluir caracteristica","Listar caracteristicas","Health check"];
    return { rota: routes[i], metodo: methods[i], descricao: descs[i], tabelaSupabase: i === 4 ? "-" : "clientes_caracteristicas", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "Caracteristicas", relevanciaAP: "Indireto" as Relevancia, modulo: "Geral", api: "clientes-api" };
  }),
  ...Array.from({ length: 4 }, (_, i) => {
    const routes = ["/tags/incluir","/tags/excluir","/tags/listar","/tags/status"];
    const methods = ["POST","DELETE","GET","GET"];
    const descs = ["Incluir tag","Excluir tag","Listar tags","Health check"];
    return { rota: routes[i], metodo: methods[i], descricao: descs[i], tabelaSupabase: i === 3 ? "-" : "clientes_tags", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "Tags", relevanciaAP: "Indireto" as Relevancia, modulo: "Geral", api: "clientes-api" };
  }),

  // ── EMPRESAS (3) ── Indireto
  { rota: "/consultar", metodo: "POST", descricao: "Consultar empresa por codigo", tabelaSupabase: "empresas", status: "Funcional", telaFrontend: "Empresas", observacao: "", relevanciaAP: "Indireto", modulo: "Geral", api: "empresas-api" },
  { rota: "/listar", metodo: "POST", descricao: "Listar empresas paginadas", tabelaSupabase: "empresas", status: "Funcional", telaFrontend: "Empresas", observacao: "", relevanciaAP: "Indireto", modulo: "Geral", api: "empresas-api" },
  { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Indireto", modulo: "Geral", api: "empresas-api" },

  // ── DEPARTAMENTOS (6) ── Indireto
  ...Array.from({ length: 6 }, (_, i) => {
    const routes = ["/incluir","/alterar","/consultar","/excluir","/listar","/status"];
    const methods = ["POST","POST","POST","POST","POST","GET"];
    const descs = ["Incluir departamento","Alterar departamento","Consultar departamento","Excluir departamento","Listar departamentos","Health check"];
    return { rota: routes[i], metodo: methods[i], descricao: descs[i], tabelaSupabase: i === 5 ? "-" : "departamentos", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Indireto" as Relevancia, modulo: "Geral", api: "departamentos-api" };
  }),

  // ── CATEGORIAS (7) ── Indireto
  ...Array.from({ length: 7 }, (_, i) => {
    const routes = ["/incluir","/incluir-grupo","/alterar","/alterar-grupo","/consultar","/listar","/status"];
    const methods = ["POST","POST","POST","POST","POST","POST","GET"];
    const descs = ["Incluir categoria","Incluir grupo totalizador","Alterar categoria","Alterar grupo","Consultar categoria","Listar categorias","Health check"];
    return { rota: routes[i], metodo: methods[i], descricao: descs[i], tabelaSupabase: i === 6 ? "-" : "categorias", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Indireto" as Relevancia, modulo: "Geral", api: "categorias-api" };
  }),

  // ── PROJETOS (7) ── Auxiliar
  ...Array.from({ length: 7 }, (_, i) => {
    const routes = ["/incluir","/alterar","/consultar","/excluir","/listar","/upsert","/status"];
    const methods = ["POST","POST","POST","POST","POST","POST","GET"];
    const descs = ["Incluir projeto","Alterar projeto","Consultar projeto","Excluir projeto","Listar projetos","Upsert projeto","Health check"];
    return { rota: routes[i], metodo: methods[i], descricao: descs[i], tabelaSupabase: i === 6 ? "-" : "projetos", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Geral", api: "projetos-api" };
  }),

  // ── PARCELAS (3) ── Auxiliar
  { rota: "/incluir", metodo: "POST", descricao: "Incluir condicao de parcelamento", tabelaSupabase: "parcelas_config", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar", modulo: "Geral", api: "parcelas-api" },
  { rota: "/listar", metodo: "POST", descricao: "Listar parcelas cadastradas", tabelaSupabase: "parcelas_config", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar", modulo: "Geral", api: "parcelas-api" },
  { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar", modulo: "Geral", api: "parcelas-api" },

  // ── CADASTROS AUXILIARES (31 endpoints) ── Auxiliar
  ...["tipos-atividade-api","tipos-anexo-api"].flatMap(api => [
    { rota: "/listar", metodo: "POST", descricao: `Listar ${api.replace("-api","")}`, tabelaSupabase: api.replace("-api","").replace(/-/g,"_"), status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
    { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
  ]),
  ...Array.from({ length: 6 }, (_, i) => {
    const routes = ["/incluir","/alterar","/consultar","/excluir","/listar","/status"];
    const methods = ["POST","POST","POST","POST","POST","GET"];
    const descs = ["Incluir tipo entrega","Alterar tipo entrega","Consultar tipo entrega","Excluir tipo entrega","Listar tipos entrega","Health check"];
    return { rota: routes[i], metodo: methods[i], descricao: descs[i], tabelaSupabase: i === 5 ? "-" : "tipos_entrega", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api: "tipos-entrega-api" };
  }),
  ...["tipos-documento-api"].flatMap(api => [
    { rota: "/consultar", metodo: "GET", descricao: "Consultar tipo de documento", tabelaSupabase: "tipos_documento", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
    { rota: "/pesquisar", metodo: "POST", descricao: "Pesquisar tipos de documento", tabelaSupabase: "tipos_documento", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
    { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
  ]),
  ...["cnae-api","cidades-api","paises-api"].flatMap(api => [
    { rota: "/listar", metodo: "POST", descricao: `Listar ${api.replace("-api","")}`, tabelaSupabase: api.replace("-api","").replace(/-/g,"_"), status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
    { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
  ]),
  ...["bancos-api"].flatMap(api => [
    { rota: "/consultar", metodo: "GET", descricao: "Consultar banco por codigo COMPE", tabelaSupabase: "bancos", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
    { rota: "/listar", metodo: "GET", descricao: "Listar bancos cadastrados", tabelaSupabase: "bancos", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
    { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
  ]),
  ...["bandeiras-api","origens-api"].flatMap(api => [
    { rota: "/listar", metodo: api === "origens-api" ? "GET" : "POST", descricao: `Listar ${api.replace("-api","")}`, tabelaSupabase: api.replace("-api","").replace(/-/g,"_"), status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
    { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
  ]),
  ...["finalidades-transferencia-api"].flatMap(api => [
    { rota: "/consultar", metodo: "GET", descricao: "Consultar finalidade por codigo", tabelaSupabase: "finalidades_transferencia", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
    { rota: "/listar", metodo: "GET", descricao: "Listar finalidades paginadas", tabelaSupabase: "finalidades_transferencia", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
    { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
  ]),
  ...["dre-cadastro-api"].flatMap(api => [
    { rota: "/listar", metodo: "POST", descricao: "Listar contas do DRE", tabelaSupabase: "dre_cadastro", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
    { rota: "/status", metodo: "GET", descricao: "Health check", tabelaSupabase: "-", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Cadastros Auxiliares", api },
  ]),

  // ── ANEXOS (6 endpoints) ── Auxiliar
  ...Array.from({ length: 6 }, (_, i) => {
    const routes = ["/incluir","/consultar","/obter","/listar","/excluir","/status"];
    const methods = ["POST","GET","GET","GET","DELETE","GET"];
    const descs = ["Incluir anexo (base64)","Consultar metadados do anexo","Obter link de download","Listar anexos de um documento","Excluir anexo","Health check"];
    return { rota: routes[i], metodo: methods[i], descricao: descs[i], tabelaSupabase: i === 5 ? "-" : "anexos", status: "Funcional" as StatusEndpoint, telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar" as Relevancia, modulo: "Complementar", api: "anexos-api" };
  }),

  // ── WEBHOOK INBOUND (1) ── Auxiliar
  { rota: "/", metodo: "POST", descricao: "Receber callbacks do ERP", tabelaSupabase: "webhook_logs", status: "Funcional", telaFrontend: "-", observacao: "", relevanciaAP: "Auxiliar", modulo: "Complementar", api: "erp-webhook-inbound" },
];

// ═══════════════════════════════════════
// DATA: ENDPOINTS FUTUROS (TO-BE)
// ═══════════════════════════════════════
const ENDPOINTS_FUTUROS: EndpointFuturo[] = [
  { rota: "POST /ap/solicitar-aprovacao", metodo: "POST", descricao: "Iniciar fluxo de aprovacao multinivel para titulo AP", tabelaSupabase: "ap_aprovacoes (nova)", statusConstrucao: "Em especificacao", novaTela: "Sim - Tela de Aprovacao AP", camposInput: "titulo_id, nivel_aprovacao, aprovador_id, observacao", prioridade: "Alta" },
  { rota: "PUT /ap/aprovar", metodo: "PUT", descricao: "Aprovar titulo em nivel especifico", tabelaSupabase: "ap_aprovacoes (nova)", statusConstrucao: "Em especificacao", novaTela: "Sim - Tela de Aprovacao AP", camposInput: "aprovacao_id, decisao (aprovar/rejeitar), motivo", prioridade: "Alta" },
  { rota: "GET /ap/fluxo-aprovacao", metodo: "GET", descricao: "Consultar historico do fluxo de aprovacao", tabelaSupabase: "ap_aprovacoes (nova)", statusConstrucao: "Nao iniciada", novaTela: "Sim - Detalhe Aprovacao", camposInput: "titulo_id", prioridade: "Alta" },
  { rota: "POST /ap/conciliar-automatico", metodo: "POST", descricao: "Conciliacao automatica AP x extrato bancario", tabelaSupabase: "ap_conciliacao (nova)", statusConstrucao: "Em especificacao", novaTela: "Sim - Tela de Conciliacao AP", camposInput: "conta_corrente_id, data_de, data_ate, tolerancia_valor", prioridade: "Alta" },
  { rota: "GET /ap/conciliacao-pendentes", metodo: "GET", descricao: "Listar titulos pendentes de conciliacao", tabelaSupabase: "ap_conciliacao (nova)", statusConstrucao: "Nao iniciada", novaTela: "Sim - Tela de Conciliacao AP", camposInput: "filtros de data e valor", prioridade: "Media" },
  { rota: "POST /ap/conciliar-manual", metodo: "POST", descricao: "Vincular manualmente titulo a movimento bancario", tabelaSupabase: "ap_conciliacao (nova)", statusConstrucao: "Nao iniciada", novaTela: "Sim - Tela de Conciliacao AP", camposInput: "titulo_id, lancamento_cc_id, observacao", prioridade: "Media" },
  { rota: "GET /ap/relatorio-aging", metodo: "GET", descricao: "Relatorio de aging/vencimento por faixa", tabelaSupabase: "contas_pagar (existente)", statusConstrucao: "Nao iniciada", novaTela: "Sim - Relatorio AP", camposInput: "empresa_id, data_base, faixas_vencimento", prioridade: "Media" },
  { rota: "GET /ap/relatorio-fornecedor", metodo: "GET", descricao: "Relatorio consolidado por fornecedor", tabelaSupabase: "contas_pagar (existente)", statusConstrucao: "Nao iniciada", novaTela: "Sim - Relatorio AP", camposInput: "fornecedor_id, periodo_de, periodo_ate", prioridade: "Media" },
  { rota: "GET /ap/dashboard-kpis", metodo: "GET", descricao: "KPIs financeiros do modulo AP", tabelaSupabase: "contas_pagar, pagamentos", statusConstrucao: "Nao iniciada", novaTela: "Sim - Dashboard AP", camposInput: "empresa_id, periodo", prioridade: "Baixa" },
  { rota: "POST /ap/regras-rateio", metodo: "POST", descricao: "Configurar regras de rateio automatico", tabelaSupabase: "ap_regras_rateio (nova)", statusConstrucao: "Nao iniciada", novaTela: "Sim - Config Rateio AP", camposInput: "categoria, departamentos[], percentuais[]", prioridade: "Baixa" },
  { rota: "GET /ap/forecast-caixa", metodo: "GET", descricao: "Projecao de caixa baseada em AP pendentes", tabelaSupabase: "contas_pagar (existente)", statusConstrucao: "Nao iniciada", novaTela: "Sim - Forecast Financeiro", camposInput: "empresa_id, periodo_meses", prioridade: "Baixa" },
];

// ═══════════════════════════════════════
// DATA: DB SCHEMA ATUAL
// ═══════════════════════════════════════
const SCHEMA_CONTAS_PAGAR = [
  { coluna: "id", tipo: "uuid", descricao: "PK auto-gerada" },
  { coluna: "empresa_id", tipo: "integer", descricao: "FK para empresas.id" },
  { coluna: "fornecedor_nome", tipo: "text", descricao: "Nome do fornecedor" },
  { coluna: "fornecedor_codigo", tipo: "integer", descricao: "Codigo do fornecedor no ERP" },
  { coluna: "numero_documento", tipo: "text", descricao: "Numero do documento/NF" },
  { coluna: "valor_original", tipo: "decimal", descricao: "Valor original do titulo" },
  { coluna: "valor_pago", tipo: "decimal", descricao: "Valor ja pago" },
  { coluna: "data_emissao", tipo: "date", descricao: "Data de emissao" },
  { coluna: "data_vencimento", tipo: "date", descricao: "Data de vencimento" },
  { coluna: "data_competencia", tipo: "date", descricao: "Data de competencia contabil" },
  { coluna: "data_baixa", tipo: "timestamptz", descricao: "Data efetiva da baixa" },
  { coluna: "status", tipo: "text", descricao: "pendente, vencido, pago, cancelado" },
  { coluna: "categoria_nome", tipo: "text", descricao: "Categoria contabil" },
  { coluna: "departamento", tipo: "text", descricao: "Departamento vinculado" },
  { coluna: "portador_id", tipo: "uuid", descricao: "FK para portadores" },
  { coluna: "numero_parcela", tipo: "integer", descricao: "Numero da parcela" },
  { coluna: "total_parcelas", tipo: "integer", descricao: "Total de parcelas" },
  { coluna: "importado_api", tipo: "boolean", descricao: "Flag de importacao via API" },
  { coluna: "codigo_integracao", tipo: "text", descricao: "Codigo de integracao ERP" },
  { coluna: "baixa_origem", tipo: "text", descricao: "pluggy, erp_webhook, manual" },
  { coluna: "pluggy_transaction_id", tipo: "text", descricao: "ID da transacao Pluggy para conciliacao" },
  { coluna: "erp_titulo_id", tipo: "text", descricao: "ID do titulo no ERP" },
  { coluna: "erp_response_code", tipo: "text", descricao: "Codigo de resposta do ERP" },
  { coluna: "titulo_numero", tipo: "text", descricao: "Numero sequencial do titulo" },
  { coluna: "created_at", tipo: "timestamptz", descricao: "Data de criacao" },
  { coluna: "updated_at", tipo: "timestamptz", descricao: "Data de atualizacao" },
];

// ═══════════════════════════════════════
// DATA: TELAS
// ═══════════════════════════════════════
const TELAS_EXISTENTES: TelaExistente[] = [
  { nome: "Contas a Pagar - Gestao", rota: "/dashboard/contas-a-pagar", apisConsumidas: ["contas-pagar-api/query", "contas-pagar-api/listar", "contas-pagar-api/cancelar"], status: "Funcional" },
  { nome: "Conta a Pagar - Detalhe", rota: "/dashboard/contas-a-pagar/:id", apisConsumidas: ["contas-pagar-api/consultar", "contas-pagar-api/update", "contas-pagar-api/parcelas", "contas-pagar-api/pagamentos", "contas-pagar-api/anexos"], status: "Funcional" },
  { nome: "Contas a Pagar - Auditoria", rota: "/dashboard/contas-a-pagar/auditoria", apisConsumidas: ["contas-pagar-api/query"], status: "Funcional" },
  { nome: "Contas a Pagar - Sync", rota: "/dashboard/contas-a-pagar/sync", apisConsumidas: ["contas-pagar-api/sync", "contas-pagar-api/bulk-sync", "contas-pagar-api/sync-incremental"], status: "Funcional" },
  { nome: "Portal ERP - Integracao", rota: "/dashboard/integracao-erp", apisConsumidas: ["contas-pagar-export-api/pending", "contas-pagar-export-api/paid", "contas-pagar-export-api/confirm"], status: "Funcional" },
];

const TELAS_NOVAS: TelaNova[] = [
  {
    nome: "Aprovacao Multinivel AP",
    rotaPrevista: "/dashboard/contas-a-pagar/aprovacoes",
    apisConsumidas: ["ap/solicitar-aprovacao", "ap/aprovar", "ap/fluxo-aprovacao"],
    camposInput: [
      { nome: "titulo_id", tipo: "uuid (select)" },
      { nome: "nivel_aprovacao", tipo: "integer (select)" },
      { nome: "aprovador_id", tipo: "uuid (select usuario)" },
      { nome: "decisao", tipo: "select (aprovar/rejeitar)" },
      { nome: "motivo", tipo: "text (textarea)" },
      { nome: "observacao", tipo: "text" },
    ],
    dependencias: ["Tabela ap_aprovacoes", "RLS por empresa e nivel"],
    statusConstrucao: "Em especificacao",
    complexidade: "Alta",
  },
  {
    nome: "Conciliacao Bancaria AP",
    rotaPrevista: "/dashboard/contas-a-pagar/conciliacao",
    apisConsumidas: ["ap/conciliar-automatico", "ap/conciliacao-pendentes", "ap/conciliar-manual"],
    camposInput: [
      { nome: "conta_corrente_id", tipo: "uuid (select)" },
      { nome: "data_de", tipo: "date" },
      { nome: "data_ate", tipo: "date" },
      { nome: "tolerancia_valor", tipo: "currency" },
      { nome: "titulo_id", tipo: "uuid (select)" },
      { nome: "lancamento_cc_id", tipo: "uuid (select)" },
    ],
    dependencias: ["Tabela ap_conciliacao", "API contas-correntes-api", "API lancamentos-cc-api"],
    statusConstrucao: "Nao iniciada",
    complexidade: "Alta",
  },
  {
    nome: "Relatorios AP",
    rotaPrevista: "/dashboard/contas-a-pagar/relatorios",
    apisConsumidas: ["ap/relatorio-aging", "ap/relatorio-fornecedor"],
    camposInput: [
      { nome: "empresa_id", tipo: "integer (select)" },
      { nome: "data_base", tipo: "date" },
      { nome: "fornecedor_id", tipo: "integer (select)" },
      { nome: "periodo_de", tipo: "date" },
      { nome: "periodo_ate", tipo: "date" },
      { nome: "faixas_vencimento", tipo: "multi-select" },
    ],
    dependencias: ["Dados populados em contas_pagar"],
    statusConstrucao: "Nao iniciada",
    complexidade: "Media",
  },
  {
    nome: "Dashboard AP KPIs",
    rotaPrevista: "/dashboard/contas-a-pagar/dashboard",
    apisConsumidas: ["ap/dashboard-kpis", "resumo-financeiro-api/resumo"],
    camposInput: [
      { nome: "empresa_id", tipo: "integer (select)" },
      { nome: "periodo", tipo: "date range" },
    ],
    dependencias: ["API resumo-financeiro-api funcional"],
    statusConstrucao: "Nao iniciada",
    complexidade: "Media",
  },
  {
    nome: "Configuracao de Rateio AP",
    rotaPrevista: "/dashboard/contas-a-pagar/rateio",
    apisConsumidas: ["ap/regras-rateio", "categorias-api/listar", "departamentos-api/listar"],
    camposInput: [
      { nome: "categoria", tipo: "text (select)" },
      { nome: "departamentos", tipo: "multi-select" },
      { nome: "percentuais", tipo: "number[] (dynamic form)" },
    ],
    dependencias: ["Tabela ap_regras_rateio", "categorias-api", "departamentos-api"],
    statusConstrucao: "Nao iniciada",
    complexidade: "Media",
  },
  {
    nome: "Forecast de Caixa",
    rotaPrevista: "/dashboard/financeiro/forecast",
    apisConsumidas: ["ap/forecast-caixa", "resumo-financeiro-api/em-aberto"],
    camposInput: [
      { nome: "empresa_id", tipo: "integer (select)" },
      { nome: "periodo_meses", tipo: "integer (slider 1-12)" },
    ],
    dependencias: ["Dados historicos em contas_pagar"],
    statusConstrucao: "Nao iniciada",
    complexidade: "Simples",
  },
];

// ═══════════════════════════════════════
// DATA: CHECKLIST
// ═══════════════════════════════════════
const CHECKLIST = [
  { item: "Endpoints backend confirmados e documentados", status: "Concluido" },
  { item: "Migrations Supabase executadas para tabelas existentes", status: "Concluido" },
  { item: "Policies RLS definidas para contas_pagar", status: "Concluido" },
  { item: "Tela de listagem AP construida", status: "Concluido" },
  { item: "Tela de cadastro/entrada de nota construida", status: "Em andamento" },
  { item: "Tela de aprovacao multinivel construida", status: "Nao iniciado" },
  { item: "Tela de conciliacao bancaria construida", status: "Nao iniciado" },
  { item: "Tela de relatorio AP construida", status: "Nao iniciado" },
  { item: "Tela de dashboard KPIs AP construida", status: "Nao iniciado" },
  { item: "Tabela ap_aprovacoes criada e com RLS", status: "Nao iniciado" },
  { item: "Tabela ap_conciliacao criada e com RLS", status: "Nao iniciado" },
  { item: "Tabela ap_regras_rateio criada e com RLS", status: "Nao iniciado" },
  { item: "Testes de integracao front-back realizados", status: "Em andamento" },
  { item: "Validacao com usuario admin", status: "Nao iniciado" },
];

// ═══════════════════════════════════════
// DATA: GLOSSARIO
// ═══════════════════════════════════════
const GLOSSARIO = [
  { termo: "AP", significado: "Accounts Payable — Contas a Pagar. Modulo de gestao de obrigacoes financeiras." },
  { termo: "AR", significado: "Accounts Receivable — Contas a Receber. Modulo complementar ao AP." },
  { termo: "Invoice", significado: "Nota fiscal / fatura de fornecedor que gera um titulo a pagar." },
  { termo: "PO", significado: "Purchase Order — Ordem de Compra vinculada ao titulo AP." },
  { termo: "Approval Flow", significado: "Fluxo de aprovacao multinivel: titulo precisa de N aprovacoes antes do pagamento." },
  { termo: "RLS", significado: "Row Level Security — controle de acesso por linha no banco, isolando dados por tenant." },
  { termo: "Tenant", significado: "Empresa cliente no modelo multi-tenant. Cada tenant ve apenas seus dados." },
  { termo: "Conciliacao", significado: "Processo de cruzar pagamentos AP com movimentos bancarios (extrato)." },
  { termo: "Aging", significado: "Relatorio de vencimentos por faixa temporal (a vencer, vencido 1-30d, 31-60d, etc.)." },
  { termo: "Baixa", significado: "Registro do pagamento efetivo de um titulo AP." },
  { termo: "Rateio", significado: "Divisao de um titulo entre multiplos departamentos/categorias." },
  { termo: "Portador", significado: "Conta bancaria/meio de pagamento vinculado ao titulo." },
  { termo: "Upsert", significado: "Insert ou Update — cria se nao existe, atualiza se ja existe (por codigo de integracao)." },
];

// ═══════════════════════════════════════
// FLOWCHART SVG COMPONENT
// ═══════════════════════════════════════
interface FlowNode {
  label: string;
  status: "implementado" | "pendente" | "novo" | "em_construcao";
  endpoint?: string;
  tabela?: string;
}

function FlowchartDiagram({ nodes, title }: { nodes: FlowNode[]; title: string }) {
  const nodeW = 150;
  const nodeH = 44;
  const gap = 20;
  const arrowW = 30;
  const nodesPerRow = 4;
  const rows = Math.ceil(nodes.length / nodesPerRow);

  const colorMap = {
    implementado: { fill: "#dbeafe", stroke: "#3b82f6", text: "#1e40af" },
    pendente: { fill: "#f1f5f9", stroke: "#94a3b8", text: "#475569" },
    novo: { fill: "#dcfce7", stroke: "#22c55e", text: "#166534" },
    em_construcao: { fill: "#fff7ed", stroke: "#f59e0b", text: "#92400e" },
  };

  const totalW = nodesPerRow * nodeW + (nodesPerRow - 1) * (arrowW + gap) + 40;
  const totalH = rows * (nodeH + 60) + 40;

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm" style={{ color: "#1e293b" }}>{title}</h4>
      <div className="overflow-x-auto border rounded-lg bg-white p-4">
        <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
          {nodes.map((node, i) => {
            const row = Math.floor(i / nodesPerRow);
            const col = i % nodesPerRow;
            const x = 20 + col * (nodeW + arrowW + gap);
            const y = 20 + row * (nodeH + 60);
            const c = colorMap[node.status];

            return (
              <g key={i}>
                <rect x={x} y={y} width={nodeW} height={nodeH} rx={6}
                  fill={c.fill} stroke={c.stroke} strokeWidth={1.5}
                  strokeDasharray={node.status === "pendente" ? "5,3" : "none"}
                />
                <text x={x + nodeW / 2} y={y + nodeH / 2 - 2} textAnchor="middle" dominantBaseline="middle"
                  fill={c.text} fontSize={11} fontWeight={500} fontFamily="system-ui">
                  {node.label}
                </text>
                {node.endpoint && (
                  <text x={x + nodeW / 2} y={y + nodeH + 12} textAnchor="middle"
                    fill="#94a3b8" fontSize={9} fontFamily="monospace">
                    {node.endpoint}
                  </text>
                )}
                {i < nodes.length - 1 && col < nodesPerRow - 1 && (
                  <g>
                    <line x1={x + nodeW + 4} y1={y + nodeH / 2} x2={x + nodeW + arrowW + gap - 4} y2={y + nodeH / 2}
                      stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arrowhead)" />
                  </g>
                )}
                {col === nodesPerRow - 1 && i < nodes.length - 1 && (
                  <line x1={x + nodeW / 2} y1={y + nodeH + 16} x2={20 + nodeW / 2} y2={y + nodeH + 60}
                    stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4,3" />
                )}
              </g>
            );
          })}
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
          </defs>
        </svg>
      </div>
      <div className="flex gap-4 text-[10px]">
        {[
          { label: "Implementado", color: "#3b82f6" },
          { label: "Pendente", color: "#94a3b8" },
          { label: "Novo (planejado)", color: "#22c55e" },
          { label: "Em construcao", color: "#f59e0b" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: l.color, opacity: 0.3, border: `1.5px solid ${l.color}` }} />
            <span style={{ color: "#64748b" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const FLOW_ATUAL: FlowNode[] = [
  { label: "Entrada de Nota", status: "implementado", endpoint: "POST /incluir", tabela: "contas_pagar" },
  { label: "Validacao", status: "implementado", endpoint: "Rate Limit + Auth", tabela: "-" },
  { label: "Aprovacao", status: "pendente", endpoint: "(nao impl.)", tabela: "ap_aprovacoes" },
  { label: "Agendamento", status: "implementado", endpoint: "PUT /update", tabela: "contas_pagar" },
  { label: "Pagamento", status: "implementado", endpoint: "POST /lancar-pagamento", tabela: "pagamentos" },
  { label: "Conciliacao", status: "pendente", endpoint: "(nao impl.)", tabela: "ap_conciliacao" },
  { label: "Exportacao ERP", status: "implementado", endpoint: "GET /pending", tabela: "export_queue" },
  { label: "Confirmacao ERP", status: "implementado", endpoint: "POST /confirm", tabela: "export_queue" },
];

const FLOW_FUTURO: FlowNode[] = [
  { label: "Entrada de Nota", status: "implementado", endpoint: "POST /incluir", tabela: "contas_pagar" },
  { label: "Validacao", status: "implementado", endpoint: "Rate Limit + Auth", tabela: "-" },
  { label: "Aprovacao Multi", status: "novo", endpoint: "POST /solicitar-aprovacao", tabela: "ap_aprovacoes" },
  { label: "Rateio Auto", status: "novo", endpoint: "POST /regras-rateio", tabela: "ap_regras_rateio" },
  { label: "Agendamento", status: "implementado", endpoint: "PUT /update", tabela: "contas_pagar" },
  { label: "Pagamento", status: "implementado", endpoint: "POST /lancar-pagamento", tabela: "pagamentos" },
  { label: "Conciliacao Auto", status: "novo", endpoint: "POST /conciliar-auto", tabela: "ap_conciliacao" },
  { label: "Conciliacao Manual", status: "em_construcao", endpoint: "POST /conciliar-manual", tabela: "ap_conciliacao" },
  { label: "Exportacao ERP", status: "implementado", endpoint: "GET /pending", tabela: "export_queue" },
  { label: "Confirmacao ERP", status: "implementado", endpoint: "POST /confirm", tabela: "export_queue" },
  { label: "Forecast Caixa", status: "novo", endpoint: "GET /forecast-caixa", tabela: "contas_pagar" },
  { label: "Dashboard KPIs", status: "novo", endpoint: "GET /dashboard-kpis", tabela: "contas_pagar" },
];

// ═══════════════════════════════════════
// COLLAPSIBLE BLOCK
// ═══════════════════════════════════════
function CollapseBlock({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors w-full text-left" style={{ color: "#1e293b" }}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Database className="h-4 w-4" style={{ color: "#64748b" }} />
          {title}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function RelatorioAPModule() {
  const navigate = useNavigate();
  const [filterRelevancia, setFilterRelevancia] = useState<Relevancia | "Todos">("Todos");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeSection, setActiveSection] = useState("header");

  const filteredEndpoints = useMemo(() => {
    if (filterRelevancia === "Todos") return ENDPOINTS_ASIS;
    return ENDPOINTS_ASIS.filter(e => e.relevanciaAP === filterRelevancia);
  }, [filterRelevancia]);

  const counters = useMemo(() => {
    const total = ENDPOINTS_ASIS.length;
    const direto = ENDPOINTS_ASIS.filter(e => e.relevanciaAP === "Direto").length;
    const indireto = ENDPOINTS_ASIS.filter(e => e.relevanciaAP === "Indireto").length;
    const auxiliar = ENDPOINTS_ASIS.filter(e => e.relevanciaAP === "Auxiliar").length;
    const byModulo: Record<string, number> = {};
    ENDPOINTS_ASIS.forEach(e => { byModulo[e.modulo] = (byModulo[e.modulo] || 0) + 1; });
    return { total, direto, indireto, auxiliar, byModulo };
  }, []);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sections = [
    { id: "header", label: "Header" },
    { id: "asis", label: "Cenario Atual" },
    { id: "tobe", label: "Cenario Futuro" },
    { id: "telas", label: "Mapa de Telas" },
    { id: "fluxos", label: "Fluxogramas" },
    { id: "checklist", label: "Checklist" },
    { id: "glossario", label: "Glossario" },
  ];

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <div className="flex gap-6 max-w-7xl mx-auto px-4 py-6">
        {/* Mini nav lateral */}
        <div className="hidden xl:block w-48 shrink-0 no-print">
          <div className="sticky top-4 space-y-1">
            <p className="text-[10px] uppercase tracking-wider font-medium px-2 mb-2" style={{ color: "#94a3b8" }}>Sumario</p>
            {sections.map(s => (
              <button key={s.id} onClick={() => scrollTo(s.id)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  activeSection === s.id ? "font-semibold" : ""
                }`}
                style={{
                  color: activeSection === s.id ? "#1e293b" : "#64748b",
                  backgroundColor: activeSection === s.id ? "#f1f5f9" : "transparent",
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteudo principal */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* ═══ SECAO 1: HEADER ═══ */}
          <div ref={el => { sectionRefs.current["header"] = el; }}>
            <Card className="border-l-4" style={{ borderLeftColor: "#1e293b" }}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-xl font-bold" style={{ color: "#1e293b" }}>
                      Relatorio Tecnico — Modulo Contas a Pagar (AP)
                    </CardTitle>
                    <p className="text-sm mt-1" style={{ color: "#64748b" }}>
                      Mapeamento de APIs, Endpoints, Telas Existentes e Telas Previstas
                    </p>
                  </div>
                  <div className="flex items-center gap-2 no-print">
                    <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1">
                      <ArrowLeft className="h-4 w-4" /> Voltar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
                      <Printer className="h-4 w-4" /> Imprimir
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline" style={{ backgroundColor: "#fff7ed", color: "#92400e", borderColor: "#f59e0b" }}>
                    Status: Em Construcao
                  </Badge>
                  <Badge variant="outline" style={{ backgroundColor: "#f1f5f9", color: "#475569", borderColor: "#94a3b8" }}>
                    Versao: v1.0
                  </Badge>
                  <Badge variant="outline" style={{ backgroundColor: "#f1f5f9", color: "#475569", borderColor: "#94a3b8" }}>
                    Data: {new Date().toLocaleDateString("pt-BR")}
                  </Badge>
                  <Badge variant="outline" style={{ backgroundColor: "#f1f5f9", color: "#475569", borderColor: "#94a3b8" }}>
                    Responsavel: Admin BiMaster
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Endpoints", value: counters.total, color: "#1e293b" },
                    { label: "AP Direto", value: counters.direto, color: "#16a34a" },
                    { label: "AP Indireto", value: counters.indireto, color: "#2563eb" },
                    { label: "Auxiliar", value: counters.auxiliar, color: "#64748b" },
                  ].map(c => (
                    <div key={c.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
                      <div className="text-[11px]" style={{ color: "#64748b" }}>{c.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══ SECAO 2: CENARIO ATUAL (AS-IS) ═══ */}
          <div ref={el => { sectionRefs.current["asis"] = el; }} className="print-break">
            <h2 className="text-lg font-bold mb-4" style={{ color: "#1e293b" }}>
              Secao 2 — Cenario Atual (AS-IS)
            </h2>

            {/* Contadores por modulo */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(counters.byModulo).map(([mod, count]) => (
                <Badge key={mod} variant="outline" className="text-xs" style={{ backgroundColor: "#f8fafc" }}>
                  {mod}: {count}
                </Badge>
              ))}
            </div>

            {/* Filtro de relevancia */}
            <div className="flex gap-2 mb-4 no-print">
              {(["Todos", "Direto", "Indireto", "Auxiliar"] as const).map(f => (
                <Button key={f} variant={filterRelevancia === f ? "default" : "outline"} size="sm"
                  onClick={() => setFilterRelevancia(f)} className="text-xs">
                  {f} {f !== "Todos" && `(${f === "Direto" ? counters.direto : f === "Indireto" ? counters.indireto : counters.auxiliar})`}
                </Button>
              ))}
            </div>

            {/* Tabela de endpoints */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "#1e293b" }}>
                      {["API", "Rota", "Metodo", "Descricao", "Tabela Supabase", "Status", "Tela", "Relevancia"].map(h => (
                        <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#f8fafc" }}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEndpoints.map((ep, i) => (
                      <TableRow key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                        <TableCell className="text-[11px] font-mono" style={{ color: "#475569" }}>{ep.api}</TableCell>
                        <TableCell className="text-[11px] font-mono font-medium">{ep.rota}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${methodColor(ep.metodo)}`}>{ep.metodo}</span>
                        </TableCell>
                        <TableCell className="text-[11px] max-w-[200px] truncate">{ep.descricao}</TableCell>
                        <TableCell className="text-[11px] font-mono" style={{ color: "#64748b" }}>{ep.tabelaSupabase}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor(ep.status)}`}>{ep.status}</span>
                        </TableCell>
                        <TableCell className="text-[11px]" style={{ color: ep.telaFrontend === "-" ? "#94a3b8" : "#1e293b" }}>{ep.telaFrontend}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${relevanciaColor(ep.relevanciaAP)}`}>{ep.relevanciaAP}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Schema colapsavel */}
            <div className="mt-4">
              <CollapseBlock title="Estrutura de banco — tabela contas_pagar (colunas principais)">
                <div className="border rounded-lg overflow-hidden ml-6 mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow style={{ backgroundColor: "#f1f5f9" }}>
                        <TableHead className="text-[11px]">Coluna</TableHead>
                        <TableHead className="text-[11px]">Tipo</TableHead>
                        <TableHead className="text-[11px]">Descricao</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {SCHEMA_CONTAS_PAGAR.map((col, i) => (
                        <TableRow key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                          <TableCell className="text-[11px] font-mono font-medium">{col.coluna}</TableCell>
                          <TableCell className="text-[11px] font-mono" style={{ color: "#64748b" }}>{col.tipo}</TableCell>
                          <TableCell className="text-[11px]">{col.descricao}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapseBlock>
            </div>
          </div>

          {/* ═══ SECAO 3: CENARIO FUTURO (TO-BE) ═══ */}
          <div ref={el => { sectionRefs.current["tobe"] = el; }} className="print-break">
            <h2 className="text-lg font-bold mb-4" style={{ color: "#1e293b" }}>
              Secao 3 — Cenario Futuro (TO-BE)
            </h2>
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "#1e293b" }}>
                      {["Endpoint", "Descricao", "Tabela", "Status", "Nova Tela?", "Campos Input", "Prioridade"].map(h => (
                        <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#f8fafc" }}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ENDPOINTS_FUTUROS.map((ep, i) => (
                      <TableRow key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                        <TableCell className="text-[11px] font-mono font-medium">{ep.rota}</TableCell>
                        <TableCell className="text-[11px] max-w-[180px]">{ep.descricao}</TableCell>
                        <TableCell className="text-[11px] font-mono" style={{ color: "#64748b" }}>{ep.tabelaSupabase}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor(ep.statusConstrucao)}`}>{ep.statusConstrucao}</span>
                        </TableCell>
                        <TableCell className="text-[11px]">{ep.novaTela}</TableCell>
                        <TableCell className="text-[11px] font-mono max-w-[150px] truncate" style={{ color: "#64748b" }}>{ep.camposInput}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${prioridadeColor(ep.prioridade)}`}>{ep.prioridade}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="mt-4">
              <CollapseBlock title="Delta de banco — novas tabelas previstas">
                <div className="ml-6 mt-2 space-y-3">
                  {[
                    { tabela: "ap_aprovacoes", colunas: "id, titulo_id, nivel, aprovador_id, decisao, motivo, created_at" },
                    { tabela: "ap_conciliacao", colunas: "id, titulo_id, lancamento_cc_id, tipo (auto/manual), tolerancia, status, created_at" },
                    { tabela: "ap_regras_rateio", colunas: "id, categoria, departamentos (jsonb), percentuais (jsonb), ativo, created_at" },
                  ].map(t => (
                    <div key={t.tabela} className="border rounded-lg p-3" style={{ backgroundColor: "#f8fafc" }}>
                      <span className="font-mono text-xs font-semibold" style={{ color: "#1e293b" }}>{t.tabela}</span>
                      <p className="text-[11px] font-mono mt-1" style={{ color: "#64748b" }}>{t.colunas}</p>
                    </div>
                  ))}
                </div>
              </CollapseBlock>
            </div>
          </div>

          {/* ═══ SECAO 4: MAPA DE TELAS ═══ */}
          <div ref={el => { sectionRefs.current["telas"] = el; }} className="print-break">
            <h2 className="text-lg font-bold mb-4" style={{ color: "#1e293b" }}>
              Secao 4 — Mapa de Telas (Frontend)
            </h2>
            <Tabs defaultValue="existentes">
              <TabsList className="no-print">
                <TabsTrigger value="existentes">4A — Telas Existentes ({TELAS_EXISTENTES.length})</TabsTrigger>
                <TabsTrigger value="novas">4B — Telas Novas ({TELAS_NOVAS.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="existentes">
                <div className="grid gap-3 mt-3">
                  {TELAS_EXISTENTES.map(t => (
                    <Card key={t.nome} className="border-l-4" style={{ borderLeftColor: t.status === "Funcional" ? "#16a34a" : t.status === "Parcial" ? "#f59e0b" : "#ef4444" }}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-sm" style={{ color: "#1e293b" }}>{t.nome}</h4>
                            <code className="text-[11px] font-mono" style={{ color: "#64748b" }}>{t.rota}</code>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${statusColor(t.status)}`}>{t.status}</span>
                        </div>
                        <div className="mt-2">
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: "#94a3b8" }}>APIs consumidas</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.apisConsumidas.map(a => (
                              <Badge key={a} variant="outline" className="text-[10px] font-mono">{a}</Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="novas">
                <div className="grid gap-3 mt-3">
                  {TELAS_NOVAS.map(t => (
                    <Card key={t.nome} className="border-l-4" style={{
                      borderLeftColor: t.complexidade === "Alta" ? "#ef4444" : t.complexidade === "Media" ? "#f59e0b" : "#2563eb"
                    }}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-sm" style={{ color: "#1e293b" }}>{t.nome}</h4>
                            <code className="text-[11px] font-mono" style={{ color: "#64748b" }}>{t.rotaPrevista}</code>
                          </div>
                          <div className="flex gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${statusColor(t.statusConstrucao)}`}>{t.statusConstrucao}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${
                              t.complexidade === "Alta" ? "bg-red-100 text-red-800 border-red-300" :
                              t.complexidade === "Media" ? "bg-amber-100 text-amber-800 border-amber-300" :
                              "bg-blue-100 text-blue-800 border-blue-300"
                            }`}>{t.complexidade}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: "#94a3b8" }}>APIs consumidas</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.apisConsumidas.map(a => (
                              <Badge key={a} variant="outline" className="text-[10px] font-mono">{a}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: "#94a3b8" }}>Campos de input</span>
                          <div className="mt-1 space-y-0.5">
                            {t.camposInput.map(c => (
                              <div key={c.nome} className="flex items-center gap-2 text-[11px]">
                                <code className="font-mono px-1 py-0.5 rounded" style={{ backgroundColor: "#f1f5f9" }}>{c.nome}</code>
                                <span style={{ color: "#64748b" }}>{c.tipo}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: "#94a3b8" }}>Dependencias</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.dependencias.map(d => (
                              <Badge key={d} variant="outline" className="text-[10px]" style={{ backgroundColor: "#fff7ed", borderColor: "#f59e0b", color: "#92400e" }}>{d}</Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* ═══ SECAO 5: FLUXOGRAMAS ═══ */}
          <div ref={el => { sectionRefs.current["fluxos"] = el; }} className="print-break">
            <h2 className="text-lg font-bold mb-4" style={{ color: "#1e293b" }}>
              Secao 5 — Fluxogramas
            </h2>
            <div className="space-y-6">
              <FlowchartDiagram nodes={FLOW_ATUAL} title="Fluxo 1 — AP Atual (AS-IS)" />
              <FlowchartDiagram nodes={FLOW_FUTURO} title="Fluxo 2 — AP Futuro (TO-BE)" />
            </div>
          </div>

          {/* ═══ SECAO 6: CHECKLIST ═══ */}
          <div ref={el => { sectionRefs.current["checklist"] = el; }} className="print-break">
            <h2 className="text-lg font-bold mb-4" style={{ color: "#1e293b" }}>
              Secao 6 — Checklist de Construcao
            </h2>
            <div className="border rounded-lg divide-y">
              {CHECKLIST.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <Checkbox checked={item.status === "Concluido"} disabled className="pointer-events-none" />
                  <span className="text-sm flex-1" style={{ color: "#1e293b" }}>{item.item}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${
                    item.status === "Concluido" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                    item.status === "Em andamento" ? "bg-amber-100 text-amber-800 border-amber-300" :
                    "bg-slate-100 text-slate-700 border-slate-300"
                  }`}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ SECAO 7: GLOSSARIO ═══ */}
          <div ref={el => { sectionRefs.current["glossario"] = el; }} className="print-break">
            <h2 className="text-lg font-bold mb-4" style={{ color: "#1e293b" }}>
              Secao 7 — Glossario Tecnico
            </h2>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#1e293b" }}>
                    <TableHead className="text-[11px] font-semibold w-32" style={{ color: "#f8fafc" }}>Termo</TableHead>
                    <TableHead className="text-[11px] font-semibold" style={{ color: "#f8fafc" }}>Significado no contexto BiMaster</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {GLOSSARIO.map((g, i) => (
                    <TableRow key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                      <TableCell className="font-semibold text-sm" style={{ color: "#1e293b" }}>{g.termo}</TableCell>
                      <TableCell className="text-sm" style={{ color: "#475569" }}>{g.significado}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
