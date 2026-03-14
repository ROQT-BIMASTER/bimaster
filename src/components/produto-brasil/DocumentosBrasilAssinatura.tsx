import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileCheck2,
  Pen,
  Shield,
  CheckCircle2,
  ArrowDownLeft,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { CATEGORIES_BRASIL_ENVIA, CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  submissaoId: string;
  produtoNome: string;
}

export function DocumentosBrasilAssinatura({ submissaoId, produtoNome }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [senha, setSenha] = useState("");

  // Fetch profile for display name
  const { data: profile } = useQuery({
    queryKey: ["profile-sign", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome_completo")
        .eq("id", user!.id)
        .single();
      return data;
    },
  });

  // Fetch all brasil-side docs for this submission
  const brasilTipos = CATEGORIES_BRASIL_ENVIA.flatMap((c) => c.tipos);
  const { data: documentos = [] } = useQuery({
    queryKey: ["brasil-docs-assinatura", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_produto_documentos" as any)
        .select("*")
        .eq("submissao_id", submissaoId)
        .in("tipo_documento", brasilTipos) as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Oficializar mutation
  const oficializar = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await (supabase
        .from("china_produto_documentos" as any)
        .update({
          oficializado: true,
          oficializado_por: user?.id,
          oficializado_em: new Date().toISOString(),
        })
        .eq("id", docId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brasil-docs-assinatura", submissaoId] });
      toast.success("Documento marcado como Oficial.");
    },
  });

  // Assinar mutation
  const assinar = useMutation({
    mutationFn: async ({ docId, nome }: { docId: string; nome: string }) => {
      const { error } = await (supabase
        .from("china_produto_documentos" as any)
        .update({
          assinado_por: user?.id,
          assinado_em: new Date().toISOString(),
          assinatura_nome: nome,
          status: "pendente", // mark as ready to send to China
        })
        .eq("id", docId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brasil-docs-assinatura", submissaoId] });
      queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", submissaoId] });
      toast.success("Documento assinado e enviado à China!");
      setSignDialogOpen(false);
      setSelectedDocId(null);
      setNomeCompleto("");
      setSenha("");
    },
  });

  const handleOpenSign = (docId: string) => {
    setSelectedDocId(docId);
    setNomeCompleto(profile?.nome_completo || "");
    setSenha("");
    setSignDialogOpen(true);
  };

  const handleSign = () => {
    if (!nomeCompleto.trim()) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (senha !== "bimaster2026") {
      toast.error("Senha institucional inválida.");
      return;
    }
    if (!selectedDocId) return;
    assinar.mutate({ docId: selectedDocId, nome: nomeCompleto.trim() });
  };

  if (documentos.length === 0) return null;

  // Group by category
  const categorized = CATEGORIES_BRASIL_ENVIA.map((cat) => {
    const docs = documentos.filter((d: any) => cat.tipos.includes(d.tipo_documento));
    return { ...cat, docs };
  }).filter((c) => c.docs.length > 0);

  const totalDocs = documentos.length;
  const totalOficializados = documentos.filter((d: any) => d.oficializado).length;
  const totalAssinados = documentos.filter((d: any) => d.assinado_por).length;
  const allSigned = totalDocs > 0 && totalAssinados === totalDocs;

  return (
    <>
      <Card className="border-success/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownLeft className="h-4 w-4 text-success" />
              Documentos Brasil → China
            </CardTitle>
            {allSigned ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Todos assinados
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {totalAssinados}/{totalDocs} assinados
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Documentos devem ser oficializados e assinados eletronicamente antes do envio à China.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categorized.map((cat) => (
              <div key={cat.key}>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {cat.labelPt}
                </p>
                <div className="space-y-2">
                  {cat.docs.map((doc: any) => {
                    const tipoConfig = CHINA_DOCUMENT_TYPES.find(
                      (t) => t.tipo === doc.tipo_documento
                    );
                    const isOficial = doc.oficializado;
                    const isSigned = !!doc.assinado_por;

                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
                      >
                        {/* Document info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tipoConfig?.labelPt || doc.tipo_documento}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {doc.nome_arquivo || "Sem arquivo"}
                          </p>
                        </div>

                        {/* Status badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isOficial ? (
                            <Badge variant="default" className="text-[10px] gap-0.5 px-1.5">
                              <Shield className="h-2.5 w-2.5" /> Oficial
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5">
                              Rascunho
                            </Badge>
                          )}
                          {isSigned ? (
                            <Badge variant="success" className="text-[10px] gap-0.5 px-1.5">
                              <Pen className="h-2.5 w-2.5" /> Assinado
                            </Badge>
                          ) : null}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!isOficial && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => oficializar.mutate(doc.id)}
                              disabled={oficializar.isPending}
                            >
                              <Shield className="h-3 w-3" /> Oficializar
                            </Button>
                          )}
                          {isOficial && !isSigned && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleOpenSign(doc.id)}
                            >
                              <Pen className="h-3 w-3" /> Assinar
                            </Button>
                          )}
                          {isSigned && (
                            <div className="text-[10px] text-muted-foreground text-right">
                              <p>{doc.assinatura_nome}</p>
                              <p>{doc.assinado_em ? format(new Date(doc.assinado_em), "dd/MM/yyyy HH:mm") : ""}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Signing Dialog */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" />
              Assinatura Eletrônica
            </DialogTitle>
            <DialogDescription>
              Ao assinar, você confirma que revisou o documento e autoriza o envio oficial à equipe China.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome Completo do Assinante</Label>
              <Input
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                placeholder="Seu nome completo"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Senha Institucional</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Ao assinar você declara que:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Revisou o conteúdo do documento</li>
                <li>O documento está em conformidade com os padrões da empresa</li>
                <li>Autoriza o envio oficial à equipe China</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSignDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSign}
              disabled={assinar.isPending}
              className="gap-1"
            >
              <Pen className="h-4 w-4" /> Assinar e Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
