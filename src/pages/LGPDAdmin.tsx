import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Shield, Search, Download, UserX, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserResult {
  id: string;
  nome: string;
  email: string;
}

const LGPDAdmin = () => {
  const { isAdmin } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [anonymizing, setAnonymizing] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .or(`nome.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(20);

      if (error) throw error;
      setResults(data || []);
      if (!data?.length) {
        toast({ title: "Nenhum usuário encontrado" });
      }
    } catch {
      toast({ title: "Erro na busca", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleExport = async (userId: string, userName: string) => {
    setExporting(userId);
    try {
      const [profiles, teamDetails, termsAcceptance, auditLogs] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId),
        supabase.from("team_member_details").select("*").eq("user_id", userId),
        supabase.from("terms_acceptance").select("*").eq("user_id", userId),
        supabase.from("audit_logs").select("*").eq("user_id", userId).limit(500),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: userId,
        user_name: userName,
        lgpd_export: true,
        data: {
          profile: profiles.data,
          team_member_details: teamDetails.data,
          terms_acceptance: termsAcceptance.data,
          audit_logs: auditLogs.data,
        },
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lgpd-export-${userId.slice(0, 8)}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Log da exportação
      await supabase.from("audit_logs").insert({
        action: "lgpd_data_export",
        entity_type: "user",
        entity_id: userId,
        metadata: { exported_tables: ["profiles", "team_member_details", "terms_acceptance", "audit_logs"] } as any,
      } as any);

      toast({ title: "Dados exportados com sucesso" });
    } catch {
      toast({ title: "Erro ao exportar dados", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const handleAnonymize = async (userId: string, userName: string) => {
    setAnonymizing(userId);
    const anonId = userId.slice(0, 8);
    try {
      // Anonimizar profile
      await supabase
        .from("profiles")
        .update({
          nome: `Usuário Anonimizado ${anonId}`,
          email: `anonimizado-${anonId}@removed.lgpd`,
          telefone: null,
          avatar_url: null,
        })
        .eq("id", userId);

      // Anonimizar team_member_details
      await supabase
        .from("team_member_details")
        .update({
          cpf: null,
          rg: null,
          telefone_pessoal: null,
          endereco: null,
          contato_emergencia_nome: null,
          contato_emergencia_telefone: null,
        })
        .eq("user_id", userId);

      // Log
      await supabase.from("audit_logs").insert({
        action: "lgpd_data_anonymization",
        entity_type: "user",
        entity_id: userId,
        metadata: { original_name: userName, anonymized_tables: ["profiles", "team_member_details"] } as any,
      } as any);

      toast({ title: "Dados anonimizados com sucesso", description: `Dados pessoais de ${userName} foram substituídos.` });
      
      // Atualizar resultados
      setResults(prev => prev.map(u => 
        u.id === userId ? { ...u, nome: `Usuário Anonimizado ${anonId}`, email: `anonimizado-${anonId}@removed.lgpd` } : u
      ));
    } catch {
      toast({ title: "Erro ao anonimizar dados", variant: "destructive" });
    } finally {
      setAnonymizing(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">LGPD — Gestão de Dados Pessoais</h1>
            <p className="text-sm text-muted-foreground">
              Exportar e anonimizar dados pessoais conforme Art. 18 da Lei Geral de Proteção de Dados.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buscar Usuário</CardTitle>
            <CardDescription>Pesquise por nome ou email do titular dos dados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching}>
                <Search className="h-4 w-4 mr-2" />
                {searching ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resultados ({results.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {results.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{user.nome}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(user.id, user.nome)}
                      disabled={exporting === user.id}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      {exporting === user.id ? "Exportando..." : "Exportar"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={anonymizing === user.id}>
                          <UserX className="h-4 w-4 mr-1" />
                          {anonymizing === user.id ? "Anonimizando..." : "Anonimizar"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Confirmar Anonimização
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação é <strong>irreversível</strong>. Os dados pessoais de{" "}
                            <strong>{user.nome}</strong> serão substituídos por valores anonimizados.
                            Recomenda-se exportar os dados antes de prosseguir.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleAnonymize(user.id, user.nome)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Confirmar Anonimização
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default LGPDAdmin;
