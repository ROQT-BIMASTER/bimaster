import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Terminal, Send, Clock, Trash2, ChevronDown, Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";

const BASE_URL = "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1";

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
  // Contas a Pagar — Omie-style
  { label: "CP Omie — Consultar", method: "GET" as HttpMethod, path: "/contas-pagar-api/consultar?codigo_lancamento_integracao=COLE_O_CODIGO" },
  { label: "CP Omie — Incluir", method: "POST" as HttpMethod, path: "/contas-pagar-api/incluir" },
  { label: "CP Omie — Alterar", method: "PUT" as HttpMethod, path: "/contas-pagar-api/alterar" },
  { label: "CP Omie — Excluir", method: "DELETE" as HttpMethod, path: "/contas-pagar-api/excluir?codigo_lancamento_integracao=COLE_O_CODIGO" },
  { label: "CP Omie — Upsert", method: "POST" as HttpMethod, path: "/contas-pagar-api/upsert" },
  { label: "CP Omie — Upsert Lote", method: "POST" as HttpMethod, path: "/contas-pagar-api/upsert-lote" },
  { label: "CP Omie — Lançar Pagamento", method: "POST" as HttpMethod, path: "/contas-pagar-api/lancar-pagamento" },
  { label: "CP Omie — Cancelar Pagamento", method: "POST" as HttpMethod, path: "/contas-pagar-api/cancelar-pagamento" },
  { label: "CP Omie — Listar", method: "GET" as HttpMethod, path: "/contas-pagar-api/listar?pagina=1&registros_por_pagina=20" },
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
];

const BODY_TEMPLATES: Record<string, string> = {
  "/contas-pagar-api/cancelar": JSON.stringify({ ids: ["uuid-1"], motivo: "Duplicidade de lançamento" }, null, 2),
  "/contas-pagar-api/registrar-pagamento": JSON.stringify({ conta_pagar_id: "uuid", valor_pago: 1500.00, data_pagamento: "2026-03-21", metodo_pagamento: "PIX" }, null, 2),
  "/contas-pagar-api/estornar": JSON.stringify({ id: "uuid", motivo: "Pagamento devolvido", valor_estorno: 500.00 }, null, 2),
  "/contas-pagar-api/update": JSON.stringify({ id: "uuid", data_vencimento: "2026-04-15", portador: "Banco Itaú" }, null, 2),
  // Omie-style Contas a Pagar
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
};

export default function ApiTester() {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState(`${BASE_URL}/contas-pagar-api/status`);
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

  const handlePreset = (preset: typeof PRESET_ENDPOINTS[0]) => {
    setMethod(preset.method);
    setUrl(`${BASE_URL}${preset.path}`);
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

  const handleSend = async () => {
    setLoading(true);
    setResponse(null);
    const start = performance.now();

    try {
      const finalUrl = buildUrl();
      const headerObj: Record<string, string> = {};
      headers.filter(h => h.enabled && h.key.trim()).forEach(h => {
        // Skip empty values to avoid triggering unnecessary CORS preflight
        if (!h.value.trim()) return;
        // Skip Content-Type for GET/DELETE (no body)
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
        { id: crypto.randomUUID(), method, url: finalUrl, status: res.status, duration, timestamp: new Date() },
        ...prev.slice(0, 9),
      ]);
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
    <Card className="border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          API Tester
          <Badge variant="outline" className="ml-2 text-xs font-normal">Postman-like</Badge>
        </CardTitle>
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
            placeholder={`${BASE_URL}/...`}
            className="font-mono text-sm flex-1"
          />
          <Button onClick={handleSend} disabled={loading} className="gap-2 shrink-0 min-w-[100px]">
            <Send className="h-4 w-4" />
            {loading ? "Enviando..." : "Enviar"}
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
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                try {
                  setBody(JSON.stringify(JSON.parse(body), null, 2));
                } catch { toast.error("JSON inválido"); }
              }}>
                Formatar JSON
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setBody("")}>
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
          <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
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
                  <span className="text-xs font-mono truncate flex-1 text-foreground">{h.url.replace(BASE_URL, "")}</span>
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
