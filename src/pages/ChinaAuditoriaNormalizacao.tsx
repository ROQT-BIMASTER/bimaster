import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, ArrowLeft, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";

interface AuditRow {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_label: string | null;
  produto_codigo: string | null;
  submissao_id: string | null;
  descricao: string | null;
  payload: Record<string, any> | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default function ChinaAuditoriaNormalizacao() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("china_timeline_eventos")
      .select("id, created_at, actor_id, actor_label, produto_codigo, submissao_id, descricao, payload")
      .eq("kind", "submissao_normalizada_legado")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) {
      setRows(data as AuditRow[]);
      const ids = Array.from(
        new Set((data as AuditRow[]).map((r) => r.actor_id).filter(Boolean) as string[]),
      );
      if (ids.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        const map: Record<string, ProfileRow> = {};
        for (const p of (profs || []) as ProfileRow[]) map[p.id] = p;
        setProfiles(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const actor = r.actor_id ? profiles[r.actor_id] : null;
      const haystack = [
        r.produto_codigo,
        r.descricao,
        actor?.full_name,
        actor?.email,
        r.payload?.numero_ordem,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, profiles, search]);

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        titlePt="Auditoria de Normalização de Status"
        titleCn="状态标准化审计"
        subtitle='Histórico de submissões cujo status legado "enviado" foi convertido para "enviado_brasil".'
        icon={History}
        iconTone="primary"
        actions={
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/fabrica-china/caixa-entrada")}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, OC, usuário..."
          className="h-8 text-xs max-w-md"
        />
        <Badge variant="secondary" className="text-[11px]">
          {filtered.length} de {rows.length}
        </Badge>
      </div>

      <div className="rounded-md border border-border bg-card/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">Data</TableHead>
              <TableHead>Submissão</TableHead>
              <TableHead>Conversão</TableHead>
              <TableHead>Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                  Nenhuma normalização registrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const actor = r.actor_id ? profiles[r.actor_id] : null;
                const de = r.payload?.de ?? "enviado";
                const para = r.payload?.para ?? "enviado_brasil";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.produto_codigo ?? "—"}</div>
                      {r.payload?.numero_ordem && (
                        <div className="text-muted-foreground">OC {r.payload.numero_ordem}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="mr-1">{de}</Badge>
                      →
                      <Badge variant="default" className="ml-1">{para}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {actor ? (
                        <>
                          <div className="font-medium">{actor.full_name ?? actor.email ?? "—"}</div>
                          {actor.full_name && actor.email && (
                            <div className="text-muted-foreground">{actor.email}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Sistema</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </ChinaPageShell>
  );
}
