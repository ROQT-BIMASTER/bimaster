import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

const BASE_URL_PLACEHOLDER = "YOUR_SUPABASE_URL/functions/v1";

function generateTsSDK(): string {
  return `// BiMaster ERP Integration SDK — TypeScript
// Gerado pelo Portal Huggs em ${new Date().toISOString().slice(0, 10)}

// ═══════════════════════════════════════
// INTERFACES — Payloads de Entrada
// ═══════════════════════════════════════

export interface CpIncluirPayload {
  codigo_lancamento_integracao: string;
  codigo_cliente_fornecedor: number;
  data_vencimento: string; // DD/MM/AAAA
  valor_documento: number;
  codigo_categoria: string; // Ex: "2.04.01"
  data_previsao?: string;
  id_conta_corrente?: number;
  numero_documento?: string;
  numero_documento_fiscal?: string;
  observacao?: string;
  codigo_projeto?: number;
  empresa_id?: number;
}

export interface CpAlterarPayload {
  codigo_lancamento_integracao: string;
  valor_documento?: number;
  data_vencimento?: string;
  codigo_categoria?: string;
  observacao?: string;
  data_previsao?: string;
}

export interface CpUpsertPayload extends CpIncluirPayload {
  empresa_id: number; // Obrigatório para resolver conflito
}

export interface CpUpsertLotePayload {
  lote: number;
  conta_pagar_cadastro: CpUpsertPayload[];
}

export interface CpLancarPagamentoPayload {
  codigo_lancamento_integracao: string;
  valor: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  data: string; // DD/MM/AAAA
  observacao?: string;
}

export interface CpCancelarPagamentoPayload {
  codigo_baixa: string;
}

export interface CrIncluirPayload {
  codigo_lancamento_integracao: string;
  codigo_cliente_fornecedor: number;
  data_vencimento: string;
  valor_documento: number;
  codigo_categoria: string;
  data_previsao?: string;
  id_conta_corrente?: number;
  numero_documento?: string;
  empresa_id?: number;
}

export interface CrUpsertPayload extends CrIncluirPayload {
  empresa_id: number;
}

export interface CrUpsertLotePayload {
  lote: number;
  conta_receber_cadastro: CrUpsertPayload[];
}

export interface ClientePayload {
  codigo_cliente_integracao?: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj_cpf?: string;
  email?: string;
  telefone1_numero?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  endereco?: string;
}

export interface ContaCorrentePayload {
  descricao: string;
  tipo?: string;
  saldo_inicial?: number;
  banco_codigo?: string;
  agencia?: string;
  conta?: string;
}

export interface WebhookSubscribePayload {
  url: string;
  events: string[];
  secret?: string;
}

// ═══════════════════════════════════════
// INTERFACES — Respostas
// ═══════════════════════════════════════

export interface ApiStatusResponse {
  status: string;
  version?: string;
  timestamp?: string;
}

export interface CpMutationResponse {
  codigo_lancamento_huggs?: number | null;
  codigo_lancamento_integracao: string;
  codigo_status: string;
  descricao_status: string;
}

export interface CpLoteResponse {
  lote: number;
  codigo_status: string;
  descricao_status: string;
}

export interface CpPagamentoResponse {
  codigo_lancamento_integracao: string;
  codigo_baixa: string;
  liquidado: string;
  valor_baixado: number;
  codigo_status: string;
  descricao_status: string;
}

export interface PaginatedResponse<T> {
  pagina: number;
  total_de_paginas: number;
  registros: number;
  total_de_registros: number;
  conta_pagar_cadastro?: T[];
  conta_receber_cadastro?: T[];
}

export interface ListarParams {
  pagina?: number;
  registros_por_pagina?: number;
  apenas_importado_api?: string;
  filtrar_por_status?: string;
  filtrar_por_data_de?: string;
  filtrar_por_data_ate?: string;
}

// ═══════════════════════════════════════
// SDK CLASS
// ═══════════════════════════════════════

export class HuggsERP {
  private apiKey: string;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiKey: string, baseUrl: string = "${BASE_URL_PLACEHOLDER}") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.headers = {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    };
  }

  private async _request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\`;
    const opts: RequestInit = { method, headers: this.headers };
    if (body && method !== "GET") opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data as T;
  }

  // ===== Contas a Pagar =====
  async cpStatus(): Promise<ApiStatusResponse> { return this._request("GET", "/contas-pagar-api/status"); }
  async cpListar(params?: ListarParams): Promise<PaginatedResponse<any>> {
    const p = params || {};
    const qs = new URLSearchParams();
    if (p.pagina) qs.set("pagina", String(p.pagina));
    if (p.registros_por_pagina) qs.set("registros_por_pagina", String(p.registros_por_pagina));
    if (p.apenas_importado_api) qs.set("apenas_importado_api", p.apenas_importado_api);
    if (p.filtrar_por_status) qs.set("filtrar_por_status", p.filtrar_por_status);
    if (p.filtrar_por_data_de) qs.set("filtrar_por_data_de", p.filtrar_por_data_de);
    if (p.filtrar_por_data_ate) qs.set("filtrar_por_data_ate", p.filtrar_por_data_ate);
    return this._request("GET", \`/contas-pagar-api/listar?\${qs.toString()}\`);
  }
  async cpIncluir(titulo: CpIncluirPayload): Promise<CpMutationResponse> { return this._request("POST", "/contas-pagar-api/incluir", titulo); }
  async cpAlterar(titulo: CpAlterarPayload): Promise<CpMutationResponse> { return this._request("PUT", "/contas-pagar-api/alterar", titulo); }
  async cpExcluir(codigo: string): Promise<CpMutationResponse> {
    return this._request("DELETE", \`/contas-pagar-api/excluir?codigo_lancamento_integracao=\${encodeURIComponent(codigo)}\`);
  }
  async cpUpsert(titulo: CpUpsertPayload): Promise<CpMutationResponse> { return this._request("POST", "/contas-pagar-api/upsert", titulo); }
  async cpUpsertLote(lote: CpUpsertLotePayload): Promise<CpLoteResponse> { return this._request("POST", "/contas-pagar-api/upsert-lote", lote); }
  async cpLancarPagamento(pagamento: CpLancarPagamentoPayload): Promise<CpPagamentoResponse> { return this._request("POST", "/contas-pagar-api/lancar-pagamento", pagamento); }
  async cpCancelarPagamento(body: CpCancelarPagamentoPayload): Promise<CpMutationResponse> { return this._request("POST", "/contas-pagar-api/cancelar-pagamento", body); }

  // ===== Contas a Receber =====
  async crListar(params?: ListarParams): Promise<PaginatedResponse<any>> {
    const p = params || {};
    const qs = new URLSearchParams();
    if (p.pagina) qs.set("pagina", String(p.pagina));
    if (p.registros_por_pagina) qs.set("registros_por_pagina", String(p.registros_por_pagina));
    return this._request("GET", \`/contas-receber-api/listar?\${qs.toString()}\`);
  }
  async crIncluir(titulo: CrIncluirPayload): Promise<CpMutationResponse> { return this._request("POST", "/contas-receber-api/incluir", titulo); }
  async crAlterar(titulo: Partial<CrIncluirPayload>): Promise<CpMutationResponse> { return this._request("PUT", "/contas-receber-api/alterar", titulo); }
  async crUpsert(titulo: CrUpsertPayload): Promise<CpMutationResponse> { return this._request("POST", "/contas-receber-api/upsert", titulo); }
  async crUpsertLote(lote: CrUpsertLotePayload): Promise<CpLoteResponse> { return this._request("POST", "/contas-receber-api/upsert-lote", lote); }

  // ===== Clientes =====
  async clientesListar(body?: Record<string, unknown>): Promise<any> { return this._request("POST", "/clientes-api/listar", body); }
  async clientesIncluir(body: ClientePayload): Promise<any> { return this._request("POST", "/clientes-api/incluir", body); }
  async clientesAlterar(body: Partial<ClientePayload> & { id: string }): Promise<any> { return this._request("POST", "/clientes-api/alterar", body); }
  async clientesUpsert(body: ClientePayload): Promise<any> { return this._request("POST", "/clientes-api/upsert", body); }

  // ===== Contas Correntes =====
  async ccListar(): Promise<any> { return this._request("GET", "/contas-correntes-api/"); }
  async ccIncluir(body: ContaCorrentePayload): Promise<any> { return this._request("POST", "/contas-correntes-api/incluir", body); }
  async ccUpsertLote(body: { lote: ContaCorrentePayload[] }): Promise<any> { return this._request("POST", "/contas-correntes-api/upsert-lote", body); }

  // ===== Boletos =====
  async boletoGerar(body: { conta_receber_id: string }): Promise<any> { return this._request("POST", "/boletos-api/gerar", body); }
  async boletoListar(pagina?: number): Promise<any> { return this._request("GET", \`/boletos-api/listar?pagina=\${pagina || 1}\`); }

  // ===== Webhooks =====
  async webhookIncluir(body: WebhookSubscribePayload): Promise<any> { return this._request("POST", "/webhook-subscriptions-api/incluir", body); }
  async webhookListar(): Promise<any> { return this._request("GET", "/webhook-subscriptions-api/listar"); }
}

// Uso:
// import { HuggsERP, CpIncluirPayload } from "./huggs-erp-sdk";
// const erp = new HuggsERP("huggs-erp-xxxxxxxx", "https://SEU_PROJETO.supabase.co/functions/v1");
// const titulo: CpIncluirPayload = { codigo_lancamento_integracao: "INT-001", ... };
// const result = await erp.cpIncluir(titulo);

export default HuggsERP;
`;
}

