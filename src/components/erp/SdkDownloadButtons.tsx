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

export interface EmpresaIncluirPayload {
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  codigo_empresa_integracao?: string;
  codigo_erp?: string;
  regime_apuracao?: 'Competência' | 'Caixa';
  tipo_empresa?: 'Matriz' | 'Filial' | 'Coligada';
  natureza_juridica?: string;
  porte?: 'ME' | 'EPP' | 'Demais';
  capital_social?: number;
  data_abertura?: string;
  codigo_ibge_municipio?: number;
  responsavel_nome?: string;
  responsavel_cpf?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  regime_tributario?: string;
  endereco?: string;
  endereco_numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  email?: string;
  telefone1_ddd?: string;
  telefone1_numero?: string;
}

export interface EmpresaAlterarPayload {
  codigo_empresa: number;
  razao_social?: string;
  nome_fantasia?: string;
  regime_apuracao?: string;
  porte?: string;
  [key: string]: unknown;
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

  // ===== Empresas =====
  async empresasIncluir(body: EmpresaIncluirPayload): Promise<any> { return this._request("POST", "/empresas-api/incluir", body); }
  async empresasAlterar(body: EmpresaAlterarPayload): Promise<any> { return this._request("POST", "/empresas-api/alterar", body); }
  async empresasConsultar(codigoEmpresa: number): Promise<any> { return this._request("POST", "/empresas-api/consultar", { codigo_empresa: codigoEmpresa }); }
  async empresasListar(pagina = 1, registros = 100): Promise<any> { return this._request("POST", "/empresas-api/listar", { pagina, registros_por_pagina: registros }); }

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
# Requer: pip install requests

import requests
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict


# ═══════════════════════════════════════
# DATACLASSES TIPADAS — Payloads
# ═══════════════════════════════════════

@dataclass
class CpIncluirPayload:
    """Payload para incluir Conta a Pagar."""
    codigo_lancamento_integracao: str
    codigo_cliente_fornecedor: int
    data_vencimento: str  # DD/MM/AAAA
    valor_documento: float
    codigo_categoria: str  # Ex: "2.04.01"
    data_previsao: Optional[str] = None
    id_conta_corrente: Optional[int] = None
    numero_documento: Optional[str] = None
    observacao: Optional[str] = None
    empresa_id: Optional[int] = None

@dataclass
class CpAlterarPayload:
    """Payload para alterar Conta a Pagar."""
    codigo_lancamento_integracao: str
    valor_documento: Optional[float] = None
    data_vencimento: Optional[str] = None
    codigo_categoria: Optional[str] = None
    observacao: Optional[str] = None
    data_previsao: Optional[str] = None

@dataclass
class CpUpsertPayload(CpIncluirPayload):
    """Payload para upsert — empresa_id é obrigatório."""
    empresa_id: int = 0  # Obrigatório para resolver conflito

@dataclass
class CpPagamentoPayload:
    """Payload para lançar pagamento/baixa."""
    codigo_lancamento_integracao: str
    valor: float
    data: str  # DD/MM/AAAA
    desconto: float = 0
    juros: float = 0
    multa: float = 0
    observacao: Optional[str] = None

@dataclass
class CrIncluirPayload:
    """Payload para incluir Conta a Receber."""
    codigo_lancamento_integracao: str
    codigo_cliente_fornecedor: int
    data_vencimento: str
    valor_documento: float
    codigo_categoria: str
    data_previsao: Optional[str] = None
    id_conta_corrente: Optional[int] = None
    numero_documento: Optional[str] = None
    empresa_id: Optional[int] = None

@dataclass
class ClientePayload:
    """Payload para incluir/alterar Cliente."""
    razao_social: str
    codigo_cliente_integracao: Optional[str] = None
    nome_fantasia: Optional[str] = None
    cnpj_cpf: Optional[str] = None
    email: Optional[str] = None
    telefone1_numero: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None

@dataclass
class WebhookSubscribePayload:
    """Payload para criar assinatura de webhook."""
    url: str
    eventos: List[str]
    secret: Optional[str] = None


# ═══════════════════════════════════════
# EXCEÇÕES TIPADAS
# ═══════════════════════════════════════

class HuggsAPIError(Exception):
    """Erro genérico da API Huggs."""
    def __init__(self, status: int, message: str, data: Dict = None):
        self.status = status
        self.message = message
        self.data = data or {}
        super().__init__(f"HTTP {status}: {message}")

class HuggsValidationError(HuggsAPIError):
    """Erro 400 — validação de payload."""
    pass

class HuggsAuthError(HuggsAPIError):
    """Erro 401 — autenticação."""
    pass

class HuggsRateLimitError(HuggsAPIError):
    """Erro 429 — rate limit excedido."""
    def __init__(self, retry_after: int = 60):
        self.retry_after = retry_after
        super().__init__(429, f"Rate limit excedido. Retry após {retry_after}s")

class HuggsConflictError(HuggsAPIError):
    """Erro 409 — recurso duplicado."""
    pass


# ═══════════════════════════════════════
# SDK CLASS
# ═══════════════════════════════════════

class HuggsERP:
    """SDK oficial para integração com o ERP BiMaster/Huggs.
    
    Uso:
        erp = HuggsERP("huggs-erp-xxxxxxxx", "https://SEU_PROJETO.supabase.co/functions/v1")
        print(erp.cp_status())
    """

