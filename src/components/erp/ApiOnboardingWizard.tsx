import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Copy, Rocket, FlaskConical, Terminal, ArrowRight, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const STEPS = [
  { id: 1, title: "Copiar API Key", desc: "Obtenha sua chave de API para autenticação" },
  { id: 2, title: "Teste Sandbox", desc: "Teste no ambiente simulado" },
  { id: 3, title: "Teste Produção", desc: "Valide com sua API Key real" },
  { id: 4, title: "Pronto!", desc: "Configure seu sistema para chamadas reais" },
];

export default function ApiOnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem("erp-onboarding-step");
    return saved ? parseInt(saved) : 1;
  });
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("erp-onboarding-done") === "true";
  });
  const [sandboxResult, setSandboxResult] = useState<{ ok: boolean; data?: any } | null>(null);
  const [prodResult, setProdResult] = useState<{ ok: boolean; data?: any; status?: number } | null>(null);
  const [testingSandbox, setTestingSandbox] = useState(false);
  const [testingProd, setTestingProd] = useState(false);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    localStorage.setItem("erp-onboarding-step", String(currentStep));
    if (currentStep > 4) localStorage.setItem("erp-onboarding-done", "true");
  }, [currentStep]);

  const handleSandboxTest = async () => {
    setTestingSandbox(true);
    setSandboxResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("api-sandbox", {
        body: { path: "/contas-pagar-api/status", method: "GET", body: null },
      });
      if (error) {
        setSandboxResult({ ok: false, data: { error: error.message } });
      } else {
        setSandboxResult({ ok: true, data });
      }
    } catch (e: any) {
      setSandboxResult({ ok: false, data: { error: e.message } });
    } finally {
      setTestingSandbox(false);
    }
  };

  const handleProdTest = async () => {
    if (!apiKey) {
      toast.error("Cole sua API Key no passo 1 primeiro.");
      return;
    }
    setTestingProd(true);
    setProdResult(null);
    try {
      const res = await fetch(`${BASE_URL}/contas-pagar-api/status`, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setProdResult({ ok: true, data, status: res.status });
        if (currentStep === 3) setCurrentStep(4);
      } else {
        setProdResult({ ok: false, data, status: res.status });
      }
    } catch (e: any) {
      setProdResult({ ok: false, data: { error: e.message } });
    } finally {
      setTestingProd(false);
    }
  };

  const renderProdError = () => {
    if (!prodResult || prodResult.ok) return null;
    const status = prodResult.status;
    let msg = "";
    if (status === 401) msg = "❌ Erro 401 — API Key inválida ou não encontrada. Verifique se copiou a chave corretamente.";
    else if (status === 403) msg = "❌ Erro 403 — Chave reconhecida mas sem permissão para este recurso.";
    else if (status === 429) msg = "❌ Erro 429 — Rate limit excedido. Aguarde alguns segundos e tente novamente.";
    else msg = `❌ Erro ${status || "de rede"}: ${JSON.stringify(prodResult.data?.error || prodResult.data)}`;
    return (
      <div className="text-[10px] bg-red-500/10 border border-red-500/20 rounded p-2 text-red-600">{msg}</div>
    );
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors mb-4"
      >
        <Rocket className="h-3.5 w-3.5" />
        <span>Reabrir Guia de Início Rápido</span>
      </button>
    );
  }

  return (
    <Card className="mb-4 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Início Rápido — Sua Primeira Integração</span>
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCollapsed(true)}>
            Fechar
          </Button>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-4">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                currentStep > step.id
                  ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                  : currentStep === step.id
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground border border-transparent"
              }`}>
                {currentStep > step.id ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="font-bold">{step.id}</span>
                )}
                <span className="hidden sm:inline">{step.title}</span>
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 1 — API Key */}
        {currentStep === 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Copie sua API Key da tabela acima (ou gere uma nova). Cole abaixo para confirmar:
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 text-xs font-mono border rounded px-2 py-1.5 bg-background"
                placeholder="huggs-erp-xxxxxxxxxxxxxxxx"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={!apiKey.startsWith("huggs-erp-")}
                onClick={() => setCurrentStep(2)}
              >
                Confirmar <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Sandbox Test */}
        {currentStep === 2 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Primeiro, teste no <strong>sandbox</strong> (simulação sem gravar dados):
            </p>
            <div className="flex gap-2 items-center">
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSandboxTest} disabled={testingSandbox}>
                <FlaskConical className="h-3.5 w-3.5" />
                {testingSandbox ? "Testando..." : "Testar Sandbox"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  const curlCmd = `curl -X GET "${BASE_URL}/contas-pagar-api/status" \\\n  -H "x-api-key: ${apiKey || 'SUA_CHAVE'}" \\\n  -H "Content-Type: application/json"`;
                  navigator.clipboard.writeText(curlCmd);
                  toast.success("cURL copiado!");
                }}
              >
                <Terminal className="h-3.5 w-3.5" />
                Copiar cURL
              </Button>
            </div>
            {sandboxResult && (
              <div className={`text-[10px] rounded p-2 border ${sandboxResult.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : "bg-red-500/10 border-red-500/20 text-red-600"}`}>
                {sandboxResult.ok ? (
                  <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Sandbox OK — Resposta simulada recebida com sucesso!</span>
                ) : (
                  <span>❌ Sandbox falhou: {JSON.stringify(sandboxResult.data?.error)}</span>
                )}
              </div>
            )}
            {sandboxResult?.ok && (
              <Button size="sm" className="h-7 text-xs" onClick={() => setCurrentStep(3)}>
                Próximo: Testar em Produção <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        )}

        {/* Step 3 — Production Test */}
        {currentStep === 3 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Agora teste sua API Key <strong>em produção</strong> — chamada real ao <code className="bg-muted px-1 rounded">GET /status</code>:
            </p>
            <div className="flex gap-2 items-center">
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleProdTest} disabled={testingProd}>
                {testingProd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                {testingProd ? "Validando..." : "Testar Produção"}
              </Button>
              <code className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded font-mono truncate max-w-[200px]">
                x-api-key: {apiKey.slice(0, 18)}...
              </code>
            </div>
            {prodResult?.ok && (
              <div className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 rounded p-2 text-emerald-700 space-y-1">
                <span className="flex items-center gap-1 font-medium"><Check className="h-3 w-3" /> Produção OK — Sua API Key está funcionando!</span>
                <pre className="font-mono overflow-auto max-h-16">{JSON.stringify(prodResult.data, null, 2)}</pre>
              </div>
            )}
            {renderProdError()}
          </div>
        )}

        {/* Step 4 — Ready */}
        {currentStep === 4 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              🎉 Tudo pronto! Sandbox ✅ + Produção ✅ — Configure seu sistema:
            </p>
            <div className="bg-muted rounded p-2 text-[10px] font-mono space-y-1">
              <div><span className="text-muted-foreground">Base URL:</span> {BASE_URL}</div>
              <div><span className="text-muted-foreground">Header:</span> x-api-key: [sua chave]</div>
              <div><span className="text-muted-foreground">Content-Type:</span> application/json</div>
            </div>
            <Button size="sm" className="h-7 text-xs" variant="outline" onClick={() => { setCurrentStep(5); setCollapsed(true); }}>
              <Check className="h-3 w-3 mr-1" /> Concluir Onboarding
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
