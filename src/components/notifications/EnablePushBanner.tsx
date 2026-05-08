import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const DISMISS_KEY = "mencoes:push:dismissed";

export const EnablePushBanner = () => {
  const { isSupported, permission, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(
    typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
  );

  if (!isSupported || permission !== "default" || dismissed) return null;

  return (
    <Alert className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Bell className="h-4 w-4 flex-shrink-0 text-primary" />
        <AlertDescription className="text-sm">
          Ative as notificações do navegador para ser avisado imediatamente quando alguém mencionar você em uma tarefa ou chat.
        </AlertDescription>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button size="sm" onClick={() => requestPermission()}>
          Ativar
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          aria-label="Dispensar"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Alert>
  );
};
