import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Copy, Rocket, FlaskConical, Terminal, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const STEPS = [
  { id: 1, title: "Copiar API Key", desc: "Obtenha sua chave de API para autenticação" },
  { id: 2, title: "Primeira Chamada", desc: "Teste o endpoint /status no sandbox" },
  { id: 3, title: "Verificar Resposta", desc: "Valide o retorno da API" },
  { id: 4, title: "Pronto para Produção", desc: "Configure seu sistema para chamadas reais" },
];

export default function ApiOnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem("erp-onboarding-step");
    return saved ? parseInt(saved) : 1;
  });
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("erp-onboarding-done") === "true";
  });
  const [testResult, setTestResult] = useState<{ ok: boolean; data?: any } | null>(null);
  const [testing, setTesting] = useState(false);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    localStorage.setItem("erp-onboarding-step", String(currentStep));
    if (currentStep > 4) localStorage.setItem("erp-onboarding-done", "true");
  }, [currentStep]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("api-sandbox", {
        body: { path: "/contas-pagar-api/status", method: "GET", body: null },
      });
      if (error) {
        setTestResult({ ok: false, data: { error: error.message } });
      } else {
        setTestResult({ ok: true, data });
        if (currentStep === 2) setCurrentStep(3);
      }
    } catch (e: any) {
      setTestResult({ ok: false, data: { error: e.message } });
    } finally {
      setTesting(false);
    }
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

        {/* Step Content */}
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

        {currentStep === 2 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Vamos testar uma chamada ao <code className="bg-muted px-1 rounded">GET /status</code> com sua API Key:
            </p>
            <div className="flex gap-2 items-center">
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleTest} disabled={testing}>
                <FlaskConical className="h-3.5 w-3.5" />
                {testing ? "Testando..." : "Executar Teste"}
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
            {testResult && !testResult.ok && (
              <div className="text-[10px] bg-red-500/10 border border-red-500/20 rounded p-2 text-red-600">
                {testResult.data?.error?.includes("401") || testResult.data?.error?.includes("Unauthorized")
                  ? "❌ Erro 401 — API Key inválida ou não enviada. Verifique se copiou a chave corretamente."
                  : testResult.data?.error?.includes("403")
                  ? "❌ Erro 403 — Chave ativa mas sem permissão. Verifique a empresa vinculada."
                  : testResult.data?.error?.includes("429")
                  ? "❌ Erro 429 — Rate limit excedido. Aguarde alguns segundos e tente novamente."
                  : `❌ Erro: ${JSON.stringify(testResult.data?.error || testResult.data)}`}
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Resposta recebida:</p>
            {testResult && (
              <pre className="text-[10px] bg-muted rounded p-2 overflow-auto max-h-24 font-mono">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            )}
            <div className="flex items-center gap-2">
              {testResult?.ok ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                  <Check className="h-3 w-3 mr-1" /> Resposta OK
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">Erro na resposta</Badge>
              )}
              <Button size="sm" className="h-7 text-xs" onClick={() => setCurrentStep(4)}>
                Próximo <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              🎉 Tudo pronto! Configure seu sistema com as seguintes informações:
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
