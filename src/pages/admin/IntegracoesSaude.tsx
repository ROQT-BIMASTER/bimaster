import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, ShieldAlert, KeyRound, Clock } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ErpConfigRow = {
  id: string;
  empresa_id: number | null;
  config_key: string;
  ativo: boolean | null;
  api_key_hash: string | null;
  api_key: string | null;
  api_key_expira_em: string | null;
  api_key_anterior_expira_em: string | null;
  updated_at: string | null;
};

type ErpApiKeyRow = {
  id: string;
  empresa_id: string;
  nome_responsavel: string | null;
  active: boolean | null;
  expires_at: string | null;
  request_count: number | null;
  created_at: string;
};

function statusOf(expira: string | null) {
  if (!expira) return { label: "Sem prazo", tone: "secondary" as const, days: null as number | null };
  const days = differenceInDays(new Date(expira), new Date());
  if (days < 0) return { label: "Expirada", tone: "destructive" as const, days };
  if (days <= 5) return { label: "Crítico", tone: "destructive" as const, days };
  if (days <= 15) return { label: "Atenção", tone: "default" as const, days };
  return { label: "OK", tone: "secondary" as const, days };
}

export default function IntegracoesSaude() {
  const { data: erpConfig } = useQuery({
    queryKey: ["erp_config_health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_config")
        .select("id, empresa_id, config_key, ativo, api_key_hash, api_key, api_key_expira_em, api_key_anterior_expira_em, updated_at")
        .eq("config_key", "api_key");
      if (error) throw error;
      return (data ?? []) as ErpConfigRow[];
    },
  });

  const { data: portalKeys } = useQuery({
    queryKey: ["erp_api_keys_health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_api_keys")
        .select("id, empresa_id, nome_responsavel, active, expires_at, request_count, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ErpApiKeyRow[];
    },
  });

  const allKeys = [
    ...(erpConfig ?? []).map((r) => ({
      origem: "ERP Huggs",
      nome: `Empresa ${r.empresa_id ?? "?"}`,
      ativo: !!r.ativo,
      hash_ok: !!r.api_key_hash,
      plaintext: !!r.api_key,
      expira_em: r.api_key_expira_em,
      anterior_expira_em: r.api_key_anterior_expira_em,
      ultima_atualizacao: r.updated_at,
    })),
    ...(portalKeys ?? []).map((r) => ({
      origem: "Portal Integração",
      nome: r.nome_responsavel ?? `Empresa ${r.empresa_id}`,
      ativo: !!r.active,
      hash_ok: true,
      plaintext: false,
      expira_em: r.expires_at,
      anterior_expira_em: null,
      ultima_atualizacao: r.created_at,
    })),
  ];

  const criticas = allKeys.filter((k) => {
    const s = statusOf(k.expira_em);
    return k.ativo && (s.label === "Crítico" || s.label === "Expirada");
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" /> Saúde das Integrações
        </h1>
        <p className="text-sm text-muted-foreground">
          Status, validade e rotação das chaves de API utilizadas pelo backend.
        </p>
      </div>

      {criticas.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Ação necessária</AlertTitle>
          <AlertDescription>
            {criticas.length} chave(s) ativa(s) expirando em ≤ 5 dias ou já expiradas. Rotacione antes que o parceiro pare de autenticar.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Chaves de API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {allKeys.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma chave configurada.</p>
          )}
          {allKeys.map((k, i) => {
            const s = statusOf(k.expira_em);
            return (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-4"
              >
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{k.nome}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span>{k.origem}</span>
                    <span>•</span>
                    <span>{k.ativo ? "Ativa" : "Inativa"}</span>
                    <span>•</span>
                    <span>
                      {k.hash_ok ? "Armazenada com hash" : "Sem hash"}
                      {k.plaintext ? " (com fallback texto)" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      {k.expira_em
                        ? format(new Date(k.expira_em), "dd/MM/yyyy", { locale: ptBR })
                        : "Sem prazo definido"}
                    </div>
                    {s.days !== null && (
                      <div className="text-xs text-muted-foreground">
                        {s.days >= 0 ? `${s.days} dia(s) restantes` : `expirada há ${Math.abs(s.days)} dia(s)`}
                      </div>
                    )}
                  </div>
                  <Badge variant={s.tone}>{s.label}</Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona a rotação</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            • Cada chave possui prazo de validade. Quando faltarem 30 dias, uma nova chave é gerada em paralelo (período de graça)
            e ambas funcionam simultaneamente até a antiga vencer.
          </p>
          <p>
            • Chaves novas são armazenadas apenas como hash (SHA-256). O texto original é exibido uma única vez na criação.
          </p>
          <p>
            • Comparações em produção usam tempo constante (timing-safe) para mitigar ataques de side-channel.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
