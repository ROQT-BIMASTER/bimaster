import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, MessageSquare, Calendar } from "lucide-react";

interface NotificationSettings {
  emailProspects: boolean;
  emailAtividades: boolean;
  emailRelatorios: boolean;
  pushProspects: boolean;
  pushAtividades: boolean;
  pushLembretes: boolean;
  smsLembretes: boolean;
  smsUrgentes: boolean;
}

export const ConfiguracoesNotificacoes = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>({
    emailProspects: true,
    emailAtividades: true,
    emailRelatorios: false,
    pushProspects: true,
    pushAtividades: true,
    pushLembretes: true,
    smsLembretes: false,
    smsUrgentes: true,
  });

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    toast({
      title: "Configurações salvas",
      description: "Suas preferências de notificação foram atualizadas (interface only)",
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            <div>
              <CardTitle>Notificações por Email</CardTitle>
              <CardDescription>Receba atualizações importantes por email</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Novos Prospects</Label>
              <p className="text-sm text-muted-foreground">
                Receba email quando novos prospects forem atribuídos
              </p>
            </div>
            <Switch
              checked={settings.emailProspects}
              onCheckedChange={() => handleToggle("emailProspects")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Atividades Agendadas</Label>
              <p className="text-sm text-muted-foreground">
                Lembrete de atividades para hoje e amanhã
              </p>
            </div>
            <Switch
              checked={settings.emailAtividades}
              onCheckedChange={() => handleToggle("emailAtividades")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Relatórios Semanais</Label>
              <p className="text-sm text-muted-foreground">
                Resumo semanal de suas atividades e resultados
              </p>
            </div>
            <Switch
              checked={settings.emailRelatorios}
              onCheckedChange={() => handleToggle("emailRelatorios")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <div>
              <CardTitle>Notificações Push</CardTitle>
              <CardDescription>Alertas instantâneos no navegador</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Novos Prospects</Label>
              <p className="text-sm text-muted-foreground">
                Notificação instantânea de novos prospects
              </p>
            </div>
            <Switch
              checked={settings.pushProspects}
              onCheckedChange={() => handleToggle("pushProspects")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Atualizações de Atividades</Label>
              <p className="text-sm text-muted-foreground">
                Mudanças em atividades e tarefas
              </p>
            </div>
            <Switch
              checked={settings.pushAtividades}
              onCheckedChange={() => handleToggle("pushAtividades")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Lembretes</Label>
              <p className="text-sm text-muted-foreground">
                Lembretes de tarefas e compromissos
              </p>
            </div>
            <Switch
              checked={settings.pushLembretes}
              onCheckedChange={() => handleToggle("pushLembretes")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <div>
              <CardTitle>Notificações por SMS</CardTitle>
              <CardDescription>Receba alertas importantes por mensagem de texto</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Lembretes Urgentes</Label>
              <p className="text-sm text-muted-foreground">
                SMS para compromissos importantes
              </p>
            </div>
            <Switch
              checked={settings.smsLembretes}
              onCheckedChange={() => handleToggle("smsLembretes")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Alertas Críticos</Label>
              <p className="text-sm text-muted-foreground">
                Notificações de alta prioridade
              </p>
            </div>
            <Switch
              checked={settings.smsUrgentes}
              onCheckedChange={() => handleToggle("smsUrgentes")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg">
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
};
