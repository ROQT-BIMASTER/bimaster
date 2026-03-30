import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Smartphone, Wifi, WifiOff, CheckCircle2, Zap, Shield, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePWA } from "@/hooks/usePWA";
import { useState } from "react";

export default function InstalarApp() {
  const { 
    isInstalled, 
    isOnline, 
    canInstall, 
    offlineReady,
    installProgress, 
    installStatus,
    needRefresh,
    appVersion,
    promptInstall,
    updateServiceWorker,
    forceUpdate,
    checkForUpdate,
  } = usePWA();

  const [checking, setChecking] = useState(false);

  const handleInstallClick = async () => {
    if (canInstall) {
      const accepted = await promptInstall();
      if (accepted) {
        toast.success("App instalado com sucesso! Abra-o pela tela inicial");
      } else {
        toast.info("Instalação cancelada. Você pode instalar mais tarde pelo menu do navegador.");
      }
    } else {
      if (/(iPhone|iPad|iPod)/.test(navigator.userAgent)) {
        toast.info("No Safari: toque em 'Compartilhar' e depois em 'Adicionar à Tela de Início'");
        return;
      }
      toast.info("No Chrome: toque no menu (⋮) e depois em 'Instalar app' ou 'Adicionar à tela inicial'");
    }
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      await checkForUpdate();
      // Wait a moment for SW to process
      await new Promise(r => setTimeout(r, 2000));
      if (!needRefresh) {
        toast.info("Você já está na versão mais recente.");
      }
    } finally {
      setChecking(false);
    }
  };

  const handleForceUpdate = async () => {
    toast.loading("Atualizando...", { id: "force-update" });
    if (needRefresh) {
      updateServiceWorker();
    } else {
      await forceUpdate();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            {isInstalled ? 'Gerenciar Aplicativo' : 'Instalar Aplicativo'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isInstalled 
              ? 'Gerencie a versão e atualizações do seu aplicativo'
              : 'Instale o Sistema de Gestão Huugs no seu dispositivo para acesso rápido e modo offline'
            }
          </p>
        </div>

        {/* Versão e Atualização — sempre visível */}
        <Card className="border-2 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Versão do Aplicativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-2xl font-bold tabular-nums text-foreground">v{appVersion}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {needRefresh 
                    ? '⚠️ Nova versão disponível!' 
                    : 'Versão atual instalada'
                  }
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {needRefresh ? (
                  <Button onClick={handleForceUpdate} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Atualizar Versão
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={handleCheckUpdate} 
                      disabled={checking}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                      {checking ? 'Verificando...' : 'Verificar Atualização'}
                    </Button>
                    <Button 
                      variant="default"
                      onClick={handleForceUpdate}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Forçar Atualização
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className={`border-2 ${isOnline ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20'}`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${isOnline ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                  {isOnline ? <Wifi className="h-6 w-6 text-green-600" /> : <WifiOff className="h-6 w-6 text-orange-600" />}
                </div>
                <div>
                  <p className={`font-semibold ${isOnline ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isOnline ? "Todos os dados serão sincronizados" : "Dados carregados anteriormente disponíveis"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-2 ${isInstalled ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-primary/50'}`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${isInstalled ? 'bg-green-500/20' : 'bg-primary/20'}`}>
                  {isInstalled ? <CheckCircle2 className="h-6 w-6 text-green-600" /> : <Smartphone className="h-6 w-6 text-primary" />}
                </div>
                <div>
                  <p className={`font-semibold ${isInstalled ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
                    {isInstalled ? 'Instalado' : 'Não instalado'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isInstalled ? "App disponível na tela inicial" : "Instale para acesso rápido"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progresso de Cache/Instalação */}
        {!offlineReady && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin" />
                Preparando App Offline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Progress value={installProgress} className="h-3" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{installStatus}</span>
                  <span className="font-medium tabular-nums">{Math.round(installProgress)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botão de Instalação Principal */}
        {!isInstalled && (
          <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="inline-flex p-4 rounded-full bg-primary/20 mb-2">
                  <Download className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Instale o Sistema Huggs</h3>
                  <p className="text-muted-foreground mb-4">
                    Tenha acesso rápido direto da tela inicial do seu dispositivo
                  </p>
                </div>
                <Button size="lg" onClick={handleInstallClick} className="gap-2 px-8">
                  <Download className="h-5 w-5" />
                  {canInstall ? 'Instalar Agora' : 'Como Instalar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Benefícios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Por que instalar?
            </CardTitle>
            <CardDescription>Aproveite todos os recursos do aplicativo instalado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { icon: Download, title: "Acesso Rápido", desc: "Abra direto da tela inicial, sem precisar do navegador" },
                { icon: WifiOff, title: "Modo Offline", desc: "Continue trabalhando mesmo sem internet" },
                { icon: Smartphone, title: "Experiência Nativa", desc: "Interface otimizada como um app real" },
                { icon: Shield, title: "Atualizações", desc: "Sempre na versão mais recente com botão de atualização" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors">
                  <div className="p-2 rounded-lg bg-primary/10 h-fit">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Instruções de Instalação Manual */}
        {!isInstalled && !canInstall && (
          <Card>
            <CardHeader>
              <CardTitle>Instruções de Instalação</CardTitle>
              <CardDescription>Siga os passos abaixo de acordo com seu dispositivo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-xl border bg-card">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-green-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">A</span>
                  </div>
                  Android (Chrome)
                </h3>
                <ol className="space-y-2 text-sm text-muted-foreground ml-8">
                  <li className="flex gap-2"><span className="text-primary font-medium">1.</span>Abra o menu do Chrome (⋮ no canto superior direito)</li>
                  <li className="flex gap-2"><span className="text-primary font-medium">2.</span>Toque em "Adicionar à tela inicial" ou "Instalar app"</li>
                  <li className="flex gap-2"><span className="text-primary font-medium">3.</span>Confirme a instalação</li>
                  <li className="flex gap-2"><span className="text-primary font-medium">4.</span>O ícone aparecerá na sua tela inicial</li>
                </ol>
              </div>

              <div className="p-4 rounded-xl border bg-card">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">iOS</span>
                  </div>
                  iPhone/iPad (Safari)
                </h3>
                <ol className="space-y-2 text-sm text-muted-foreground ml-8">
                  <li className="flex gap-2"><span className="text-primary font-medium">1.</span>Toque no ícone de compartilhar (□↑)</li>
                  <li className="flex gap-2"><span className="text-primary font-medium">2.</span>Role para baixo e toque em "Adicionar à Tela de Início"</li>
                  <li className="flex gap-2"><span className="text-primary font-medium">3.</span>Edite o nome se desejar e toque em "Adicionar"</li>
                  <li className="flex gap-2"><span className="text-primary font-medium">4.</span>O app aparecerá na sua tela inicial</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dicas */}
        <Card>
          <CardHeader>
            <CardTitle>Dicas para Trabalhar Offline</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                "Acesse as páginas que você precisa enquanto estiver online para garantir que fiquem disponíveis offline",
                "Alterações feitas offline serão sincronizadas automaticamente quando a conexão for restabelecida",
                "Imagens e documentos já visualizados ficam disponíveis no cache para acesso offline",
                "Use o botão 'Forçar Atualização' caso o app não esteja na versão mais recente",
              ].map((tip, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
