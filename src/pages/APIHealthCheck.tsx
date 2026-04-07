import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function APIHealthCheck() {
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(false);

  const { data: healthCheck, isLoading, refetch } = useQuery({
    queryKey: ["api-health-check"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("api-health-check");
      
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false,
  });

  const handleRevalidate = async () => {
    setIsValidating(true);
    try {
      await refetch();
      toast.success("APIs revalidadas com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao revalidar APIs: " + error.message);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
            <h1 className="text-3xl font-bold">Verificação de APIs</h1>
            <p className="text-muted-foreground">
              Status de todas as APIs do sistema
            </p>
            </div>
          </div>
          <Button 
            onClick={handleRevalidate}
            disabled={isValidating || isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isValidating ? 'animate-spin' : ''}`} />
            Revalidar APIs
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">APIs Funcionando</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {healthCheck?.ok?.length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">APIs Faltando</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {healthCheck?.missing?.length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">APIs Inativas</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {healthCheck?.inactive?.length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* APIs Funcionando */}
        {healthCheck?.ok && healthCheck.ok.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                APIs Funcionando ({healthCheck.ok.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {healthCheck.ok.map((api: string) => (
                  <div 
                    key={api}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800"
                  >
                    <code className="text-sm font-mono">{api}</code>
                    <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      OK
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* APIs Faltando */}
        {healthCheck?.missing && healthCheck.missing.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                APIs Faltando ({healthCheck.missing.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {healthCheck.missing.map((api: string) => (
                  <div 
                    key={api}
                    className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800"
                  >
                    <code className="text-sm font-mono">{api}</code>
                    <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                      FALTANDO
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* APIs Inativas */}
        {healthCheck?.inactive && healthCheck.inactive.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                APIs Inativas ({healthCheck.inactive.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {healthCheck.inactive.map((api: string) => (
                  <div 
                    key={api}
                    className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800"
                  >
                    <code className="text-sm font-mono">{api}</code>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                      INATIVO
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            Carregando status das APIs...
          </div>
        )}

        {healthCheck?.timestamp && (
          <p className="text-sm text-muted-foreground text-center">
            Última verificação: {new Date(healthCheck.timestamp).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
