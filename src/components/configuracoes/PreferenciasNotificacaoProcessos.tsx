import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Mail, FileWarning, BellRing, FileCheck2, Loader2 } from "lucide-react";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";

const TIPOS = [
  {
    key: "espelho_pendente_sem_doc",
    label: "Tarefa pendente sem documento",
    description:
      "Quando uma tarefa do Projetos for vinculada a uma etapa do processo e ainda não tiver documento oficial selecionado.",
    icon: FileWarning,
  },
  {
    key: "espelho_acao_solicitada",
    label: "Ação solicitada pelo gestor",
    description:
      "Quando o gestor reenviar um pedido de ação para concluir uma tarefa espelhada pendente.",
    icon: BellRing,
  },
  {
    key: "espelho_concluida_evidencia",
    label: "Tarefa concluída com evidência",
    description:
      "Quando uma tarefa espelhada for concluída no Projetos e a evidência for registrada no processo.",
    icon: FileCheck2,
  },
] as const;

/**
 * Painel de preferências de notificação para alertas de tarefas
 * espelhadas entre módulos Projetos e Processos.
 * Permite escolher quais tipos receber e por quais canais (email/push).
 */
export function PreferenciasNotificacaoProcessos() {
  const { prefs, isLoading, save, isSaving } = useNotificationPreferences();

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          <div>
            <CardTitle>Tarefas espelhadas entre Projetos e Processos</CardTitle>
            <CardDescription>
              Escolha quais alertas receber e por quais canais. As preferências valem para
              todas as etapas em que você for responsável.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Canais */}
        <div className="rounded-md border p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase">Canais</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label className="cursor-pointer">Notificações no aplicativo (push)</Label>
            </div>
            <Switch
              checked={prefs.push_enabled}
              onCheckedChange={(v) => save({ push_enabled: v })}
              disabled={isSaving}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label className="cursor-pointer">Notificações por email</Label>
            </div>
            <Switch
              checked={prefs.email_enabled}
              onCheckedChange={(v) => save({ email_enabled: v })}
              disabled={isSaving}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Frequência do email</Label>
            <Select
              value={prefs.digest_frequency}
              onValueChange={(v) => save({ digest_frequency: v as any })}
              disabled={isSaving || !prefs.email_enabled}
            >
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Imediato</SelectItem>
                <SelectItem value="daily">Resumo diário</SelectItem>
                <SelectItem value="weekly">Resumo semanal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tipos de alerta */}
        <div className="rounded-md border p-3 space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Tipos de alerta</p>
          {TIPOS.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.key} className="flex items-start justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {t.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                <Switch
                  checked={prefs.notification_types[t.key] ?? true}
                  onCheckedChange={(v) =>
                    save({ notification_types: { [t.key]: v } })
                  }
                  disabled={isSaving}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