function generateJsSDK(): string {
  return `// BiMaster ERP Integration SDK — JavaScript
// Gerado pelo Portal Huggs em ${new Date().toISOString().slice(0, 10)}

class HuggsERP {
  constructor(apiKey, baseUrl = "${BASE_URL_PLACEHOLDER}") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.headers = {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    };
  }

  async _request(method, path, body = null) {
    const url = \`\${this.baseUrl}\${path}\`;
    const opts = { method, headers: this.headers };
    if (body && method !== "GET") opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  }

  // ===== Contas a Pagar =====
  async cpStatus() { return this._request("GET", "/contas-pagar-api/status"); }
  async cpListar(pagina = 1, registros = 50) {
    return this._request("GET", \`/contas-pagar-api/listar?pagina=\${pagina}&registros_por_pagina=\${registros}\`);
  }
  async cpIncluir(titulo) { return this._request("POST", "/contas-pagar-api/incluir", titulo); }
  async cpAlterar(titulo) { return this._request("PUT", "/contas-pagar-api/alterar", titulo); }
  async cpExcluir(codigo) {
    return this._request("DELETE", \`/contas-pagar-api/excluir?codigo_lancamento_integracao=\${codigo}\`);
  }
  async cpUpsert(titulo) { return this._request("POST", "/contas-pagar-api/upsert", titulo); }
  async cpUpsertLote(lote) { return this._request("POST", "/contas-pagar-api/upsert-lote", lote); }
  async cpLancarPagamento(pagamento) { return this._request("POST", "/contas-pagar-api/lancar-pagamento", pagamento); }
  async cpCancelarPagamento(body) { return this._request("POST", "/contas-pagar-api/cancelar-pagamento", body); }

  // ===== Contas a Receber =====
  async crListar(pagina = 1, registros = 50) {
    return this._request("GET", \`/contas-receber-api/listar?pagina=\${pagina}&registros_por_pagina=\${registros}\`);
  }
  async crIncluir(titulo) { return this._request("POST", "/contas-receber-api/incluir", titulo); }
  async crAlterar(titulo) { return this._request("PUT", "/contas-receber-api/alterar", titulo); }
  async crUpsert(titulo) { return this._request("POST", "/contas-receber-api/upsert", titulo); }
  async crUpsertLote(lote) { return this._request("POST", "/contas-receber-api/upsert-lote", lote); }

  // ===== Clientes =====
  async clientesListar(body) { return this._request("POST", "/clientes-api/listar", body); }
  async clientesIncluir(body) { return this._request("POST", "/clientes-api/incluir", body); }
  async clientesAlterar(body) { return this._request("POST", "/clientes-api/alterar", body); }
  async clientesUpsert(body) { return this._request("POST", "/clientes-api/upsert", body); }

  // ===== Contas Correntes =====
  async ccListar() { return this._request("GET", "/contas-correntes-api/"); }
  async ccIncluir(body) { return this._request("POST", "/contas-correntes-api/incluir", body); }
  async ccUpsertLote(body) { return this._request("POST", "/contas-correntes-api/upsert-lote", body); }

  // ===== Boletos =====
  async boletoGerar(body) { return this._request("POST", "/boletos-api/gerar", body); }
  async boletoListar(pagina = 1) { return this._request("GET", \`/boletos-api/listar?pagina=\${pagina}\`); }

  // ===== Webhooks =====
  async webhookIncluir(body) { return this._request("POST", "/webhook-subscriptions-api/incluir", body); }
  async webhookListar() { return this._request("GET", "/webhook-subscriptions-api/listar"); }
}

// Uso:
// const erp = new HuggsERP("huggs-erp-xxxxxxxxxxxxxxxx", "https://SEU_PROJETO.supabase.co/functions/v1");
// const status = await erp.cpStatus();
// console.log(status);

export default HuggsERP;
`;
}

