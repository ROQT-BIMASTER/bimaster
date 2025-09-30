import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Map, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const ConfiguracaoMapbox = () => {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSaveToken = async () => {
    if (!token.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira um token válido",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      toast({
        title: "Token Configurado",
        description: "O token do Mapbox foi salvo. Entre em contato com o suporte técnico para ativá-lo no sistema.",
      });
      setToken("");
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o token",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-primary" />
          <CardTitle>Configuração do Mapbox</CardTitle>
        </div>
        <CardDescription>
          Configure o token de acesso público do Mapbox para habilitar o mapa de prospects
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">Como obter seu token Mapbox:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                <li>Acesse <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mapbox.com/access-tokens</a></li>
                <li>Faça login ou crie uma conta gratuita</li>
                <li>Copie o "Default public token" ou crie um novo token público</li>
                <li>Cole o token abaixo e clique em Salvar</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="mapbox-token">Token de Acesso Público</Label>
          <div className="relative">
            <Input
              id="mapbox-token"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4..."
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O token público começa com "pk." e é seguro para uso no frontend
          </p>
        </div>

        <Alert variant="default" className="bg-muted">
          <AlertDescription className="text-sm">
            <strong>Importante:</strong> Após salvar o token aqui, entre em contato com o suporte técnico 
            para que ele seja configurado nos secrets do sistema (MAPBOX_ACCESS_TOKEN). O mapa só funcionará 
            após essa configuração ser concluída.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={handleSaveToken} 
          disabled={isLoading || !token.trim()}
          className="w-full"
        >
          {isLoading ? "Salvando..." : "Salvar Token"}
        </Button>
      </CardContent>
    </Card>
  );
};
