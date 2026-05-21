// src/pages/configuracoes/IntegracoesNotion.tsx
import { BookOpen, ExternalLink, Loader2, Plug, Unplug, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNotionConnection, useNotionExportLog } from "@/hooks/useNotionConnection";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function IntegracoesNotion() {
  const { connection, connect, disconnect } = useNotionConnection();
  const log = useNotionExportLog(20);
  const conn = connection.data;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Integração com Notion
        </h1>
        <p className="text-sm text-muted-foreground">
          Conecte sua conta Notion para enviar briefings diretamente para o database{" "}
          <strong>Briefings bimaster</strong> no seu workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conta conectada</CardTitle>
        </CardHeader>
        <CardContent>
          {connection.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : conn ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {conn.workspace_icon && (
                    <img src={conn.workspace_icon} alt="" className="h-10 w-10 rounded" />
                  )}
                  <div>
                    <div className="font-medium">
                      {conn.workspace_name || "Workspace Notion"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {conn.notion_user_name ? `${conn.notion_user_name} · ` : ""}
                      Conectado em{" "}
                      {format(new Date(conn.created_at), "dd 'de' MMM yyyy", { locale: ptBR })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => connect.mutate()}
                    disabled={connect.isPending}
                  >
                    {connect.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Plug className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Reconectar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnect.mutate()}
                    disabled={disconnect.isPending}
                  >
                    <Unplug className="h-3.5 w-3.5 mr-1.5" /> Desconectar
                  </Button>
                </div>
              </div>
              {conn.briefings_database_url && (
                <a
                  href={conn.briefings_database_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir database "Briefings bimaster" no Notion
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Nenhuma conta Notion conectada ainda.
              </p>
              <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
                {connect.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4 mr-2" />
                )}
                Conectar Notion
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de envios</CardTitle>
        </CardHeader>
        <CardContent>
          {log.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : !log.data?.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum briefing enviado para o Notion ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {log.data.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {row.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {format(new Date(row.created_at), "dd/MM/yyyy HH:mm")}
                      </div>
                      {row.error_message && (
                        <div className="text-xs text-destructive truncate">
                          {row.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={row.status === "success" ? "default" : "destructive"}>
                      {row.status === "success" ? "Sucesso" : "Erro"}
                    </Badge>
                    {row.notion_page_url && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={row.notion_page_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
