/**
 * Admin — Auditoria de Uploads Rejeitados (bucket projeto-anexos)
 *
 * Lista tentativas de upload que o trigger `enforce_projeto_anexos_limits`
 * rejeitou no backend (tipo ou tamanho). Útil para diagnosticar falhas
 * recorrentes em produção — ex.: usuário tentando subir MP4 de 250 MB
 * repetidamente, PDF de 40 MB, etc.
 *
 * Acesso restrito a `has_role(auth.uid(), 'admin')` via RLS.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AuditRow {
  id: string;
  created_at: string;
  bucket_id: string;
  object_name: string;
  owner_id: string | null;
  file_size: number | null;
  mime_type: string | null;
  extension: string | null;
  is_video: boolean | null;
  rejection_code: string;
  rejection_reason: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export default function UploadRejeicoesAudit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCode, setFiltroCode] = useState<string>("");
  const [busca, setBusca] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projeto_anexos_upload_audit")
      .select(
        "id, created_at, bucket_id, object_name, owner_id, file_size, mime_type, extension, is_video, rejection_code, rejection_reason",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Falha ao carregar auditoria", { description: error.message });
    } else {
      setRows((data as AuditRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtroCode && r.rejection_code !== filtroCode) return false;
      if (!q) return true;
      return (
        r.object_name.toLowerCase().includes(q) ||
        (r.mime_type ?? "").toLowerCase().includes(q) ||
        (r.owner_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, filtroCode, busca]);

  const grouped = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of rows) {
      acc[r.rejection_code] = (acc[r.rejection_code] ?? 0) + 1;
    }
    return acc;
  }, [rows]);

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Uploads Rejeitados no Backend</h1>
        <p className="text-sm text-muted-foreground">
          Tentativas bloqueadas pelo servidor no bucket <code>projeto-anexos</code> por
          exceder o tipo/tamanho permitidos. Últimos 500 eventos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          variant={filtroCode === "" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFiltroCode("")}
        >
          Todos ({rows.length})
        </Badge>
        {Object.entries(grouped).map(([code, count]) => (
          <Badge
            key={code}
            variant={filtroCode === code ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFiltroCode(filtroCode === code ? "" : code)}
          >
            {code} ({count})
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Buscar por nome, mime ou owner_id…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-md mb-3"
          />

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Nenhuma rejeição registrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDistanceToNow(new Date(r.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={r.is_video ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {r.rejection_code}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1 max-w-md">
                          {r.rejection_reason}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-xs truncate">
                        {r.object_name}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatBytes(r.file_size)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.mime_type || `.${r.extension ?? "?"}`}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.owner_id ? r.owner_id.slice(0, 8) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