    def __init__(self, api_key: str, base_url: str = "${BASE_URL_PLACEHOLDER}"):
        self.base_url = base_url
        self.headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, body: Optional[Dict] = None) -> Dict[str, Any]:
        """Executa request com tratamento de erros tipados."""
        url = f"{self.base_url}{path}"
        resp = requests.request(method, url, json=body, headers=self.headers, timeout=30)
        
        try:
            data = resp.json()
        except ValueError:
            data = {"message": resp.text}

        if resp.ok:
            return data

        msg = data.get("message", data.get("error", resp.text))
        if resp.status_code == 400:
            raise HuggsValidationError(400, msg, data)
        elif resp.status_code == 401:
            raise HuggsAuthError(401, msg, data)
        elif resp.status_code == 409:
            raise HuggsConflictError(409, msg, data)
        elif resp.status_code == 429:
            retry = int(resp.headers.get("Retry-After", "60"))
            raise HuggsRateLimitError(retry)
        else:
            raise HuggsAPIError(resp.status_code, msg, data)

    def _to_dict(self, obj) -> Dict:
        """Converte dataclass para dict, removendo valores None."""
        if hasattr(obj, "__dataclass_fields__"):
            return {k: v for k, v in asdict(obj).items() if v is not None}
        return obj

    # ===== Contas a Pagar =====
    def cp_status(self) -> Dict:
        """Health check da API de Contas a Pagar."""
        return self._request("GET", "/contas-pagar-api/status")
    
    def cp_listar(self, pagina: int = 1, registros: int = 50, **filtros) -> Dict:
        """Listar contas a pagar com paginação e filtros."""
        qs = f"pagina={pagina}&registros_por_pagina={registros}"
        for k, v in filtros.items():
            qs += f"&{k}={v}"
        return self._request("GET", f"/contas-pagar-api/listar?{qs}")
    
    def cp_incluir(self, titulo: CpIncluirPayload) -> Dict:
        """Incluir nova conta a pagar."""
        return self._request("POST", "/contas-pagar-api/incluir", self._to_dict(titulo))
    
    def cp_alterar(self, titulo: CpAlterarPayload) -> Dict:
        """Alterar conta a pagar existente."""
        return self._request("PUT", "/contas-pagar-api/alterar", self._to_dict(titulo))
    
    def cp_excluir(self, codigo: str) -> Dict:
        """Excluir conta a pagar por código de integração."""
        return self._request("DELETE", f"/contas-pagar-api/excluir?codigo_lancamento_integracao={codigo}")
    
    def cp_upsert(self, titulo: CpUpsertPayload) -> Dict:
        """Upsert unitário de conta a pagar."""
        return self._request("POST", "/contas-pagar-api/upsert", self._to_dict(titulo))
    
    def cp_upsert_lote(self, lote: int, titulos: List[Dict]) -> Dict:
        """Upsert em lote de contas a pagar (máx 500)."""
        return self._request("POST", "/contas-pagar-api/upsert-lote", {"lote": lote, "conta_pagar_cadastro": titulos})
    
    def cp_lancar_pagamento(self, pagamento: CpPagamentoPayload) -> Dict:
        """Registrar pagamento/baixa."""
        return self._request("POST", "/contas-pagar-api/lancar-pagamento", self._to_dict(pagamento))

    # ===== Contas a Receber =====
    def cr_listar(self, pagina: int = 1, registros: int = 50, **filtros) -> Dict:
        """Listar contas a receber com paginação e filtros."""
        qs = f"pagina={pagina}&registros_por_pagina={registros}"
        for k, v in filtros.items():
            qs += f"&{k}={v}"
        return self._request("GET", f"/contas-receber-api/listar?{qs}")
    
    def cr_incluir(self, titulo: CrIncluirPayload) -> Dict:
        """Incluir nova conta a receber."""
        return self._request("POST", "/contas-receber-api/incluir", self._to_dict(titulo))
    
    def cr_alterar(self, titulo: Dict) -> Dict:
        """Alterar conta a receber."""
        return self._request("PUT", "/contas-receber-api/alterar", titulo)
    
    def cr_upsert(self, titulo: Dict) -> Dict:
        """Upsert unitário de conta a receber."""
        return self._request("POST", "/contas-receber-api/upsert", titulo)
    
    def cr_upsert_lote(self, lote: int, titulos: List[Dict]) -> Dict:
        """Upsert em lote de contas a receber (máx 500)."""
        return self._request("POST", "/contas-receber-api/upsert-lote", {"lote": lote, "conta_receber_cadastro": titulos})
    
    def cr_lancar_recebimento(self, recebimento: Dict) -> Dict:
        """Registrar recebimento/baixa."""
        return self._request("POST", "/contas-receber-api/lancar-recebimento", recebimento)
    
    def cr_cancelar_recebimento(self, body: Dict) -> Dict:
        """Cancelar recebimento."""
        return self._request("POST", "/contas-receber-api/cancelar-recebimento", body)

    # ===== Clientes =====
    def clientes_listar(self, body: Dict = None) -> Dict:
        """Listar clientes."""
        return self._request("POST", "/clientes-api/listar", body or {})
    
    def clientes_incluir(self, body: ClientePayload) -> Dict:
        """Incluir novo cliente."""
        return self._request("POST", "/clientes-api/incluir", self._to_dict(body))
    
    def clientes_upsert(self, body: ClientePayload) -> Dict:
        """Upsert de cliente."""
        return self._request("POST", "/clientes-api/upsert", self._to_dict(body))

    # ===== Contas Correntes =====
    def cc_listar(self) -> Dict:
        """Listar contas correntes."""
        return self._request("GET", "/contas-correntes-api/")
    
    def cc_incluir(self, body: Dict) -> Dict:
        """Incluir conta corrente."""
        return self._request("POST", "/contas-correntes-api/incluir", body)

    # ===== Boletos =====
    def boleto_gerar(self, body: Dict) -> Dict:
        """Gerar boleto."""
        return self._request("POST", "/boletos-api/gerar", body)
    
    def boleto_listar(self, pagina: int = 1) -> Dict:
        """Listar boletos."""
        return self._request("GET", f"/boletos-api/listar?pagina={pagina}")

    # ===== Webhooks =====
    def webhook_incluir(self, body: WebhookSubscribePayload) -> Dict:
        """Criar assinatura de webhook."""
        return self._request("POST", "/webhook-subscriptions-api/incluir", self._to_dict(body))
    
    def webhook_listar(self) -> Dict:
        """Listar assinaturas de webhook."""
        return self._request("GET", "/webhook-subscriptions-api/listar")

    # ===== Paginação Automática =====
    def fetch_all_pages(self, path: str, key: str = "conta_pagar_cadastro") -> List[Dict]:
        """Buscar TODOS os registros percorrendo todas as páginas automaticamente.
        
        Args:
            path: Caminho do endpoint (ex: "/contas-pagar-api/listar")
            key: Nome do array de resultados na resposta
        
        Returns:
            Lista com todos os registros de todas as páginas.
        """
        pagina, todos = 1, []
        while True:
            data = self._request("GET", f"{path}?pagina={pagina}&registros_por_pagina=500")
            todos.extend(data.get(key, []))
            if pagina >= data.get("total_de_paginas", 1):
                break
            pagina += 1
        return todos


# ═══════════════════════════════════════
# EXEMPLO DE USO
# ═══════════════════════════════════════

if __name__ == "__main__":
    erp = HuggsERP("huggs-erp-xxxxxxxx", "https://SEU_PROJETO.supabase.co/functions/v1")
    
    # Health check
    print(erp.cp_status())
    
    # Incluir CP com dataclass tipada
    titulo = CpIncluirPayload(
        codigo_lancamento_integracao="INT-001",
        codigo_cliente_fornecedor=4214850,
        data_vencimento="21/03/2026",
        valor_documento=100.00,
        codigo_categoria="2.04.01",
    )
    
    try:
        result = erp.cp_incluir(titulo)
        print(f"Título criado: {result}")
    except HuggsConflictError:
        print("Título já existe — use cp_upsert()")
    except HuggsValidationError as e:
        print(f"Erro de validação: {e.data}")
    except HuggsRateLimitError as e:
        print(f"Rate limit — retry em {e.retry_after}s")
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
