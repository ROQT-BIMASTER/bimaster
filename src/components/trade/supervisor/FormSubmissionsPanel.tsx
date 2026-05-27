import { useTeamFormTokens } from "@/hooks/useTeamFormTokens";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Ban, BarChart3, CheckCircle2, Clock, Copy, ExternalLink, FileText, Layers, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { buildDynamicFormPublicUrl, buildTeamFormTokenUrl } from "@/lib/constants/publicDomain";
import { DynamicFormResponsesDialog } from "./DynamicFormResponsesDialog";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

export function FormSubmissionsPanel() {
  const { tokens, submissions, isLoadingTokens, isLoadingSubmissions, revokeToken, deleteToken } = useTeamFormTokens();
  const navigate = useNavigate();
  const [selectedForm, setSelectedForm] = useState<{ id: string; name: string } | null>(null);

  const dynamicFormsQuery = useQuery({
    queryKey: ["my-dynamic-forms-with-counts"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return [] as Array<{ id: string; name: string; status: string; created_at: string; response_count: number; last_response_at: string | null }>;
      const { data: forms, error } = await supabase
        .from("dynamic_forms")
        .select("id, name, status, created_at")
        .eq("created_by", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (forms || []).map((f) => f.id);
      let responses: Array<{ form_id: string; created_at: string }> = [];
      if (ids.length > 0) {
        const { data: rs } = await supabase
          .from("dynamic_form_responses")
          .select("form_id, created_at")
          .in("form_id", ids);
        responses = rs || [];
      }
      return (forms || []).map((f) => {
        const rs = responses.filter((r) => r.form_id === f.id);
        const last = rs.reduce<string | null>(
          (acc, r) => (!acc || r.created_at > acc ? r.created_at : acc),
          null,
        );
        return { ...f, response_count: rs.length, last_response_at: last };
      });
    },
  });

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
      {/* Formulários Personalizados (Dynamic Forms) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Formulários Personalizados
          </CardTitle>
          <CardDescription>
            Formulários criados por você no Builder. Respostas chegam aqui em tempo real.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dynamicFormsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (dynamicFormsQuery.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum formulário personalizado criado. Use o botão "Formulário Personalizado" acima.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Respostas</TableHead>
                  <TableHead>Última resposta</TableHead>
                  <TableHead>Link Público</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dynamicFormsQuery.data || []).map((f) => {
                  const publicUrl = buildDynamicFormPublicUrl(f.id);
                  return (
                    <TableRow
                      key={f.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedForm({ id: f.id, name: f.name })}
                    >
                      <TableCell className="font-medium text-primary underline-offset-2 hover:underline">
                        {f.name}
                      </TableCell>
                      <TableCell>
                        {f.status === "active" ? (
                          <Badge className="bg-green-600 hover:bg-green-700">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">{f.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold">{f.response_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {f.last_response_at
                          ? format(new Date(f.last_response_at), "dd/MM HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1"
                          onClick={() => {
                            navigator.clipboard.writeText(publicUrl);
                            toast("Link copiado!");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                          Copiar
                        </Button>
                      </TableCell>
                      <TableCell className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedForm({ id: f.id, name: f.name })}
                          title="Ver lançamentos"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(publicUrl, "_blank")}
                          title="Abrir formulário"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
          {
          {const confirm = useConfirm();tokens.length === 0 ? (
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
                      <span className="text-xs text-muted-foreground">—</span>
                    </TableCell>
                    <TableCell>{statusBadge(t.status, t.expires_at)}</TableCell>
                    <TableCell className="text-center">
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(t.expires_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                      {t.status === "active" && new Date(t.expires_at) > new Date() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeToken.mutate(t.id)}
                          className="text-destructive hover:text-destructive"
                          title="Revogar"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if ((await confirm({ title: "Excluir este formulário e todos os cadastros vinculados?", destructive: true }))) {
                            deleteToken.mutate(t.id);
                          }
                        }}
                        className="text-destructive hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                    <TableHead>E-mail</TableHead>
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
                      <TableCell className="text-sm">{s.email_pessoal || "—"}</TableCell>
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

      <DynamicFormResponsesDialog
        formId={selectedForm?.id ?? null}
        formName={selectedForm?.name ?? ""}
        open={!!selectedForm}
        onOpenChange={(o) => !o && setSelectedForm(null)}
      />
    </div>
  );
}
