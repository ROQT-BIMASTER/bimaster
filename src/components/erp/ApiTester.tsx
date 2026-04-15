import { useState, useCallback, useEffect } from "react";
import { apiTesterEventTarget } from "./ApiDocumentation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Terminal, Send, Clock, Trash2, ChevronDown, Copy, Plus, X, FlaskConical, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge as UiBadge } from "@/components/ui/badge";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const DOC_BASE_URL = "https://api.bimaster.online/v1";

/** Converts display URL to real execution URL */
const toRealUrl = (displayUrl: string) => displayUrl.replace(DOC_BASE_URL, BASE_URL);
/** Converts real URL to display URL */
const toDisplayUrl = (realUrl: string) => realUrl.replace(BASE_URL, DOC_BASE_URL);

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  POST: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  PUT: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  DELETE: "bg-red-500/15 text-red-600 border-red-500/30",
};

interface HeaderEntry {
  key: string;
  value: string;
  enabled: boolean;
}

interface ParamEntry {
  key: string;
  value: string;
  enabled: boolean;
}

interface HistoryItem {
  id: string;
  method: HttpMethod;
  url: string;
  status: number;
  duration: number;
  timestamp: Date;
}

interface ApiResponse {
  status: number;
  statusText: string;
  data: unknown;
  duration: number;
  headers: Record<string, string>;
}

