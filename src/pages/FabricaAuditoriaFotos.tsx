import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Download, RefreshCw, ImageIcon, Upload, RefreshCcw, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";

type AuditRow = {
  id: string;
  produto_id: string;
  acao: string;
  dados_anteriores: any;
  dados_novos: any;
  usuario_id: string | null;
  created_at: string;
  produto?: { codigo: string | null; nome: string | null } | null;
  usuario?: { nome: string | null; email: string | null } | null;
};

const ACOES = ["foto_upload", "foto_update", "foto_delete"] as const;

const ACAO_META: Record<string, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" }> = {
  foto_upload: { label: "Upload", icon: Upload, variant: "default" },
  foto_update: { label: "Atualização", icon: RefreshCcw, variant: "secondary" },
  foto_delete: { label: "Exclusão", icon: Trash2, variant: "destructive" },
};

export default function FabricaAuditoriaFotos() {
  const { hasPermission, loading: permLoading } = useScreenPermissions();
  const [busca, setBusca] = useState("");
  const [filtroAcao, setFiltroAcao] = useState<string>("todas");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["fabrica-auditoria-fotos"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data: hist, error } = await supabase
        .from("fabrica_produtos_historico")
        .select("id,produto_id,acao,dados_anteriores,dados_novos,usuario_id,created_at")
        .in("acao", ACOES as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const rows = (hist || []) as AuditRow[];
      const produtoIds = Array.from(new Set(rows.map((r) => r.produto_id)));
      const userIds = Array.from(new Set(rows.map((r) => r.usuario_id).filter(Boolean) as string[]));

      const [{ data: produtos }, { data: profiles }] = await Promise.all([
        produtoIds.length
          ? supabase.from("fabrica_produtos").select("id,codigo,nome").in("id", produtoIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from("profiles").select("id,nome,email").in("id", userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const pMap = new Map((produtos || []).map((p: any) => [p.id, p]));
      const uMap = new Map((profiles || []).map((u: any) => [u.id, u]));
      return rows.map((r) => ({
        ...r,
        produto: pMap.get(r.produto_id) || null,
        usuario: r.usuario_id ? uMap.get(r.usuario_id) || null : null,
      }));
    },
    enabled: !permLoading && hasPermission("fabrica_produtos"),
  });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data || []).filter((r) => {
      if (filtroAcao !== "todas" && r.acao !== filtroAcao) return false;
      if (!q) return true;
      const path = (r.dados_novos?.path || r.dados_anteriores?.path || "").toLowerCase();
      return (
        r.produto?.codigo?.toLowerCase().includes(q) ||
        r.produto?.nome?.toLowerCase().includes(q) ||
        r.usuario?.nome?.toLowerCase().includes(q) ||
        r.usuario?.email?.toLowerCase().includes(q) ||
        path.includes(q)
      );
    });
  }, [data, busca, filtroAcao]);

  const totais = useMemo(() => {
    const base = { foto_upload: 0, foto_update: 0, foto_delete: 0 };
    (data || []).forEach((r) => {
      if (r.acao in base) base[r.acao as keyof typeof base]++;
    });
    return base;
  }, [data]);

  const exportCsv = () => {
    const header = ["data", "acao", "produto_codigo", "produto_nome", "usuario_nome", "usuario_email", "path"];
    const lines = filtradas.map((r) =>
      [
        format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
        r.acao,
        r.produto?.codigo || "",
        r.produto?.nome || "",
        r.usuario?.nome || "",
        r.usuario?.email || "",
        r.dados_novos?.path || r.dados_anteriores?.path || "",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([header.join(",") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-fotos-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (permLoading) {
    return <DashboardLayout><div className="p-8 text-center">Carregando…</div></DashboardLayout>;
  }
  if (!hasPermission("fabrica_produtos")) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb
          moduleName="Fábrica"
          moduleHref="/dashboard/fabrica"
          currentPage="Auditoria de Fotos"
        />

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Auditoria de Fotos dos Produtos</h1>
            <p className="text-sm text-muted-foreground">
              Registro completo de uploads, substituições e exclusões no bucket de fotos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={exportCsv} disabled={!filtradas.length}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.keys(totais) as Array<keyof typeof totais>).map((k) => {
            const meta = ACAO_META[k];
            const Icon = meta.icon;
            return (
              <Card key={k}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2"><Icon className="h-5 w-5" /></div>
                  <div>
                    <div className="text-xs text-muted-foreground">{meta.label}</div>
                    <div className="text-2xl font-bold">{totais[k]}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eventos recentes (últimos 500)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                placeholder="Buscar por produto, usuário ou caminho…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="max-w-md"
              />
              <Select value={filtroAcao} onValueChange={setFiltroAcao}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as ações</SelectItem>
                  <SelectItem value="foto_upload">Upload</SelectItem>
                  <SelectItem value="foto_update">Atualização</SelectItem>
                  <SelectItem value="foto_delete">Exclusão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Arquivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>
                )}
                {!isLoading && !filtradas.length && (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    <ImageIcon className="h-6 w-6 mx-auto mb-2 opacity-40" />
                    Nenhum evento encontrado.
                  </TableCell></TableRow>
                )}
                {filtradas.map((r) => {
                  const meta = ACAO_META[r.acao];
                  const path = r.dados_novos?.path || r.dados_anteriores?.path || "—";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta?.variant || "secondary"}>{meta?.label || r.acao}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{r.produto?.codigo || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[280px]">{r.produto?.nome || ""}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{r.usuario?.nome || "Sistema"}</div>
                        <div className="text-xs text-muted-foreground">{r.usuario?.email || ""}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs break-all max-w-[320px]">{path}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
