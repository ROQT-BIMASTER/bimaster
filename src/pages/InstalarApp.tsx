import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Wifi, WifiOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function InstalarApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Detectar se já está instalado (modo standalone)
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setIsInstalled(isStandalone);
    };
    
    checkInstalled();

    // Capturar o evento de instalação
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      console.log('beforeinstallprompt event captured');
      setDeferredPrompt(e);
    };

    // Detectar quando o app foi instalado
    const handleAppInstalled = () => {
      console.log('App foi instalado');
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success("App instalado! Agora você pode acessá-lo pela tela inicial");
    };

    // Monitorar status online/offline
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexão restabelecida!");
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info("Modo offline ativado");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Instruções para iOS
      if (/(iPhone|iPad|iPod)/.test(navigator.userAgent)) {
        toast.info("No Safari: toque em 'Compartilhar' e depois em 'Adicionar à Tela de Início'");
        return;
      }
      // Instruções para Android
      toast.info("No Chrome: toque no menu (⋮) e depois em 'Instalar app' ou 'Adicionar à tela inicial'");
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success("App instalado com sucesso! Abra-o pela tela inicial");
        setIsInstalled(true);
      } else {
        toast.info("Instalação cancelada. Você pode instalar mais tarde pelo menu do navegador.");
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Erro ao instalar:', error);
      toast.error("Erro ao instalar. Tente pelo menu do navegador.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">Instalar Aplicativo</h1>
          <p className="text-muted-foreground mt-2">
            Instale o BiMaster no seu dispositivo para acesso rápido e modo offline
          </p>
        </div>

        {/* Status de Conexão */}
        <Alert className={isOnline ? "border-green-500 bg-green-50" : "border-orange-500 bg-orange-50"}>
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5 text-orange-600" />
            )}
            <AlertDescription className={isOnline ? "text-green-700" : "text-orange-700"}>
              {isOnline 
                ? "Você está online - todos os dados serão sincronizados"
                : "Modo offline ativo - você ainda pode acessar dados carregados anteriormente"
              }
            </AlertDescription>
          </div>
        </Alert>

        {/* Status de Instalação */}
        {isInstalled && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <AlertDescription className="text-green-700">
              ✓ Aplicativo já está instalado no seu dispositivo!
            </AlertDescription>
          </Alert>
        )}

        {/* Benefícios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Por que instalar?
            </CardTitle>
            <CardDescription>
              Aproveite todos os recursos do aplicativo instalado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex gap-3 p-4 rounded-lg border">
                <Download className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">Acesso Rápido</h3>
                  <p className="text-sm text-muted-foreground">
                    Abra direto da tela inicial, sem precisar do navegador
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-4 rounded-lg border">
                <WifiOff className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">Modo Offline</h3>
                  <p className="text-sm text-muted-foreground">
                    Continue trabalhando mesmo sem internet
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-4 rounded-lg border">
                <Smartphone className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">Experiência Nativa</h3>
                  <p className="text-sm text-muted-foreground">
                    Interface otimizada como um app real
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-4 rounded-lg border">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">Sincronização</h3>
                  <p className="text-sm text-muted-foreground">
                    Dados sincronizados automaticamente quando online
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instruções de Instalação */}
        <Card>
          <CardHeader>
            <CardTitle>Como Instalar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isInstalled && deferredPrompt && (
              <div className="text-center py-6 space-y-4">
                <p className="text-muted-foreground mb-4">
                  Clique no botão abaixo para instalar o app no seu celular
                </p>
                <Button size="lg" onClick={handleInstallClick} className="gap-2">
                  <Download className="h-5 w-5" />
                  Instalar Aplicativo Agora
                </Button>
              </div>
            )}
            
            {!isInstalled && !deferredPrompt && (
              <div className="space-y-6">
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    O botão de instalação automática não está disponível. Use as instruções abaixo para instalar manualmente.
                  </p>
                </div>
                
                {/* Android Chrome */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Android (Chrome)
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Abra o menu do Chrome (⋮ no canto superior direito)</li>
                    <li>Toque em "Adicionar à tela inicial" ou "Instalar app"</li>
                    <li>Confirme a instalação</li>
                    <li>O ícone aparecerá na sua tela inicial</li>
                  </ol>
                </div>

                {/* iOS Safari */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    iPhone/iPad (Safari)
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Toque no ícone de compartilhar (□↑)</li>
                    <li>Role para baixo e toque em "Adicionar à Tela de Início"</li>
                    <li>Edite o nome se desejar e toque em "Adicionar"</li>
                    <li>O app aparecerá na sua tela inicial</li>
                  </ol>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dicas para Uso Offline */}
        <Card>
          <CardHeader>
            <CardTitle>Dicas para Trabalhar Offline</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Acesse as páginas que você precisa enquanto estiver online para garantir que fiquem disponíveis offline
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Alterações feitas offline serão sincronizadas automaticamente quando a conexão for restabelecida
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Imagens e documentos já visualizados ficam disponíveis no cache para acesso offline
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