const PRESET_ENDPOINTS = [
  { label: "Contas a Pagar — Listar", method: "GET" as HttpMethod, path: "/contas-pagar-api" },
  { label: "Contas a Pagar — Query", method: "GET" as HttpMethod, path: "/contas-pagar-api/query?empresa_id=8&limit=10" },
  { label: "Contas a Pagar — Status", method: "GET" as HttpMethod, path: "/contas-pagar-api/status" },
  { label: "Contas a Pagar — Stats", method: "GET" as HttpMethod, path: "/contas-pagar-api/stats" },
  { label: "Contas a Pagar — Last Sync", method: "GET" as HttpMethod, path: "/contas-pagar-api/last-sync" },
  { label: "Contas a Pagar — Parcelas", method: "GET" as HttpMethod, path: "/contas-pagar-api/parcelas?conta_pagar_id=COLE_O_UUID_AQUI" },
  { label: "Contas a Pagar — Pagamentos", method: "GET" as HttpMethod, path: "/contas-pagar-api/pagamentos?conta_pagar_id=COLE_O_UUID_AQUI" },
  { label: "Contas a Pagar — Anexos", method: "GET" as HttpMethod, path: "/contas-pagar-api/anexos?conta_pagar_id=COLE_O_UUID_AQUI" },
  { label: "Contas a Pagar — Update", method: "PUT" as HttpMethod, path: "/contas-pagar-api/update" },
  { label: "Contas a Pagar — Cancelar", method: "POST" as HttpMethod, path: "/contas-pagar-api/cancelar" },
  { label: "Contas a Pagar — Registrar Pagamento", method: "POST" as HttpMethod, path: "/contas-pagar-api/registrar-pagamento" },
  { label: "Contas a Pagar — Estornar", method: "POST" as HttpMethod, path: "/contas-pagar-api/estornar" },
  // Contas a Pagar — Integração
  { label: "CP Integração — Consultar", method: "GET" as HttpMethod, path: "/contas-pagar-api/consultar?codigo_lancamento_integracao=COLE_O_CODIGO" },
  { label: "CP Integração — Incluir", method: "POST" as HttpMethod, path: "/contas-pagar-api/incluir" },
  { label: "CP Integração — Alterar", method: "PUT" as HttpMethod, path: "/contas-pagar-api/alterar" },
  { label: "CP Integração — Excluir", method: "DELETE" as HttpMethod, path: "/contas-pagar-api/excluir?codigo_lancamento_integracao=COLE_O_CODIGO" },
  { label: "CP Integração — Upsert", method: "POST" as HttpMethod, path: "/contas-pagar-api/upsert" },
  { label: "CP Integração — Upsert Lote", method: "POST" as HttpMethod, path: "/contas-pagar-api/upsert-lote" },
  { label: "CP Integração — Lançar Pagamento", method: "POST" as HttpMethod, path: "/contas-pagar-api/lancar-pagamento" },
  { label: "CP Integração — Cancelar Pagamento", method: "POST" as HttpMethod, path: "/contas-pagar-api/cancelar-pagamento" },
  { label: "CP Integração — Listar", method: "GET" as HttpMethod, path: "/contas-pagar-api/listar?pagina=1&registros_por_pagina=20" },
  // Export
  { label: "Export — Pendentes (Provisão)", method: "GET" as HttpMethod, path: "/contas-pagar-export-api/pending" },
  { label: "Export — Pagos (Baixa)", method: "GET" as HttpMethod, path: "/contas-pagar-export-api/paid" },
  { label: "Export — Cancelados", method: "GET" as HttpMethod, path: "/contas-pagar-export-api/cancelled" },
  { label: "Export — Status", method: "GET" as HttpMethod, path: "/contas-pagar-export-api/status" },
  { label: "Export — Confirmar", method: "POST" as HttpMethod, path: "/contas-pagar-export-api/confirm" },
  { label: "Export — Histórico", method: "GET" as HttpMethod, path: "/contas-pagar-export-api/history?limit=50" },
  { label: "Export — Batch", method: "POST" as HttpMethod, path: "/contas-pagar-export-api/export-batch" },
  { label: "Export — Retry Failed", method: "POST" as HttpMethod, path: "/contas-pagar-export-api/retry-failed" },
  { label: "Export — Reconciliação", method: "GET" as HttpMethod, path: "/contas-pagar-export-api/reconciliation" },
  { label: "Export — Summary", method: "GET" as HttpMethod, path: "/contas-pagar-export-api/export-summary" },
  // Contas Correntes
  { label: "Contas Correntes — Listar", method: "GET" as HttpMethod, path: "/contas-correntes-api/" },
  { label: "Contas Correntes — Resumo", method: "GET" as HttpMethod, path: "/contas-correntes-api/resumo" },
  { label: "Contas Correntes — Consultar", method: "GET" as HttpMethod, path: "/contas-correntes-api/consultar?cCodCCInt=COLE_O_CODIGO" },
  { label: "Contas Correntes — Incluir", method: "POST" as HttpMethod, path: "/contas-correntes-api/incluir" },
  { label: "Contas Correntes — Alterar", method: "PUT" as HttpMethod, path: "/contas-correntes-api/alterar" },
  { label: "Contas Correntes — Excluir", method: "DELETE" as HttpMethod, path: "/contas-correntes-api/excluir?cCodCCInt=COLE_O_CODIGO" },
  { label: "Contas Correntes — Upsert", method: "POST" as HttpMethod, path: "/contas-correntes-api/upsert" },
  { label: "Contas Correntes — Upsert Lote", method: "POST" as HttpMethod, path: "/contas-correntes-api/upsert-lote" },
  { label: "Contas Correntes — Status", method: "GET" as HttpMethod, path: "/contas-correntes-api/status" },
  // Lançamentos de Conta Corrente
  { label: "Lançamentos CC — Listar", method: "GET" as HttpMethod, path: "/lancamentos-cc-api/" },
  { label: "Lançamentos CC — Consultar", method: "GET" as HttpMethod, path: "/lancamentos-cc-api/consultar?cCodIntLanc=COLE_O_CODIGO" },
  { label: "Lançamentos CC — Incluir", method: "POST" as HttpMethod, path: "/lancamentos-cc-api/incluir" },
  { label: "Lançamentos CC — Alterar", method: "PUT" as HttpMethod, path: "/lancamentos-cc-api/alterar" },
  { label: "Lançamentos CC — Excluir", method: "DELETE" as HttpMethod, path: "/lancamentos-cc-api/excluir?cCodIntLanc=COLE_O_CODIGO" },
  { label: "Lançamentos CC — Upsert", method: "POST" as HttpMethod, path: "/lancamentos-cc-api/upsert" },
  { label: "Lançamentos CC — Upsert Lote", method: "POST" as HttpMethod, path: "/lancamentos-cc-api/upsert-lote" },
  { label: "Lançamentos CC — Status", method: "GET" as HttpMethod, path: "/lancamentos-cc-api/status" },
  { label: "Extrato CC — Consultar", method: "GET" as HttpMethod, path: "/lancamentos-cc-api/extrato?nCodCC=427619317&dPeriodoInicial=01/03/2026&dPeriodoFinal=21/03/2026" },
  { label: "Extrato CC — Apenas Saldo", method: "GET" as HttpMethod, path: "/lancamentos-cc-api/extrato?nCodCC=427619317&cExibirApenasSaldo=S" },
  // Contas a Receber — Integração
  { label: "CR Integração — Consultar", method: "GET" as HttpMethod, path: "/contas-receber-api/consultar?codigo_lancamento_integracao=COLE_O_CODIGO" },
  { label: "CR Integração — Listar", method: "GET" as HttpMethod, path: "/contas-receber-api/listar?pagina=1&registros_por_pagina=20" },
  { label: "CR Integração — Incluir", method: "POST" as HttpMethod, path: "/contas-receber-api/incluir" },
  { label: "CR Integração — Alterar", method: "PUT" as HttpMethod, path: "/contas-receber-api/alterar" },
  { label: "CR Integração — Excluir", method: "DELETE" as HttpMethod, path: "/contas-receber-api/excluir?codigo_lancamento_integracao=COLE_O_CODIGO" },
  { label: "CR Integração — Upsert", method: "POST" as HttpMethod, path: "/contas-receber-api/upsert" },
  { label: "CR Integração — Upsert Lote", method: "POST" as HttpMethod, path: "/contas-receber-api/upsert-lote" },
  { label: "CR Integração — Lançar Recebimento", method: "POST" as HttpMethod, path: "/contas-receber-api/lancar-recebimento" },
  { label: "CR Integração — Cancelar Recebimento", method: "POST" as HttpMethod, path: "/contas-receber-api/cancelar-recebimento" },
  { label: "CR Integração — Conciliar", method: "POST" as HttpMethod, path: "/contas-receber-api/conciliar" },
  { label: "CR Integração — Desconciliar", method: "POST" as HttpMethod, path: "/contas-receber-api/desconciliar" },
  { label: "CR Integração — Cancelar", method: "POST" as HttpMethod, path: "/contas-receber-api/cancelar" },
  // Boletos (Cobrança Bancária)
  { label: "Boleto — Gerar", method: "POST" as HttpMethod, path: "/boletos-api/gerar" },
  { label: "Boleto — Obter", method: "GET" as HttpMethod, path: "/boletos-api/obter?cCodIntTitulo=COLE_O_CODIGO" },
  { label: "Boleto — Cancelar", method: "POST" as HttpMethod, path: "/boletos-api/cancelar" },
  { label: "Boleto — Prorrogar", method: "POST" as HttpMethod, path: "/boletos-api/prorrogar" },
  { label: "Boleto — Listar", method: "GET" as HttpMethod, path: "/boletos-api/listar?pagina=1&registros_por_pagina=20" },
  { label: "Boleto — Status", method: "GET" as HttpMethod, path: "/boletos-api/status" },
  // Anexos de Documentos
  { label: "Anexo — Incluir", method: "POST" as HttpMethod, path: "/anexos-api/incluir" },
  { label: "Anexo — Consultar", method: "GET" as HttpMethod, path: "/anexos-api/consultar?cTabela=contas_receber&nId=0" },
  { label: "Anexo — Obter (Download)", method: "GET" as HttpMethod, path: "/anexos-api/obter?cCodIntAnexo=COLE_O_CODIGO" },
  { label: "Anexo — Listar", method: "GET" as HttpMethod, path: "/anexos-api/listar?cTabela=contas_receber&nId=0&nPagina=1&nRegPorPagina=50" },
  { label: "Anexo — Excluir", method: "DELETE" as HttpMethod, path: "/anexos-api/excluir" },
  { label: "Anexo — Status", method: "GET" as HttpMethod, path: "/anexos-api/status" },
  // Orçamento de Caixa (Previsto x Realizado)
  { label: "Orçamento — Listar", method: "GET" as HttpMethod, path: "/orcamentos-caixa-api/listar?nAno=2026&nMes=3" },
  { label: "Orçamento — Incluir", method: "POST" as HttpMethod, path: "/orcamentos-caixa-api/incluir" },
  { label: "Orçamento — Incluir Lote", method: "POST" as HttpMethod, path: "/orcamentos-caixa-api/incluir-lote" },
  { label: "Orçamento — Status", method: "GET" as HttpMethod, path: "/orcamentos-caixa-api/status" },
  // Pesquisar Lançamentos (Unificado)
  { label: "Pesquisar — Lançamentos", method: "POST" as HttpMethod, path: "/pesquisar-lancamentos-api/pesquisar" },
  { label: "Pesquisar — Status", method: "GET" as HttpMethod, path: "/pesquisar-lancamentos-api/status" },
  // Movimentos Financeiros (ListarMovimentos)
  { label: "Movimentos — Listar", method: "POST" as HttpMethod, path: "/movimentos-financeiros-api/listar" },
  { label: "Movimentos — Status", method: "GET" as HttpMethod, path: "/movimentos-financeiros-api/status" },
  // Resumo Financeiro (Dashboard)
  { label: "Resumo — ObterResumoFinancas", method: "POST" as HttpMethod, path: "/resumo-financeiro-api/resumo" },
  { label: "Resumo — Em Aberto", method: "POST" as HttpMethod, path: "/resumo-financeiro-api/em-aberto" },
  { label: "Resumo — Lista Finanças", method: "POST" as HttpMethod, path: "/resumo-financeiro-api/lista-financas" },
  { label: "Resumo — Detalhes Lançamento", method: "POST" as HttpMethod, path: "/resumo-financeiro-api/detalhes" },
  { label: "Resumo — Status", method: "GET" as HttpMethod, path: "/resumo-financeiro-api/status" },
  // Bancos (ConsultarBanco + ListarBancos)
  { label: "Bancos — Consultar", method: "GET" as HttpMethod, path: "/bancos-api/consultar?codigo=001" },
  { label: "Bancos — Listar", method: "GET" as HttpMethod, path: "/bancos-api/listar?pagina=1&registros_por_pagina=100" },
  { label: "Bancos — Status", method: "GET" as HttpMethod, path: "/bancos-api/status" },
  // Tipos de Documento (ConsultarTipoDocumento + PesquisarTipoDocumento)
  { label: "Tipo Doc — Consultar", method: "GET" as HttpMethod, path: "/tipos-documento-api/consultar?codigo=NF" },
  { label: "Tipo Doc — Pesquisar", method: "POST" as HttpMethod, path: "/tipos-documento-api/pesquisar" },
  { label: "Tipo Doc — Status", method: "GET" as HttpMethod, path: "/tipos-documento-api/status" },
  // DRE Cadastro (ListarCadastroDRE)
  { label: "DRE — Listar", method: "POST" as HttpMethod, path: "/dre-cadastro-api/listar" },
  { label: "DRE — Status", method: "GET" as HttpMethod, path: "/dre-cadastro-api/status" },
  // Finalidades de Transferência (ConsultarFinalTransf + ListarFinalTransf)
  { label: "Final. Transf. — Consultar", method: "GET" as HttpMethod, path: "/finalidades-transferencia-api/consultar?codigo=01" },
  { label: "Final. Transf. — Listar", method: "GET" as HttpMethod, path: "/finalidades-transferencia-api/listar?pagina=1&registros_por_pagina=50" },
  { label: "Final. Transf. — Status", method: "GET" as HttpMethod, path: "/finalidades-transferencia-api/status" },
  // Origens de Lançamento (ListarOrigem)
  { label: "Origens — Listar", method: "POST" as HttpMethod, path: "/origens-api/listar" },
  { label: "Origens — Status", method: "GET" as HttpMethod, path: "/origens-api/status" },
  // Bandeiras de Cartão (ListarBandeiras)
  { label: "Bandeiras — Listar", method: "GET" as HttpMethod, path: "/bandeiras-api/listar?nPagina=1&nRegPorPagina=50" },
  { label: "Bandeiras — Status", method: "GET" as HttpMethod, path: "/bandeiras-api/status" },
  // Clientes (CRUD Completo)
  { label: "Clientes — Listar", method: "POST" as HttpMethod, path: "/clientes-api/listar" },
  { label: "Clientes — Listar Resumido", method: "POST" as HttpMethod, path: "/clientes-api/listar-resumido" },
  { label: "Clientes — Consultar", method: "POST" as HttpMethod, path: "/clientes-api/consultar" },
  { label: "Clientes — Incluir", method: "POST" as HttpMethod, path: "/clientes-api/incluir" },
  { label: "Clientes — Alterar", method: "POST" as HttpMethod, path: "/clientes-api/alterar" },
  { label: "Clientes — Excluir", method: "POST" as HttpMethod, path: "/clientes-api/excluir" },
  { label: "Clientes — Upsert", method: "POST" as HttpMethod, path: "/clientes-api/upsert" },
  { label: "Clientes — Upsert CPF/CNPJ", method: "POST" as HttpMethod, path: "/clientes-api/upsert-cpfcnpj" },
  { label: "Clientes — Associar Código", method: "POST" as HttpMethod, path: "/clientes-api/associar" },
  { label: "Clientes — Status", method: "GET" as HttpMethod, path: "/clientes-api/status" },
  // Características de Clientes
  { label: "Caract. Cliente — Incluir", method: "POST" as HttpMethod, path: "/clientes-api/caract/incluir" },
  { label: "Caract. Cliente — Alterar", method: "POST" as HttpMethod, path: "/clientes-api/caract/alterar" },
  { label: "Caract. Cliente — Consultar", method: "POST" as HttpMethod, path: "/clientes-api/caract/consultar" },
  { label: "Caract. Cliente — Excluir", method: "POST" as HttpMethod, path: "/clientes-api/caract/excluir" },
  { label: "Caract. Cliente — Excluir Todas", method: "POST" as HttpMethod, path: "/clientes-api/caract/excluir-todas" },
  // Tags de Clientes
  { label: "Tags Cliente — Incluir", method: "POST" as HttpMethod, path: "/clientes-api/tags/incluir" },
  { label: "Tags Cliente — Listar", method: "POST" as HttpMethod, path: "/clientes-api/tags/listar" },
  { label: "Tags Cliente — Excluir", method: "POST" as HttpMethod, path: "/clientes-api/tags/excluir" },
  { label: "Tags Cliente — Excluir Todas", method: "POST" as HttpMethod, path: "/clientes-api/tags/excluir-todas" },
  // Projetos (CRUD Completo)
  { label: "Projetos — Incluir", method: "POST" as HttpMethod, path: "/projetos-api/incluir" },
  { label: "Projetos — Alterar", method: "POST" as HttpMethod, path: "/projetos-api/alterar" },
  { label: "Projetos — Consultar", method: "POST" as HttpMethod, path: "/projetos-api/consultar" },
  { label: "Projetos — Excluir", method: "POST" as HttpMethod, path: "/projetos-api/excluir" },
  { label: "Projetos — Listar", method: "POST" as HttpMethod, path: "/projetos-api/listar" },
  { label: "Projetos — Upsert", method: "POST" as HttpMethod, path: "/projetos-api/upsert" },
  { label: "Projetos — Status", method: "GET" as HttpMethod, path: "/projetos-api/status" },
  // Empresas (CRUD Completo)
  { label: "Empresas — Incluir", method: "POST" as HttpMethod, path: "/empresas-api/incluir" },
  { label: "Empresas — Alterar", method: "POST" as HttpMethod, path: "/empresas-api/alterar" },
  { label: "Empresas — Consultar", method: "POST" as HttpMethod, path: "/empresas-api/consultar" },
  { label: "Empresas — Listar", method: "POST" as HttpMethod, path: "/empresas-api/listar" },
  { label: "Empresas — Status", method: "GET" as HttpMethod, path: "/empresas-api/status" },
  // Departamentos (CRUD Completo)
  { label: "Departamentos — Incluir", method: "POST" as HttpMethod, path: "/departamentos-api/incluir" },
  { label: "Departamentos — Alterar", method: "POST" as HttpMethod, path: "/departamentos-api/alterar" },
  { label: "Departamentos — Consultar", method: "POST" as HttpMethod, path: "/departamentos-api/consultar" },
  { label: "Departamentos — Excluir", method: "POST" as HttpMethod, path: "/departamentos-api/excluir" },
  { label: "Departamentos — Listar", method: "POST" as HttpMethod, path: "/departamentos-api/listar" },
  { label: "Departamentos — Status", method: "GET" as HttpMethod, path: "/departamentos-api/status" },
  // Categorias (CRUD Completo)
  { label: "Categorias — Incluir", method: "POST" as HttpMethod, path: "/categorias-api/incluir" },
  { label: "Categorias — Incluir Grupo", method: "POST" as HttpMethod, path: "/categorias-api/incluir-grupo" },
  { label: "Categorias — Alterar", method: "POST" as HttpMethod, path: "/categorias-api/alterar" },
  { label: "Categorias — Alterar Grupo", method: "POST" as HttpMethod, path: "/categorias-api/alterar-grupo" },
  { label: "Categorias — Consultar", method: "POST" as HttpMethod, path: "/categorias-api/consultar" },
  { label: "Categorias — Listar", method: "POST" as HttpMethod, path: "/categorias-api/listar" },
  { label: "Categorias — Status", method: "GET" as HttpMethod, path: "/categorias-api/status" },
  // Parcelas (Condições de Pagamento)
  { label: "Parcelas — Incluir", method: "POST" as HttpMethod, path: "/parcelas-api/incluir" },
  { label: "Parcelas — Listar", method: "POST" as HttpMethod, path: "/parcelas-api/listar" },
  { label: "Parcelas — Status", method: "GET" as HttpMethod, path: "/parcelas-api/status" },
  // Tipos de Atividade
  { label: "Tipos Atividade — Listar", method: "POST" as HttpMethod, path: "/tipos-atividade-api/listar" },
  { label: "Tipos Atividade — Status", method: "GET" as HttpMethod, path: "/tipos-atividade-api/status" },
  // Tipos de Anexo
  { label: "Tipos Anexo — Listar", method: "POST" as HttpMethod, path: "/tipos-anexo-api/listar" },
  { label: "Tipos Anexo — Status", method: "GET" as HttpMethod, path: "/tipos-anexo-api/status" },
  // CNAE
  { label: "CNAE — Listar", method: "POST" as HttpMethod, path: "/cnae-api/listar" },
  { label: "CNAE — Status", method: "GET" as HttpMethod, path: "/cnae-api/status" },
  // Cidades (PesquisarCidades)
  { label: "Cidades — Listar", method: "POST" as HttpMethod, path: "/cidades-api/listar" },
  { label: "Cidades — Status", method: "GET" as HttpMethod, path: "/cidades-api/status" },
  // Países (ListarPaises)
  { label: "Países — Listar", method: "POST" as HttpMethod, path: "/paises-api/listar" },
  { label: "Países — Status", method: "GET" as HttpMethod, path: "/paises-api/status" },
  // Tipos de Entrega (CRUD Completo)
  { label: "Tipos Entrega — Incluir", method: "POST" as HttpMethod, path: "/tipos-entrega-api/incluir" },
  { label: "Tipos Entrega — Alterar", method: "POST" as HttpMethod, path: "/tipos-entrega-api/alterar" },
  { label: "Tipos Entrega — Consultar", method: "POST" as HttpMethod, path: "/tipos-entrega-api/consultar" },
  { label: "Tipos Entrega — Excluir", method: "POST" as HttpMethod, path: "/tipos-entrega-api/excluir" },
  { label: "Tipos Entrega — Listar", method: "POST" as HttpMethod, path: "/tipos-entrega-api/listar" },
  { label: "Tipos Entrega — Status", method: "GET" as HttpMethod, path: "/tipos-entrega-api/status" },
  // Fornecedores (Query)
  { label: "Fornecedores — Listar", method: "GET" as HttpMethod, path: "/erp-fornecedores-query/" },
  { label: "Fornecedores — Buscar CNPJ", method: "GET" as HttpMethod, path: "/erp-fornecedores-query/?cnpj=12345678000190" },
  // Fornecedores (Sync)
  { label: "Fornecedores Sync — Consultar ERP", method: "POST" as HttpMethod, path: "/erp-fornecedores-sync/consultar" },
  { label: "Fornecedores Sync — Cadastrar ERP", method: "POST" as HttpMethod, path: "/erp-fornecedores-sync/cadastrar" },
  { label: "Fornecedores Sync — Sync Bidirecional", method: "POST" as HttpMethod, path: "/erp-fornecedores-sync/sync-bidirecional" },
  { label: "Fornecedores Sync — Cadastrar Todas", method: "POST" as HttpMethod, path: "/erp-fornecedores-sync/cadastrar-todas" },
  // Plano de Contas
  { label: "Plano de Contas — Listar", method: "GET" as HttpMethod, path: "/erp-plano-contas-api/" },
  // Portadores
  { label: "Portadores — Listar", method: "GET" as HttpMethod, path: "/erp-portadores-api/" },
  { label: "Portadores — Sync", method: "POST" as HttpMethod, path: "/erp-portadores-api/sync" },
  // Webhook Subscriptions
  { label: "Webhook Sub — Eventos Disponíveis", method: "GET" as HttpMethod, path: "/webhook-subscriptions-api/eventos" },
  { label: "Webhook Sub — Listar", method: "GET" as HttpMethod, path: "/webhook-subscriptions-api/listar" },
  { label: "Webhook Sub — Consultar", method: "GET" as HttpMethod, path: "/webhook-subscriptions-api/consultar?id=COLE_O_UUID" },
  { label: "Webhook Sub — Incluir", method: "POST" as HttpMethod, path: "/webhook-subscriptions-api/incluir" },
  { label: "Webhook Sub — Alterar", method: "PUT" as HttpMethod, path: "/webhook-subscriptions-api/alterar" },
  { label: "Webhook Sub — Excluir", method: "DELETE" as HttpMethod, path: "/webhook-subscriptions-api/excluir?id=COLE_O_UUID" },
  { label: "Webhook Sub — Testar", method: "POST" as HttpMethod, path: "/webhook-subscriptions-api/testar" },
  { label: "Webhook Sub — Status", method: "GET" as HttpMethod, path: "/webhook-subscriptions-api/status" },
  // Webhook Dispatcher
  { label: "Webhook Dispatch — Processar Fila", method: "POST" as HttpMethod, path: "/webhook-dispatcher/process" },
  { label: "Webhook Dispatch — Retry Dead", method: "POST" as HttpMethod, path: "/webhook-dispatcher/retry-dead" },
  { label: "Webhook Dispatch — Stats", method: "GET" as HttpMethod, path: "/webhook-dispatcher/stats" },
  { label: "Webhook Dispatch — Status", method: "GET" as HttpMethod, path: "/webhook-dispatcher/status" },
];

