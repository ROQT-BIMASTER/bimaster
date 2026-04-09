import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

const BASE_URL_PLACEHOLDER = "YOUR_SUPABASE_URL/functions/v1";

function generateJsSDK(): string {
  return `// BiMaster ERP Integration SDK — JavaScript/TypeScript
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
from typing import Optional, Dict, Any

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
    def cp_status(self): return self._request("GET", "/contas-pagar-api/status")
    def cp_listar(self, pagina=1, registros=50):
        return self._request("GET", f"/contas-pagar-api/listar?pagina={pagina}&registros_por_pagina={registros}")
    def cp_incluir(self, titulo): return self._request("POST", "/contas-pagar-api/incluir", titulo)
    def cp_alterar(self, titulo): return self._request("PUT", "/contas-pagar-api/alterar", titulo)
    def cp_excluir(self, codigo):
        return self._request("DELETE", f"/contas-pagar-api/excluir?codigo_lancamento_integracao={codigo}")
    def cp_upsert(self, titulo): return self._request("POST", "/contas-pagar-api/upsert", titulo)
    def cp_upsert_lote(self, lote): return self._request("POST", "/contas-pagar-api/upsert-lote", lote)
    def cp_lancar_pagamento(self, pagamento):
        return self._request("POST", "/contas-pagar-api/lancar-pagamento", pagamento)

    # ===== Contas a Receber =====
    def cr_listar(self, pagina=1, registros=50):
        return self._request("GET", f"/contas-receber-api/listar?pagina={pagina}&registros_por_pagina={registros}")
    def cr_incluir(self, titulo): return self._request("POST", "/contas-receber-api/incluir", titulo)
    def cr_upsert(self, titulo): return self._request("POST", "/contas-receber-api/upsert", titulo)
    def cr_upsert_lote(self, lote): return self._request("POST", "/contas-receber-api/upsert-lote", lote)

    # ===== Clientes =====
    def clientes_listar(self, body): return self._request("POST", "/clientes-api/listar", body)
    def clientes_incluir(self, body): return self._request("POST", "/clientes-api/incluir", body)
    def clientes_upsert(self, body): return self._request("POST", "/clientes-api/upsert", body)

    # ===== Contas Correntes =====
    def cc_listar(self): return self._request("GET", "/contas-correntes-api/")
    def cc_incluir(self, body): return self._request("POST", "/contas-correntes-api/incluir", body)

    # ===== Boletos =====
    def boleto_gerar(self, body): return self._request("POST", "/boletos-api/gerar", body)
    def boleto_listar(self, pagina=1):
        return self._request("GET", f"/boletos-api/listar?pagina={pagina}")

    # ===== Webhooks =====
    def webhook_incluir(self, body):
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
    <div className="flex items-center gap-2">
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
