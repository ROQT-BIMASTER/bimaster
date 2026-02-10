import { useTeamFormTokens } from "@/hooks/useTeamFormTokens";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Ban, CheckCircle2, Clock, Copy, FileText, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

export function FormSubmissionsPanel() {
  const { tokens, submissions, isLoadingTokens, isLoadingSubmissions, revokeToken } = useTeamFormTokens();

  if (isLoadingTokens || isLoadingSubmissions) {
    return <Skeleton className="h-64 w-full" />;
  }

  const statusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    if (status === "revoked") return <Badge variant="destructive">Revogado</Badge>;
    if (status === "expired" || isExpired) return <Badge variant="secondary">Expirado</Badge>;
    return <Badge className="bg-green-600 hover:bg-green-700">Ativo</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Tokens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Links Gerados
          </CardTitle>
          <CardDescription>Formulários compartilhados com sua equipe</CardDescription>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum link gerado ainda. Use o botão "Gerar Link Formulário" acima.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código / Link</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Preenchimentos</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.label}</TableCell>
                    <TableCell>
                      {(t as any).token_plain ? (
                        <div className="flex items-center gap-1">
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                            {(t as any).token_plain}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              const link = `${window.location.origin}/formulario-equipe?token=${(t as any).token_plain}`;
                              navigator.clipboard.writeText(link);
                              toast({ title: "Link copiado!" });
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(t.status, t.expires_at)}</TableCell>
                    <TableCell className="text-center">
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(t.expires_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {t.status === "active" && new Date(t.expires_at) > new Date() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeToken.mutate(t.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Cadastros Recebidos
            <Badge variant="outline" className="ml-2">{submissions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum cadastro recebido ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Camiseta</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Vinculado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.nome_completo}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {s.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                      </TableCell>
                      <TableCell className="text-sm">{s.whatsapp}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.tamanho_camiseta}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{s.equipe_comercial || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(s.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {s.vinculado ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
