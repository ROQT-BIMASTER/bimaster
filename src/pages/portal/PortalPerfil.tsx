import { useState, useEffect } from "react";
import { ClientePortalLayout } from "@/components/portal/ClientePortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserProfile {
  nome: string;
  email: string;
  created_at: string;
}

interface UserCNPJ {
  cnpj: string;
}

export default function PortalPerfil() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cnpjs, setCnpjs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Buscar profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("nome, email, created_at")
          .eq("id", user.id)
          .single();

        if (profileData) {
          setProfile(profileData);
        }

        // Buscar CNPJs vinculados
        const { data: cnpjData } = await supabase
          .from("user_cnpj")
          .select("cnpj")
          .eq("user_id", user.id);

        if (cnpjData) {
          setCnpjs(cnpjData.map((c: UserCNPJ) => c.cnpj));
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
          <CardHeader>
            <CardTitle>Dados Pessoais</CardTitle>
            <CardDescription>Informações do seu cadastro</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile && (
              <>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{profile.nome}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <p className="font-medium">{profile.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Membro desde</p>
                    <p className="font-medium">
                      {format(new Date(profile.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
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
