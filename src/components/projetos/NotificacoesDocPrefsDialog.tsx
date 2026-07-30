/**
 * Diálogo de configuração das notificações de mudança de situação dos
 * documentos da China, por tipo de mudança e por papel (responsável/supervisor).
 */
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NOTIF_PAPEL_LABEL,
  NOTIF_STATUS_LABEL,
  NOTIF_STATUS_ORDEM,
  prefKey,
  useChinaDocNotifPrefs,
  useSalvarChinaDocNotifPrefs,
  type NotifPapel,
  type NotifPrefMap,
} from "@/hooks/useChinaDocNotifPrefs";

const PAPEIS: NotifPapel[] = ["responsavel", "supervisor"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NotificacoesDocPrefsDialog({ open, onOpenChange }: Props) {
  const { data, isLoading } = useChinaDocNotifPrefs();
  const salvar = useSalvarChinaDocNotifPrefs();
  const [local, setLocal] = useState<NotifPrefMap>({});

  useEffect(() => {
    if (open) setLocal(data || {});
  }, [open, data]);

  const valor = (k: string) => local[k] !== false;
  const set = (k: string, v: boolean) => setLocal((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Notificações de situação de documentos</DialogTitle>
          <DialogDescription>
            Escolha quais mudanças de situação geram aviso para você, conforme o seu papel no
            documento. As alterações valem apenas para a sua conta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Mudança de situação</span>
            {PAPEIS.map((p) => (
              <span key={p} className="w-24 text-center">
                {NOTIF_PAPEL_LABEL[p].replace("Como ", "")}
              </span>
            ))}
          </div>

          {NOTIF_STATUS_ORDEM.map((status) => (
            <div
              key={status}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-border/60 px-3 py-2"
            >
              <span className="text-sm text-foreground">{NOTIF_STATUS_LABEL[status]}</span>
              {PAPEIS.map((papel) => {
                const k = prefKey(status, papel);
                return (
                  <div key={papel} className="flex w-24 justify-center">
                    <Switch
                      checked={valor(k)}
                      disabled={isLoading}
                      onCheckedChange={(v) => set(k, v)}
                      aria-label={`${NOTIF_STATUS_LABEL[status]} — ${NOTIF_PAPEL_LABEL[papel]}`}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => salvar.mutate(local, { onSuccess: () => onOpenChange(false) })}
            disabled={salvar.isPending || isLoading}
          >
            {salvar.isPending ? "Salvando..." : "Salvar preferências"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NotificacoesDocPrefsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
        aria-label="Configurar notificações de situação de documentos"
      >
        <Bell className="h-3.5 w-3.5" />
        <span className="ml-1 text-[11px]">Notificações</span>
      </Button>
      <NotificacoesDocPrefsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
