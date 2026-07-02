/**
 * Admin — Diagnóstico de Storage Buckets
 *
 * Consulta em tempo real a configuração efetiva de cada bucket relevante
 * (limite de tamanho + MIME types aceitos) diretamente do backend, via
 * a função administrativa `storage-bucket-upload-limits` em modo `list`.
 *
 * Serve para confirmar visualmente se o teto de 1 GB e os MIMEs Adobe (.ai /
 * .psd) estão de fato aplicados no ambiente em que a app está rodando —
 * evitando ficar dependente de logs de erro para descobrir divergências.
 *
 * O botão "Ressincronizar" chama a mesma função em modo `sync`, reaplicando
 * o limite de 1 GB e a lista de MIMEs Adobe em todos os buckets alvo.
 *
 * Acesso: restrito a `has_role(auth.uid(), 'admin')` (validado server-side).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_LABEL } from "@/lib/upload/limits";

interface BucketRow {
  id: string;
  name: string;
  public: boolean;
  file_size_limit: number | null;
  allowed_mime_types: string[] | null;
  created_at?: string;
  updated_at?: string;
}

interface ListResponse {
  action: "list";
  target_file_size_limit: number;
  adobe_mime_types: string[];
  buckets: BucketRow[];
}

interface SyncResponse {
  action: "sync";
  target_file_size_limit: number;
  adobe_mime_types: string[];
  updates: Array<{ id: string; ok: boolean; error: string | null }>;
  after: BucketRow[];
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "sem teto explícito";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${bytes} B`;
}

export default function DiagnosticoBuckets() {
  const [rows, setRows] = useState<BucketRow[]>([]);
  const [adobeMimes, setAdobeMimes] = useState<string[]>([]);
  const [target, setTarget] = useState<number>(UPLOAD_MAX_BYTES);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke<ListResponse>(
      "storage-bucket-upload-limits",
      { body: { action: "list" } },
    );
    setLoading(false);
    if (error || !data) {
      toast.error("Falha ao consultar buckets", { description: error?.message ?? "Sem resposta." });
      return;
    }
    setRows(data.buckets ?? []);
    setAdobeMimes(data.adobe_mime_types ?? []);
    setTarget(data.target_file_size_limit ?? UPLOAD_MAX_BYTES);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const resync = useCallback(async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke<SyncResponse>(
      "storage-bucket-upload-limits",
      { body: { action: "sync" } },
    );
    setSyncing(false);
    if (error || !data) {
      toast.error("Falha ao ressincronizar", { description: error?.message ?? "Sem resposta." });
      return;
    }
    const okCount = data.updates.filter((u) => u.ok).length;
    const failCount = data.updates.length - okCount;
    toast.success(`Ressincronização concluída: ${okCount} OK, ${failCount} falhas.`);
    setRows(data.after ?? []);
  }, []);

  const stats = useMemo(() => {
    const totalOk = rows.filter((r) => (r.file_size_limit ?? 0) >= target).length;
    const missingAdobe = rows.filter((r) => {
      if (!r.allowed_mime_types) return false; // sem whitelist => aceita qualquer
      return adobeMimes.some((m) => !r.allowed_mime_types!.includes(m));
    });
    return { totalOk, totalBuckets: rows.length, missingAdobe };
  }, [rows, target, adobeMimes]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Diagnóstico de Storage Buckets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Limite oficial do sistema: <strong>{UPLOAD_MAX_LABEL}</strong> por arquivo. Esta tela
             mostra o teto efetivo e a whitelist de MIMEs aplicada em cada bucket monitorado no ambiente atual.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading || syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Recarregar
          </Button>
          <Button onClick={resync} disabled={syncing || loading}>
            {syncing ? "Ressincronizando..." : "Ressincronizar 1 GB + Adobe"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Buckets no limite</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.totalOk} / {stats.totalBuckets}</div>
            <div className="text-xs text-muted-foreground">com {UPLOAD_MAX_LABEL} ou mais</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Sem MIMEs Adobe</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.missingAdobe.length}</div>
              <div className="text-xs text-muted-foreground">inclui os buckets China monitorados</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Alvo backend</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatBytes(target)}</div>
             <div className="text-xs text-muted-foreground">valor lido do backend</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Buckets monitorados</CardTitle></CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">Carregando configuração dos buckets…</div>}
          {!loading && rows.length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhum bucket retornado.</div>
          )}
          {!loading && rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Público</TableHead>
                  <TableHead>Limite efetivo</TableHead>
                  <TableHead>Aceita .ai/.psd</TableHead>
                  <TableHead>MIMEs whitelisted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => {
                  const okSize = (b.file_size_limit ?? 0) >= target;
                  const acceptsAll = !b.allowed_mime_types || b.allowed_mime_types.length === 0;
                  const acceptsAdobe = acceptsAll ||
                    adobeMimes.every((m) => b.allowed_mime_types!.includes(m));
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.id}</TableCell>
                      <TableCell>
                        <Badge variant={b.public ? "destructive" : "secondary"}>
                          {b.public ? "public" : "private"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          {okSize
                            ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                            : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                          {formatBytes(b.file_size_limit)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {acceptsAdobe
                          ? <Badge variant="secondary">Sim</Badge>
                          : <Badge variant="destructive">Faltando MIMEs</Badge>}
                      </TableCell>
                      <TableCell className="max-w-md">
                        {acceptsAll ? (
                          <span className="text-xs text-muted-foreground">Sem whitelist (aceita qualquer MIME)</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {b.allowed_mime_types!.map((m) => (
                              <Badge key={m} variant="outline" className="text-[10px] font-mono">{m}</Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>MIMEs Adobe monitorados</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {adobeMimes.map((m) => (
              <Badge key={m} variant="outline" className="font-mono text-xs">{m}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
