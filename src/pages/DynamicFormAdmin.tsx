import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FormShareDialog } from "@/components/forms/FormShareDialog";
import {
  Plus, Edit2, Trash2, Share2, BarChart3, Copy, Loader2, FileText,
  ClipboardList, Eye,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FormItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: string;
  created_at: string;
  created_by: string;
  total_respostas: number;
  is_shared?: boolean;
  shared_permission?: string;
}

export default function DynamicFormAdmin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [myForms, setMyForms] = useState<FormItem[]>([]);
  const [sharedForms, setSharedForms] = useState<FormItem[]>([]);
  const [shareFormId, setShareFormId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadForms();
  }, []);

  async function loadForms() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // My forms
      const { data: mine } = await supabase
        .from("dynamic_forms")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      // Shared with me
      const { data: shares } = await supabase
        .from("dynamic_form_shares" as any)
        .select("form_id, permission")
        .eq("shared_with", user.id);

      const sharedIds = (shares || []).map((s: any) => s.form_id);
      let sharedData: any[] = [];
      if (sharedIds.length > 0) {
        const { data } = await supabase
          .from("dynamic_forms")
          .select("*")
          .in("id", sharedIds);
        sharedData = data || [];
      }

      // Count responses for all form ids
      const allIds = [...(mine || []).map((f: any) => f.id), ...sharedIds];
      let responseCounts: Record<string, number> = {};
      if (allIds.length > 0) {
        const { data: responses } = await supabase
          .from("dynamic_form_responses")
          .select("form_id")
          .in("form_id", allIds);
        (responses || []).forEach((r: any) => {
          responseCounts[r.form_id] = (responseCounts[r.form_id] || 0) + 1;
        });
      }

      setMyForms(
        (mine || []).map((f: any) => ({
          ...f,
          total_respostas: responseCounts[f.id] || 0,
        }))
      );

      setSharedForms(
        sharedData.map((f: any) => {
          const share = (shares || []).find((s: any) => s.form_id === f.id);
          return {
            ...f,
            total_respostas: responseCounts[f.id] || 0,
            is_shared: true,
            shared_permission: (share as any)?.permission || "view",
          };
        })
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar formulários");
    } finally {
      setLoading(false);
    }
  }

  async function handleDuplicate(form: FormItem) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: newForm, error } = await supabase
        .from("dynamic_forms")
        .insert({
          name: `${form.name} (Cópia)`,
          description: form.description,
          category: form.category,
          status: "draft",
          created_by: user.id,
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      // Copy fields
      const { data: fields } = await supabase
        .from("dynamic_form_fields")
        .select("*")
        .eq("form_id", form.id);

      if (fields && fields.length > 0) {
        await supabase.from("dynamic_form_fields").insert(
          fields.map((f: any) => ({
            form_id: newForm.id,
            label: f.label,
            field_type: f.field_type,
            required: f.required,
            options: f.options,
            placeholder: f.placeholder,
            validation: f.validation,
            order_index: f.order_index,
          })) as any
        );
      }

      toast.success("Formulário duplicado!");
      loadForms();
    } catch (err) {
      toast.error("Erro ao duplicar");
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("dynamic_forms").delete().eq("id", id);
      if (error) throw error;
      toast.success("Formulário excluído");
      loadForms();
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  const statusBadge = (status: string) => {
    if (status === "active") return <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>;
    if (status === "archived") return <Badge variant="secondary">Arquivado</Badge>;
    return <Badge variant="outline">Rascunho</Badge>;
  };

  const categoryLabel: Record<string, string> = {
    equipe: "Equipe", pdv: "PDV", auditoria: "Auditoria", campanha: "Campanha", outro: "Outro",
  };

  function FormCard({ form, showActions = true }: { form: FormItem; showActions?: boolean }) {
    return (
      <Card key={form.id} className="group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <h3 className="font-semibold text-sm truncate">{form.name}</h3>
                {statusBadge(form.status)}
                {form.category && (
                  <Badge variant="outline" className="text-xs">
                    {categoryLabel[form.category] || form.category}
                  </Badge>
                )}
              </div>
              {form.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 ml-6">{form.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 ml-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  {form.total_respostas} respostas
                </span>
                <span>
                  {new Date(form.created_at).toLocaleDateString("pt-BR")}
                </span>
                {form.is_shared && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {form.shared_permission === "edit" ? "Pode editar" : "Visualização"}
                  </Badge>
                )}
              </div>
            </div>

            {showActions && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => navigate(`/dashboard/trade/formularios/builder?id=${form.id}`)}
                  title="Editar"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => handleDuplicate(form)}
                  title="Duplicar"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => navigate(`/dashboard/trade/formularios/dashboard?id=${form.id}`)}
                  title="Dashboard"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setShareFormId(form.id)}
                  title="Compartilhar"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso removerá o formulário e todas as respostas. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(form.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {!showActions && form.shared_permission === "edit" && (
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => navigate(`/dashboard/trade/formularios/builder?id=${form.id}`)}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {!showActions && form.shared_permission === "view" && (
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => navigate(`/dashboard/trade/formularios/builder?id=${form.id}`)}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div>
          <ModuleBreadcrumb
            moduleName="Trade Marketing"
            moduleHref="/dashboard/trade"
            currentPage="Meus Formulários"
          />
          <div className="flex items-center justify-between mt-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Meus Formulários
            </h1>
            <Button onClick={() => navigate("/dashboard/trade/formularios/builder")}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Formulário
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="meus">
            <TabsList>
              <TabsTrigger value="meus">
                Meus Formulários ({myForms.length})
              </TabsTrigger>
              <TabsTrigger value="compartilhados">
                Compartilhados comigo ({sharedForms.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="meus" className="mt-4">
              {myForms.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center space-y-3">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">Nenhum formulário criado ainda</p>
                    <Button onClick={() => navigate("/dashboard/trade/formularios/builder")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar primeiro formulário
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {myForms.map((form) => (
                    <FormCard key={form.id} form={form} showActions />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="compartilhados" className="mt-4">
              {sharedForms.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Share2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum formulário compartilhado com você</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {sharedForms.map((form) => (
                    <FormCard key={form.id} form={form} showActions={false} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {shareFormId && (
          <FormShareDialog
            formId={shareFormId}
            onClose={() => setShareFormId(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
