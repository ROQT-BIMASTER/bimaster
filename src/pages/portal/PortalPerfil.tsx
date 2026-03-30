import { useState, useEffect } from "react";
import { ClientePortalLayout } from "@/components/portal/ClientePortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Calendar, Pencil, X, Save, Lock, Phone, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { profileSchema } from "@/lib/validations/profile";
import { ProfileAvatarUpload } from "@/components/shared/ProfileAvatarUpload";

interface UserProfile {
  nome: string;
  email: string;
  telefone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export default function PortalPerfil() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [cnpjs, setCnpjs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ nome: "", telefone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("nome, email, avatar_url, created_at")
          .eq("id", user.id)
          .single();

        // Fetch telefone separately since column may not be in generated types yet
        const { data: telData } = await supabase
          .from("profiles")
          .select("telefone" as any)
          .eq("id", user.id)
          .single();

        if (profileData) {
          const tel = (telData as any)?.telefone || null;
          setProfile({ ...profileData, telefone: tel });
          setFormData({
            nome: profileData.nome || "",
            telefone: tel || "",
          });
        }

        const { data: cnpjData } = await supabase
          .from("user_cnpj")
          .select("cnpj")
          .eq("user_id", user.id);

        if (cnpjData) {
          setCnpjs(cnpjData.map((c) => c.cnpj));
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEdit = () => {
    setIsEditing(true);
    setErrors({});
    setFormData({
      nome: profile?.nome || "",
      telefone: profile?.telefone || "",
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setErrors({});
  };

  const handleSave = async () => {
    const result = profileSchema.safeParse({
      nome: formData.nome,
      email: profile?.email || "",
      telefone: formData.telefone || "",
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (field === "nome" || field === "telefone") {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          nome: formData.nome.trim(),
          telefone: formData.telefone.trim() || null,
        })
        .eq("id", userId!);

      if (error) throw error;

      setProfile((prev) =>
        prev
          ? { ...prev, nome: formData.nome.trim(), telefone: formData.telefone.trim() || null }
          : prev
      );
      setIsEditing(false);
      setErrors({});
      toast.success("Dados atualizados com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar dados: " + (error.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
  };

  if (loading) {
    return (
      <ClientePortalLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ClientePortalLayout>
    );
  }

  return (
    <ClientePortalLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground">Informações da sua conta</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Dados Pessoais</CardTitle>
              <CardDescription>Informações do seu cadastro</CardDescription>
            </div>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Pencil className="h-4 w-4 mr-1" />
                Editar Meus Dados
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {profile && (
              <>
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <ProfileAvatarUpload
                    userId={userId!}
                    currentAvatarUrl={profile.avatar_url}
                    userName={profile.nome}
                    size="lg"
                    editable={true}
                    onUploadComplete={(url) =>
                      setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev))
                    }
                  />
                  <div>
                    <p className="font-medium text-lg">{profile.nome}</p>
                    <p className="text-sm text-muted-foreground">{profile.email}</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  {/* Nome */}
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <Label className="text-sm text-muted-foreground">Nome</Label>
                      {isEditing ? (
                        <div>
                          <Input
                            value={formData.nome}
                            onChange={(e) => setFormData((f) => ({ ...f, nome: e.target.value }))}
                            className={errors.nome ? "border-destructive" : ""}
                          />
                          {errors.nome && (
                            <p className="text-sm text-destructive mt-1">{errors.nome}</p>
                          )}
                        </div>
                      ) : (
                        <p className="font-medium">{profile.nome}</p>
                      )}
                    </div>
                  </div>

                  {/* Email (read-only) */}
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-sm text-muted-foreground">E-mail</Label>
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="font-medium">{profile.email}</p>
                      {isEditing && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          O e-mail é seu identificador e não pode ser alterado por aqui.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Telefone */}
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <Label className="text-sm text-muted-foreground">Telefone</Label>
                      {isEditing ? (
                        <div>
                          <Input
                            value={formData.telefone}
                            onChange={(e) => setFormData((f) => ({ ...f, telefone: e.target.value }))}
                            placeholder="(00) 00000-0000"
                            className={errors.telefone ? "border-destructive" : ""}
                          />
                          {errors.telefone && (
                            <p className="text-sm text-destructive mt-1">{errors.telefone}</p>
                          )}
                        </div>
                      ) : (
                        <p className="font-medium">
                          {profile.telefone || <span className="text-muted-foreground italic">Não informado</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Membro desde */}
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <Label className="text-sm text-muted-foreground">Membro desde</Label>
                      <p className="font-medium">
                        {format(new Date(profile.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* LGPD notice */}
                <div className="border-t pt-4 flex items-start gap-2 text-xs text-muted-foreground">
                  <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    Conforme Art. 18 da LGPD (Lei 13.709/2018), você tem o direito de corrigir
                    dados pessoais incompletos, inexatos ou desatualizados a qualquer momento.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CNPJs Vinculados</CardTitle>
            <CardDescription>
              CNPJs que você pode consultar tabelas de preço
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cnpjs.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum CNPJ vinculado à sua conta
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {cnpjs.map((cnpj) => (
                  <Badge key={cnpj} variant="secondary" className="text-sm">
                    {formatCNPJ(cnpj)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientePortalLayout>
  );
}