const BODY_TEMPLATES: Record<string, string> = {
  "/contas-pagar-api/cancelar": JSON.stringify({ ids: ["uuid-1"], motivo: "Duplicidade de lançamento" }, null, 2),
  "/contas-pagar-api/registrar-pagamento": JSON.stringify({ conta_pagar_id: "uuid", valor_pago: 1500.00, data_pagamento: "2026-03-21", metodo_pagamento: "PIX" }, null, 2),
  "/contas-pagar-api/estornar": JSON.stringify({ id: "uuid", motivo: "Pagamento devolvido", valor_estorno: 500.00 }, null, 2),
  "/contas-pagar-api/update": JSON.stringify({ id: "uuid", data_vencimento: "2026-04-15", portador: "Banco Itaú" }, null, 2),
  // Integração Contas a Pagar
  "/contas-pagar-api/incluir": JSON.stringify({ codigo_lancamento_integracao: "INT-001", codigo_cliente_fornecedor: 4214850, data_vencimento: "21/03/2026", valor_documento: 100, codigo_categoria: "2.04.01", data_previsao: "21/03/2026", id_conta_corrente: 4243124 }, null, 2),
  "/contas-pagar-api/alterar": JSON.stringify({ codigo_lancamento_integracao: "INT-001", valor_documento: 150, data_vencimento: "30/04/2026" }, null, 2),
  "/contas-pagar-api/upsert": JSON.stringify({ codigo_lancamento_integracao: "INT-001", empresa_id: 8, codigo_cliente_fornecedor: 4214850, data_vencimento: "21/03/2026", valor_documento: 100, codigo_categoria: "2.04.01", data_previsao: "21/03/2026", id_conta_corrente: 4243124 }, null, 2),
  "/contas-pagar-api/upsert-lote": JSON.stringify({ lote: 1, conta_pagar_cadastro: [{ codigo_lancamento_integracao: "INT-001", empresa_id: 8, codigo_cliente_fornecedor: 4214850, data_vencimento: "21/03/2026", valor_documento: 100, codigo_categoria: "2.04.01" }] }, null, 2),
  "/contas-pagar-api/lancar-pagamento": JSON.stringify({ codigo_lancamento_integracao: "INT-001", valor: 100.20, desconto: 0, juros: 0, multa: 0, data: "21/03/2026", observacao: "Baixa via API" }, null, 2),
  "/contas-pagar-api/cancelar-pagamento": JSON.stringify({ codigo_baixa: "uuid-pagamento" }, null, 2),
  // Export
  "/contas-pagar-export-api/confirm": JSON.stringify({ ids: ["uuid-1"], export_type: "registration" }, null, 2),
  "/contas-pagar-export-api/export-batch": JSON.stringify({ ids: ["uuid-1", "uuid-2"], channel: "rest_api", export_type: "payment" }, null, 2),
  "/contas-pagar-export-api/retry-failed": JSON.stringify({ channel: "rest_api" }, null, 2),
  // Contas Correntes
  "/contas-correntes-api/incluir": JSON.stringify({ cCodCCInt: "MyCC0001", tipo_conta_corrente: "CC", codigo_banco: "341", descricao: "Conta Principal Itaú", codigo_agencia: "1234", numero_conta_corrente: "56789-0", saldo_inicial: 10000, pix_sn: "S" }, null, 2),
  "/contas-correntes-api/alterar": JSON.stringify({ cCodCCInt: "MyCC0001", descricao: "Conta Itaú Atualizada", valor_limite: 75000 }, null, 2),
  "/contas-correntes-api/upsert": JSON.stringify({ cCodCCInt: "MyCC0001", tipo_conta_corrente: "CC", codigo_banco: "341", descricao: "Conta Itaú", saldo_inicial: 10000 }, null, 2),
  "/contas-correntes-api/upsert-lote": JSON.stringify({ lote: 1, fin_conta_corrente_cadastro: [{ cCodCCInt: "MyCC0001", tipo_conta_corrente: "CX", codigo_banco: "999", descricao: "Caixinha", saldo_inicial: 0 }] }, null, 2),
  // Lançamentos CC
  "/lancamentos-cc-api/incluir": JSON.stringify({ cCodIntLanc: "LANC001", cabecalho: { nCodCC: 427619317, dDtLanc: "21/03/2026", nValorLanc: 123.46 }, detalhes: { cCodCateg: "1.01.02", cTipo: "DIN", nCodCliente: 2485994, cObs: "Referente a jardinagem" } }, null, 2),
  "/lancamentos-cc-api/alterar": JSON.stringify({ cCodIntLanc: "LANC001", cabecalho: { nValorLanc: 200.00 }, detalhes: { cObs: "Valor corrigido" } }, null, 2),
  "/lancamentos-cc-api/upsert": JSON.stringify({ cCodIntLanc: "LANC001", cabecalho: { nCodCC: 427619317, dDtLanc: "21/03/2026", nValorLanc: 123.46 }, detalhes: { cCodCateg: "1.01.02", cTipo: "DIN", cObs: "Lançamento via API" } }, null, 2),
  "/lancamentos-cc-api/upsert-lote": JSON.stringify({ lote: 1, lancamentos: [{ cCodIntLanc: "LANC001", cabecalho: { nCodCC: 427619317, dDtLanc: "21/03/2026", nValorLanc: 100 }, detalhes: { cCodCateg: "1.01.02", cTipo: "DIN" } }] }, null, 2),
  // Contas a Receber — Integração
  "/contas-receber-api/incluir": JSON.stringify({ codigo_lancamento_integracao: "CR-001", codigo_cliente_fornecedor: 4214850, data_vencimento: "21/03/2026", valor_documento: 100, codigo_categoria: "1.01.02", data_previsao: "21/03/2026", id_conta_corrente: 4243124 }, null, 2),
  "/contas-receber-api/alterar": JSON.stringify({ codigo_lancamento_integracao: "CR-001", valor_documento: 150, data_vencimento: "30/04/2026" }, null, 2),
  "/contas-receber-api/upsert": JSON.stringify({ codigo_lancamento_integracao: "CR-001", empresa_id: 8, codigo_cliente_fornecedor: 4214850, data_vencimento: "21/03/2026", valor_documento: 100, codigo_categoria: "1.01.02", data_previsao: "21/03/2026", id_conta_corrente: 4243124 }, null, 2),
  "/contas-receber-api/upsert-lote": JSON.stringify({ lote: 1, conta_receber_cadastro: [{ codigo_lancamento_integracao: "CR-001", empresa_id: 8, codigo_cliente_fornecedor: 4214850, data_vencimento: "21/03/2026", valor_documento: 100, codigo_categoria: "1.01.02" }] }, null, 2),
  "/contas-receber-api/lancar-recebimento": JSON.stringify({ codigo_lancamento_integracao: "CR-001", valor: 100.20, desconto: 0, juros: 0, multa: 0, data: "21/03/2026", observacao: "Baixa via API" }, null, 2),
  "/contas-receber-api/cancelar-recebimento": JSON.stringify({ codigo_baixa: 0 }, null, 2),
  "/contas-receber-api/conciliar": JSON.stringify({ codigo_baixa: 0 }, null, 2),
  "/contas-receber-api/cancelar": JSON.stringify({ chave_lancamento: 0 }, null, 2),
  // Boletos
  "/boletos-api/gerar": JSON.stringify({ nCodTitulo: 0, cCodIntTitulo: "CR-001", nPerJuros: 2.0, nPerMulta: 2.0 }, null, 2),
  "/boletos-api/cancelar": JSON.stringify({ nCodTitulo: 0, cCodIntTitulo: "CR-001" }, null, 2),
  "/boletos-api/prorrogar": JSON.stringify({ nCodTitulo: 0, cCodIntTitulo: "CR-001", dDtVenc: "30/04/2026" }, null, 2),
  // Anexos
  "/anexos-api/incluir": JSON.stringify({ cCodIntAnexo: "ANX-001", cTabela: "contas_receber", nId: 12345, cNomeArquivo: "comprovante.pdf", cTipoArquivo: "pdf", cArquivo: "<base64_do_arquivo_zipado>", cMd5: "" }, null, 2),
  "/anexos-api/excluir": JSON.stringify({ cCodIntAnexo: "ANX-001", cTabela: "contas_receber", nId: 12345 }, null, 2),
  // Orçamento de Caixa
  "/orcamentos-caixa-api/incluir": JSON.stringify({ nAno: 2026, nMes: 3, cCodCateg: "2.04.01", cDesCateg: "Serviços Terceiros", nValorPrevisto: 5000.00 }, null, 2),
  "/orcamentos-caixa-api/incluir-lote": JSON.stringify({ nAno: 2026, nMes: 3, orcamentos: [{ cCodCateg: "2.04.01", cDesCateg: "Serviços Terceiros", nValorPrevisto: 5000.00 }, { cCodCateg: "1.01.02", cDesCateg: "Vendas de Produtos", nValorPrevisto: 25000.00 }] }, null, 2),
  // Pesquisar Lançamentos
  "/pesquisar-lancamentos-api/pesquisar": JSON.stringify({ nPagina: 1, nRegPorPagina: 20, cNatureza: "R", cStatus: "pendente", dDtVencDe: "01/01/2026", dDtVencAte: "31/03/2026", cOrdenarPor: "data_vencimento", cOrdemDecrescente: "S" }, null, 2),
  // Movimentos Financeiros
  "/movimentos-financeiros-api/listar": JSON.stringify({ nPagina: 1, nRegPorPagina: 20, cTpLancamento: "", cExibirDepartamentos: "S", lDadosCad: true, dDtVencDe: "01/01/2026", dDtVencAte: "31/03/2026" }, null, 2),
  // Tipos de Documento
  "/tipos-documento-api/pesquisar": JSON.stringify({ codigo: "" }, null, 2),
  // DRE Cadastro
  "/dre-cadastro-api/listar": JSON.stringify({ apenasContasAtivas: "S" }, null, 2),
  // Clientes
  "/clientes-api/listar": JSON.stringify({ pagina: 1, registros_por_pagina: 50, clientesFiltro: { inativo: "N" } }, null, 2),
  "/clientes-api/listar-resumido": JSON.stringify({ pagina: 1, registros_por_pagina: 50 }, null, 2),
  "/clientes-api/consultar": JSON.stringify({ codigo_cliente_integracao: "CLI001" }, null, 2),
  "/clientes-api/incluir": JSON.stringify({ codigo_cliente_integracao: "CLI001", razao_social: "Empresa ABC Ltda", nome_fantasia: "ABC", cnpj_cpf: "12.345.678/0001-90", email: "contato@abc.com", telefone1_numero: "11999998888", endereco: "Rua das Flores, 100", cidade: "São Paulo", estado: "SP", cep: "01000-000" }, null, 2),
  "/clientes-api/alterar": JSON.stringify({ codigo_cliente_integracao: "CLI001", nome_fantasia: "ABC Atualizado", email: "novo@abc.com" }, null, 2),
  "/clientes-api/excluir": JSON.stringify({ codigo_cliente_integracao: "CLI001" }, null, 2),
  "/clientes-api/upsert": JSON.stringify({ codigo_cliente_integracao: "CLI001", razao_social: "Empresa ABC Ltda", cnpj_cpf: "12.345.678/0001-90", email: "contato@abc.com" }, null, 2),
  "/clientes-api/upsert-cpfcnpj": JSON.stringify({ cnpj_cpf: "12.345.678/0001-90", razao_social: "Empresa ABC Ltda", email: "contato@abc.com" }, null, 2),
  "/clientes-api/associar": JSON.stringify({ codigo_cliente_huggs: "uuid-do-cliente", codigo_cliente_integracao: "CLI001" }, null, 2),
  // Características de Clientes
  "/clientes-api/caract/incluir": JSON.stringify({ codigo_cliente_integracao: "CLI001", campo: "SEGMENTO", conteudo: "Varejo" }, null, 2),
  "/clientes-api/caract/alterar": JSON.stringify({ codigo_cliente_integracao: "CLI001", campo: "SEGMENTO", conteudo: "Atacado" }, null, 2),
  "/clientes-api/caract/consultar": JSON.stringify({ codigo_cliente_integracao: "CLI001" }, null, 2),
  "/clientes-api/caract/excluir": JSON.stringify({ codigo_cliente_integracao: "CLI001", campo: "SEGMENTO" }, null, 2),
  "/clientes-api/caract/excluir-todas": JSON.stringify({ codigo_cliente_integracao: "CLI001" }, null, 2),
  // Tags de Clientes
  "/clientes-api/tags/incluir": JSON.stringify({ nCodCliente: 0, cCodIntCliente: "CLI001", tags: [{ tag: "Grupo A" }, { tag: "Grupo B" }] }, null, 2),
  "/clientes-api/tags/listar": JSON.stringify({ cCodIntCliente: "CLI001" }, null, 2),
  "/clientes-api/tags/excluir": JSON.stringify({ cCodIntCliente: "CLI001", tags: [{ tag: "Grupo A" }] }, null, 2),
  "/clientes-api/tags/excluir-todas": JSON.stringify({ cCodIntCliente: "CLI001" }, null, 2),
  // Projetos
  "/projetos-api/incluir": JSON.stringify({ codInt: "PROJ-001", nome: "Projeto Alpha", inativo: "N" }, null, 2),
  "/projetos-api/alterar": JSON.stringify({ codInt: "PROJ-001", nome: "Projeto Alpha Atualizado" }, null, 2),
  "/projetos-api/consultar": JSON.stringify({ codInt: "PROJ-001" }, null, 2),
  "/projetos-api/excluir": JSON.stringify({ codInt: "PROJ-001" }, null, 2),
  "/projetos-api/listar": JSON.stringify({ pagina: 1, registros_por_pagina: 50, nome_projeto: "", apenas_importado_api: "N" }, null, 2),
  "/projetos-api/upsert": JSON.stringify({ codInt: "PROJ-001", nome: "Projeto Alpha", inativo: "N" }, null, 2),
  // Empresas (CRUD Completo)
  "/empresas-api/incluir": JSON.stringify({ razao_social: "Empresa ABC Ltda", nome_fantasia: "ABC", cnpj: "12.345.678/0001-90", codigo_empresa_integracao: "EMP001", codigo_erp: "12345", regime_apuracao: "Competência", tipo_empresa: "Matriz", natureza_juridica: "Ltda", porte: "EPP", capital_social: 100000.00, data_abertura: "2020-01-15", codigo_ibge_municipio: 3550308, responsavel_nome: "João Silva", responsavel_cpf: "123.456.789-00", inscricao_estadual: "123456789", regime_tributario: "Lucro Presumido", endereco: "Rua das Flores", endereco_numero: "100", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01000-000", email: "contato@abc.com", telefone1_ddd: "11", telefone1_numero: "999998888" }, null, 2),
  "/empresas-api/alterar": JSON.stringify({ codigo_empresa: 8, razao_social: "Empresa ABC Ltda Atualizada", regime_apuracao: "Caixa", porte: "ME" }, null, 2),
  "/empresas-api/consultar": JSON.stringify({ codigo_empresa: 8 }, null, 2),
  "/empresas-api/listar": JSON.stringify({ pagina: 1, registros_por_pagina: 100 }, null, 2),
  // Departamentos
  "/departamentos-api/incluir": JSON.stringify({ codigo: "000000000723648", descricao: "Marketing Digital" }, null, 2),
  "/departamentos-api/alterar": JSON.stringify({ codigo: "000000000723648", descricao: "Marketing Digital Atualizado" }, null, 2),
  "/departamentos-api/consultar": JSON.stringify({ codigo: "000000000723648" }, null, 2),
  "/departamentos-api/excluir": JSON.stringify({ codigo: "000000000723648" }, null, 2),
  "/departamentos-api/listar": JSON.stringify({ pagina: 1, registros_por_pagina: 50 }, null, 2),
  // Categorias
  "/categorias-api/incluir": JSON.stringify({ descricao: "Serviços Terceiros", tipo_categoria: "D", natureza: "Despesas com serviços de terceiros", codigo_dre: "3.01.01", categoria_superior: "" }, null, 2),
  "/categorias-api/incluir-grupo": JSON.stringify({ descricao: "Despesas Operacionais", tipo_grupo: "D", natureza: "Grupo de despesas operacionais" }, null, 2),
  "/categorias-api/alterar": JSON.stringify({ codigo: "CAT-001", descricao: "Serviços Terceiros Atualizado", tipo_categoria: "D" }, null, 2),
  "/categorias-api/alterar-grupo": JSON.stringify({ codigo: "GRP-001", descricao: "Despesas Operacionais Atualizado" }, null, 2),
  "/categorias-api/consultar": JSON.stringify({ codigo: "CAT-001" }, null, 2),
  "/categorias-api/listar": JSON.stringify({ pagina: 1, registros_por_pagina: 50, filtrar_apenas_ativo: "S", filtrar_por_tipo: "" }, null, 2),
  // Parcelas
  "/parcelas-api/incluir": JSON.stringify({ cParcela: "30/60/90" }, null, 2),
  "/parcelas-api/listar": JSON.stringify({ pagina: 1, registros_por_pagina: 50 }, null, 2),
  // Tipos de Atividade
  "/tipos-atividade-api/listar": JSON.stringify({ filtrar_por_codigo: "", filtrar_por_descricao: "" }, null, 2),
  // Tipos de Anexo
  "/tipos-anexo-api/listar": JSON.stringify({ codigo: "" }, null, 2),
  // CNAE
  "/cnae-api/listar": JSON.stringify({ pagina: 1, registros_por_pagina: 50, ordenar_por: "codigo", ordem_decrescente: "N" }, null, 2),
  // Cidades
  "/cidades-api/listar": JSON.stringify({ pagina: 1, registros_por_pagina: 50, filtrar_cidade_contendo: "", filtrar_por_uf: "", ordenar_por: "nome", ordem_descrescente: "N" }, null, 2),
  // Tipos de Entrega
  "/tipos-entrega-api/incluir": JSON.stringify({ nCodTransp: 0, cCodIntEntrega: "", cDescricao: "Entrega Normal", cInativo: "N" }, null, 2),
  "/tipos-entrega-api/alterar": JSON.stringify({ nCodEntrega: 0, cCodIntEntrega: "", cDescricao: "Entrega Expressa", cInativo: "N" }, null, 2),
  "/tipos-entrega-api/consultar": JSON.stringify({ nCodEntrega: 0, cCodIntEntrega: "" }, null, 2),
  "/tipos-entrega-api/excluir": JSON.stringify({ nCodEntrega: 0, cCodIntEntrega: "" }, null, 2),
  "/tipos-entrega-api/listar": JSON.stringify({ nPagina: 1, nRegistrosPorPagina: 50, nCodTransp: 0 }, null, 2),
  // Fornecedores Sync
  "/erp-fornecedores-sync/consultar": JSON.stringify({ cnpj: "12.345.678/0001-90" }, null, 2),
  "/erp-fornecedores-sync/cadastrar": JSON.stringify({ cnpj: "12.345.678/0001-90", razao_social: "Novo Fornecedor Ltda", nome_fantasia: "Novo", email: "contato@novo.com" }, null, 2),
  "/erp-fornecedores-sync/sync-bidirecional": JSON.stringify({ empresa_id: 8, modo: "full" }, null, 2),
  "/erp-fornecedores-sync/cadastrar-todas": JSON.stringify({ cnpj: "12.345.678/0001-90", razao_social: "Fornecedor Multi Ltda" }, null, 2),
  // Portadores Sync
  "/erp-portadores-api/sync": JSON.stringify({ portadores: [{ codigo_erp: "PORT001", nome: "Banco Itaú", banco_codigo: "341", banco_nome: "Itaú Unibanco", agencia: "1234", conta: "56789-0", tipo: "corrente" }] }, null, 2),
  // Webhook Subscriptions
  "/webhook-subscriptions-api/incluir": JSON.stringify({ url: "https://erp.com/webhook", eventos: ["conta_pagar.criado", "conta_pagar.pago"], secret: "meu-segredo-hmac", headers_customizados: { "X-ERP-Token": "abc123" } }, null, 2),
  "/webhook-subscriptions-api/alterar": JSON.stringify({ id: "uuid-da-assinatura", url: "https://erp.com/webhook-v2", eventos: ["conta_pagar.criado", "conta_pagar.pago", "conta_pagar.cancelado"] }, null, 2),
  "/webhook-subscriptions-api/testar": JSON.stringify({ id: "uuid-da-assinatura" }, null, 2),
};

export default function ApiTester() {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState(`${DOC_BASE_URL}/contas-pagar-api/status`);
  const [body, setBody] = useState("");
  const [headers, setHeaders] = useState<HeaderEntry[]>([
    { key: "x-api-key", value: "", enabled: true },
    { key: "Content-Type", value: "application/json", enabled: true },
  ]);
  const [params, setParams] = useState<ParamEntry[]>([]);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const testerRef = useState<HTMLDivElement | null>(null);

  // Listen for pre-fill events from ApiDocumentation
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setMethod(detail.method as HttpMethod);
        setUrl(toDisplayUrl(detail.url));
        if (detail.body) {
          try {
            setBody(JSON.stringify(JSON.parse(detail.body.replace(/\s+/g, " ").trim()), null, 2));
          } catch {
            setBody(detail.body);
          }
        } else {
          setBody("");
        }
        // Scroll API Tester into view
        const el = document.getElementById("api-tester-section");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    apiTesterEventTarget.addEventListener("open-tester", handler);
    return () => apiTesterEventTarget.removeEventListener("open-tester", handler);
  }, []);

  const handlePreset = (preset: typeof PRESET_ENDPOINTS[0]) => {
    setMethod(preset.method);
    setUrl(`${DOC_BASE_URL}${preset.path}`);
    const basePath = preset.path.split("?")[0];
    if (BODY_TEMPLATES[basePath]) {
      setBody(BODY_TEMPLATES[basePath]);
    } else {
      setBody("");
    }
  };

  const addHeader = () => setHeaders([...headers, { key: "", value: "", enabled: true }]);
  const removeHeader = (i: number) => setHeaders(headers.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: "key" | "value", val: string) => {
    const next = [...headers];
    next[i][field] = val;
    setHeaders(next);
  };

  const addParam = () => setParams([...params, { key: "", value: "", enabled: true }]);
  const removeParam = (i: number) => setParams(params.filter((_, idx) => idx !== i));
  const updateParam = (i: number, field: "key" | "value", val: string) => {
    const next = [...params];
    next[i][field] = val;
    setParams(next);
  };

  const buildUrl = useCallback(() => {
    const enabled = params.filter(p => p.enabled && p.key.trim());
    if (enabled.length === 0) return url;
    const base = url.split("?")[0];
    const existingParams = new URLSearchParams(url.includes("?") ? url.split("?")[1] : "");
    enabled.forEach(p => existingParams.set(p.key, p.value));
    return `${base}?${existingParams.toString()}`;
  }, [url, params]);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    if (status >= 400 && status < 500) return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    return "bg-red-500/15 text-red-600 border-red-500/30";
  };

  // Payload validation
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validatePayload = (): boolean => {
    const errors: string[] = [];
    if (method === "GET" || method === "DELETE") {
      setValidationErrors([]);
      return true;
    }
    if (!body.trim()) {
      setValidationErrors([]);
      return true;
    }
    try {
      JSON.parse(body);
    } catch {
      errors.push("JSON inválido — verifique a sintaxe");
      setValidationErrors(errors);
      return false;
    }

    // Check required fields for known endpoints
    const path = url.replace(DOC_BASE_URL, "").replace(BASE_URL, "").split("?")[0];
    const parsed = JSON.parse(body);

    const REQUIRED_FIELDS: Record<string, string[]> = {
      "/contas-pagar-api/incluir": ["codigo_lancamento_integracao", "codigo_cliente_fornecedor", "data_vencimento", "valor_documento", "codigo_categoria"],
      "/contas-pagar-api/upsert": ["codigo_lancamento_integracao", "empresa_id", "codigo_cliente_fornecedor", "data_vencimento", "valor_documento", "codigo_categoria"],
      "/contas-pagar-api/lancar-pagamento": ["codigo_lancamento_integracao", "valor", "data"],
      "/contas-pagar-api/alterar": ["codigo_lancamento_integracao"],
      "/contas-receber-api/incluir": ["codigo_lancamento_integracao", "codigo_cliente_fornecedor", "data_vencimento", "valor_documento", "codigo_categoria"],
      "/contas-receber-api/upsert": ["codigo_lancamento_integracao", "empresa_id", "codigo_cliente_fornecedor", "data_vencimento", "valor_documento", "codigo_categoria"],
      "/contas-correntes-api/incluir": ["cCodCCInt", "tipo_conta_corrente", "codigo_banco", "descricao"],
      "/lancamentos-cc-api/incluir": ["cCodIntLanc", "cabecalho", "detalhes"],
      "/clientes-api/incluir": ["codigo_cliente_integracao", "razao_social", "cnpj_cpf"],
      "/boletos-api/gerar": ["cCodIntTitulo"],
    };

    const required = REQUIRED_FIELDS[path];
    if (required) {
      for (const field of required) {
        if (parsed[field] === undefined || parsed[field] === null || parsed[field] === "") {
          errors.push(`Campo obrigatório ausente: ${field}`);
        }
      }
    }

    // Upsert-lote: check array limit
    if (path.includes("upsert-lote")) {
      const arr = parsed.lote !== undefined ? (parsed.conta_pagar_cadastro || parsed.conta_receber_cadastro || parsed.lancamentos || parsed.fin_conta_corrente_cadastro || []) : [];
      if (Array.isArray(arr) && arr.length > 500) {
        errors.push(`Lote excede o limite de 500 registros (${arr.length} enviados)`);
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSend = async () => {
    if (!validatePayload()) {
      toast.error("Corrija os erros de validação antes de enviar");
      return;
    }

    setLoading(true);
    setResponse(null);
    const start = performance.now();

    try {
      if (sandboxMode) {
        // SANDBOX MODE: route through api-sandbox edge function
        const finalUrl = toRealUrl(buildUrl());
        const relativePath = finalUrl.replace(BASE_URL, "");
        let parsedBody: unknown = null;
        if (method !== "GET" && method !== "DELETE" && body.trim()) {
          try { parsedBody = JSON.parse(body); } catch { parsedBody = body; }
        }

        const { data: sbData, error: sbError } = await supabase.functions.invoke("api-sandbox", {
          body: { path: relativePath, method, body: parsedBody },
        });

        const duration = Math.round(performance.now() - start);

        if (sbError) {
          setResponse({
            status: 500,
            statusText: "Sandbox Error",
            data: { error: sbError.message, sandbox: true },
            duration,
            headers: {},
          });
        } else {
          setResponse({
            status: 200,
            statusText: "OK (Sandbox)",
            data: sbData,
            duration,
            headers: { "x-environment": "sandbox" },
          });
        }

        setHistory(prev => [
          { id: crypto.randomUUID(), method, url: `[SANDBOX] ${relativePath}`, status: sbError ? 500 : 200, duration, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      } else {
        // PRODUCTION MODE: original fetch logic (unchanged)
        const finalUrl = toRealUrl(buildUrl());
        const headerObj: Record<string, string> = {};
        headers.filter(h => h.enabled && h.key.trim()).forEach(h => {
          if (!h.value.trim()) return;
          if (h.key.toLowerCase() === "content-type" && (method === "GET" || method === "DELETE")) return;
          headerObj[h.key] = h.value;
        });

        const options: RequestInit = {
          method,
          headers: headerObj,
        };

        if (method !== "GET" && method !== "DELETE" && body.trim()) {
          options.body = body;
        }

        const res = await fetch(finalUrl, options);
        const duration = Math.round(performance.now() - start);

        let data: unknown;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          data = await res.text();
        }

        const resHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => { resHeaders[k] = v; });

        const apiRes: ApiResponse = {
          status: res.status,
          statusText: res.statusText,
          data,
          duration,
          headers: resHeaders,
        };
        setResponse(apiRes);

        setHistory(prev => [
          { id: crypto.randomUUID(), method, url: toDisplayUrl(finalUrl), status: res.status, duration, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      }
    } catch (err: unknown) {
      const duration = Math.round(performance.now() - start);
      const msg = err instanceof Error ? err.message : "Erro de conexão";
      const isCors = msg.includes("Failed to fetch") || msg.includes("NetworkError");
      setResponse({
        status: 0,
        statusText: isCors ? "CORS / Network Error" : "Network Error",
        data: {
          error: msg,
          hint: isCors
            ? "Possível bloqueio CORS. Verifique se o método HTTP é permitido pelo servidor e se os headers estão corretos."
            : "Verifique a URL e sua conexão de rede.",
        },
        duration,
        headers: {},
      });
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
      toast.success("Resposta copiada!");
    }
  };

  return (
    <Card className="border-border" id="api-tester-section">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            API Tester
            <Badge variant="outline" className="ml-2 text-xs font-normal">Postman-like</Badge>
            {sandboxMode && (
              <Badge className="ml-2 bg-orange-500/15 text-orange-600 border-orange-500/30 border text-xs font-semibold animate-pulse">
                <FlaskConical className="h-3 w-3 mr-1" />
                SANDBOX
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Produção</span>
            <Switch
              checked={sandboxMode}
              onCheckedChange={(checked) => {
                setSandboxMode(checked);
                toast.info(checked ? "Modo Sandbox ativado — chamadas não afetam dados reais" : "Modo Produção ativado");
              }}
            />
            <span className={`text-xs font-medium ${sandboxMode ? "text-orange-600" : "text-muted-foreground"}`}>Sandbox</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset endpoints */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Endpoints Pré-configurados</label>
          <Select onValueChange={(v) => {
            const preset = PRESET_ENDPOINTS[parseInt(v)];
            if (preset) handlePreset(preset);
          }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um endpoint..." />
            </SelectTrigger>
            <SelectContent>
              {PRESET_ENDPOINTS.map((ep, i) => (
                <SelectItem key={i} value={String(i)}>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className={`${METHOD_COLORS[ep.method]} text-[10px] px-1.5 py-0`}>{ep.method}</Badge>
                    {ep.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Request bar */}
        <div className="flex gap-2">
          <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
            <SelectTrigger className="w-[110px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["GET", "POST", "PUT", "DELETE"] as HttpMethod[]).map(m => (
                <SelectItem key={m} value={m}>
                  <Badge variant="outline" className={`${METHOD_COLORS[m]} text-xs`}>{m}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.bimaster.online/v1/..."
            className="font-mono text-sm flex-1"
          />
          <Button onClick={handleSend} disabled={loading} className={`gap-2 shrink-0 min-w-[100px] ${sandboxMode ? "bg-orange-500 hover:bg-orange-600" : ""}`}>
            {sandboxMode ? <FlaskConical className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {loading ? "Enviando..." : sandboxMode ? "Dry Run" : "Enviar"}
          </Button>
        </div>

        {/* Tabs: Headers, Body, Params */}
        <Tabs defaultValue="headers" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="headers">
              Headers <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{headers.filter(h => h.enabled && h.key).length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger value="params">
              Params <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{params.filter(p => p.enabled && p.key).length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="headers" className="space-y-2 mt-3">
            {headers.map((h, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={h.key} onChange={(e) => updateHeader(i, "key", e.target.value)} placeholder="Header" className="font-mono text-sm flex-1" />
                <Input value={h.value} onChange={(e) => updateHeader(i, "value", e.target.value)} placeholder="Valor" className="font-mono text-sm flex-1" />
                <Button variant="ghost" size="icon" onClick={() => removeHeader(i)} className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addHeader} className="gap-1 text-xs">
              <Plus className="h-3 w-3" /> Adicionar Header
            </Button>
          </TabsContent>

          <TabsContent value="body" className="mt-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{ "key": "value" }'
              className="font-mono text-sm min-h-[180px] resize-y"
            />
            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="mt-2 border border-destructive/30 rounded-lg p-2 bg-destructive/5 space-y-1">
                {validationErrors.map((err, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {err}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                try {
                  setBody(JSON.stringify(JSON.parse(body), null, 2));
                  setValidationErrors([]);
                } catch { toast.error("JSON inválido"); }
              }}>
                Formatar JSON
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => { validatePayload(); }}>
                Validar
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => { setBody(""); setValidationErrors([]); }}>
                Limpar
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="params" className="space-y-2 mt-3">
            {params.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={p.key} onChange={(e) => updateParam(i, "key", e.target.value)} placeholder="Parâmetro" className="font-mono text-sm flex-1" />
                <Input value={p.value} onChange={(e) => updateParam(i, "value", e.target.value)} placeholder="Valor" className="font-mono text-sm flex-1" />
                <Button variant="ghost" size="icon" onClick={() => removeParam(i)} className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addParam} className="gap-1 text-xs">
              <Plus className="h-3 w-3" /> Adicionar Parâmetro
            </Button>
          </TabsContent>
        </Tabs>

        {/* Response */}
        {response && (
          <div className={`rounded-lg border overflow-hidden ${sandboxMode ? "border-orange-500/50 bg-orange-500/5" : "border-border bg-muted/30"}`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/50">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={getStatusColor(response.status)}>
                  {response.status} {response.statusText}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {response.duration} ms
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={copyResponse} className="gap-1 text-xs h-7">
                <Copy className="h-3 w-3" /> Copiar
              </Button>
            </div>

            <Tabs defaultValue="body-response" className="w-full">
              <TabsList className="mx-4 mt-2 h-8">
                <TabsTrigger value="body-response" className="text-xs h-7">Body</TabsTrigger>
                <TabsTrigger value="headers-response" className="text-xs h-7">Headers</TabsTrigger>
              </TabsList>

              <TabsContent value="body-response" className="px-4 pb-4 mt-0">
                <ScrollArea className="max-h-[400px]">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all p-3 rounded bg-background border border-border mt-2">
                    {typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2)}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="headers-response" className="px-4 pb-4 mt-0">
                <div className="space-y-1 mt-2">
                  {Object.entries(response.headers).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs font-mono">
                      <span className="text-primary font-medium min-w-[180px]">{k}:</span>
                      <span className="text-muted-foreground break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground w-full justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Histórico ({history.length})
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => { setMethod(h.method); setUrl(h.url); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 text-left transition-colors"
                >
                  <Badge variant="outline" className={`${METHOD_COLORS[h.method]} text-[10px] px-1.5 py-0 shrink-0`}>{h.method}</Badge>
                  <span className="text-xs font-mono truncate flex-1 text-foreground">{h.url.replace(DOC_BASE_URL, "").replace(BASE_URL, "")}</span>
                  <Badge variant="outline" className={`${getStatusColor(h.status)} text-[10px] px-1.5 py-0 shrink-0`}>{h.status}</Badge>
                  <span className="text-[10px] text-muted-foreground shrink-0">{h.duration}ms</span>
                </button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setHistory([])} className="gap-1 text-xs text-muted-foreground mt-1">
                <Trash2 className="h-3 w-3" /> Limpar Histórico
              </Button>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