function generatePySDK(): string {
  return `# BiMaster ERP Integration SDK — Python
# Gerado pelo Portal Huggs em ${new Date().toISOString().slice(0, 10)}

import requests
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

@dataclass
class CpIncluirPayload:
    codigo_lancamento_integracao: str
    codigo_cliente_fornecedor: int
    data_vencimento: str  # DD/MM/AAAA
    valor_documento: float
    codigo_categoria: str
    data_previsao: Optional[str] = None
    id_conta_corrente: Optional[int] = None
    numero_documento: Optional[str] = None
    observacao: Optional[str] = None
    empresa_id: Optional[int] = None

@dataclass
class CpPagamentoPayload:
    codigo_lancamento_integracao: str
    valor: float
    data: str  # DD/MM/AAAA
    desconto: float = 0
    juros: float = 0
    multa: float = 0
    observacao: Optional[str] = None

class HuggsERP:
    def __init__(self, api_key: str, base_url: str = "${BASE_URL_PLACEHOLDER}"):
        self.base_url = base_url
        self.headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, body: Optional[Dict] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        resp = requests.request(method, url, json=body, headers=self.headers, timeout=30)
        data = resp.json()
        if not resp.ok:
            raise Exception(f"HTTP {resp.status_code}: {data}")
        return data

    # ===== Contas a Pagar =====
    def cp_status(self) -> Dict: return self._request("GET", "/contas-pagar-api/status")
    def cp_listar(self, pagina=1, registros=50) -> Dict:
        return self._request("GET", f"/contas-pagar-api/listar?pagina={pagina}&registros_por_pagina={registros}")
    def cp_incluir(self, titulo: Dict) -> Dict: return self._request("POST", "/contas-pagar-api/incluir", titulo)
    def cp_alterar(self, titulo: Dict) -> Dict: return self._request("PUT", "/contas-pagar-api/alterar", titulo)
    def cp_excluir(self, codigo: str) -> Dict:
        return self._request("DELETE", f"/contas-pagar-api/excluir?codigo_lancamento_integracao={codigo}")
    def cp_upsert(self, titulo: Dict) -> Dict: return self._request("POST", "/contas-pagar-api/upsert", titulo)
    def cp_upsert_lote(self, lote: Dict) -> Dict: return self._request("POST", "/contas-pagar-api/upsert-lote", lote)
    def cp_lancar_pagamento(self, pagamento: Dict) -> Dict:
        return self._request("POST", "/contas-pagar-api/lancar-pagamento", pagamento)

    # ===== Contas a Receber =====
    def cr_listar(self, pagina=1, registros=50) -> Dict:
        return self._request("GET", f"/contas-receber-api/listar?pagina={pagina}&registros_por_pagina={registros}")
    def cr_incluir(self, titulo: Dict) -> Dict: return self._request("POST", "/contas-receber-api/incluir", titulo)
    def cr_upsert(self, titulo: Dict) -> Dict: return self._request("POST", "/contas-receber-api/upsert", titulo)
    def cr_upsert_lote(self, lote: Dict) -> Dict: return self._request("POST", "/contas-receber-api/upsert-lote", lote)

    # ===== Clientes =====
    def clientes_listar(self, body: Dict) -> Dict: return self._request("POST", "/clientes-api/listar", body)
    def clientes_incluir(self, body: Dict) -> Dict: return self._request("POST", "/clientes-api/incluir", body)
    def clientes_upsert(self, body: Dict) -> Dict: return self._request("POST", "/clientes-api/upsert", body)

    # ===== Contas Correntes =====
    def cc_listar(self) -> Dict: return self._request("GET", "/contas-correntes-api/")
    def cc_incluir(self, body: Dict) -> Dict: return self._request("POST", "/contas-correntes-api/incluir", body)

    # ===== Boletos =====
    def boleto_gerar(self, body: Dict) -> Dict: return self._request("POST", "/boletos-api/gerar", body)
    def boleto_listar(self, pagina=1) -> Dict:
        return self._request("GET", f"/boletos-api/listar?pagina={pagina}")

    # ===== Webhooks =====
    def webhook_incluir(self, body: Dict) -> Dict:
        return self._request("POST", "/webhook-subscriptions-api/incluir", body)


# Uso:
# erp = HuggsERP("huggs-erp-xxxxxxxxxxxxxxxx", "https://SEU_PROJETO.supabase.co/functions/v1")
# print(erp.cp_status())
`;
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} baixado com sucesso!`);
}

export default function SdkDownloadButtons() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => downloadFile(generateTsSDK(), "huggs-erp-sdk.ts")}
      >
        <Download className="h-3 w-3" />
        SDK TypeScript
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => downloadFile(generateJsSDK(), "huggs-erp-sdk.js")}
      >
        <Download className="h-3 w-3" />
        SDK JavaScript
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => downloadFile(generatePySDK(), "huggs_erp_sdk.py")}
      >
        <Download className="h-3 w-3" />
        SDK Python
      </Button>
    </div>
  );
}
