import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldAlert, KeyRound, Clock, Activity, AlertTriangle, RefreshCw, Copy, Check } from "lucide-react";
import { differenceInDays, format, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
      origem: "ERP Huggs" as const,
      empresa_id: r.empresa_id,
      nome: `Empresa ${r.empresa_id ?? "?"}`,
      ativo: !!r.ativo,
      hash_ok: !!r.api_key_hash,
      plaintext: !!r.api_key,
      expira_em: r.api_key_expira_em,
      anterior_expira_em: r.api_key_anterior_expira_em,
      ultima_atualizacao: r.updated_at,
      rotatable: true,
    })),
    ...(portalKeys ?? []).map((r) => ({
      origem: "Portal Integração" as const,
      empresa_id: null as number | null,
      nome: r.nome_responsavel ?? `Empresa ${r.empresa_id}`,
      ativo: !!r.active,
      hash_ok: true,
      plaintext: false,
      expira_em: r.expires_at,
      anterior_expira_em: null,
      ultima_atualizacao: r.created_at,
      rotatable: false,
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
                  {k.rotatable && k.empresa_id != null && (
                    <RotateButton empresaId={k.empresa_id} />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AnomaliasCard />

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

type LogRow = {
  endpoint: string;
  method: string;
  ip_address: string | null;
  success: boolean | null;
  error_message: string | null;
  key_preview: string | null;
  created_at: string;
};

function AnomaliasCard() {
  const since24h = subHours(new Date(), 24).toISOString();
  const { data: logs } = useQuery({
    queryKey: ["api_security_log_24h"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_security_log")
        .select("endpoint, method, ip_address, success, error_message, key_preview, created_at")
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
    refetchInterval: 60_000,
  });

  const total = logs?.length ?? 0;
  const fails = (logs ?? []).filter((l) => l.success === false);
  const failRate = total > 0 ? Math.round((fails.length / total) * 100) : 0;

  const topIps = countTop(fails.map((l) => l.ip_address ?? "desconhecido"), 5);
  const topEndpoints = countTop(fails.map((l) => `${l.method} ${l.endpoint}`), 5);
  const topErrors = countTop(fails.map((l) => l.error_message ?? "sem mensagem"), 5);

  const critico = failRate >= 50 && fails.length >= 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" /> Anomalias de uso (últimas 24h)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat label="Requisições" value={total.toLocaleString("pt-BR")} />
          <Stat label="Falhas de auth" value={fails.length.toLocaleString("pt-BR")} tone={fails.length > 0 ? "warn" : "default"} />
          <Stat label="Taxa de falha" value={`${failRate}%`} tone={failRate >= 50 ? "danger" : failRate >= 20 ? "warn" : "default"} />
        </div>

        {critico && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Taxa de falha elevada</AlertTitle>
            <AlertDescription>
              Mais de 50% das requisições falharam nas últimas 24h. Possível ataque, configuração incorreta no parceiro ou chave expirada.
            </AlertDescription>
          </Alert>
        )}

        <RankingList title="IPs com mais falhas" rows={topIps} />
        <RankingList title="Endpoints com mais falhas" rows={topEndpoints} />
        <RankingList title="Mensagens de erro mais frequentes" rows={topErrors} />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" | "danger" }) {
  const cls =
    tone === "danger" ? "text-destructive" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function RankingList({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-2">{title}</div>
      <div className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm border-b border-border/40 pb-1">
            <span className="truncate text-foreground/90 mr-3" title={k}>{k}</span>
            <Badge variant="secondary">{v}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function countTop(values: string[], n: number): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
}
