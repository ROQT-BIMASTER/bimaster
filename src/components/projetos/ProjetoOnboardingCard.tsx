import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, X, Keyboard, Bell, BookOpen, Compass } from "lucide-react";

const STORAGE_KEY = "projetos:onboarding:dismissed:v1";

interface Props {
  /** Optional callback to start the in-page tour. */
  onStartTour?: () => void;
  /** Optional callback to open the shortcuts dialog. */
  onOpenShortcuts?: () => void;
}

/**
 * Dismissible welcome card shown above the Projects pages for users who
 * have not yet seen it. State is persisted in localStorage per browser.
 */
export function ProjetoOnboardingCard({ onStartTour, onOpenShortcuts }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Bem-vindo ao módulo de Projetos</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1"
                onClick={dismiss}
                aria-label="Dispensar"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Algumas dicas para começar com produtividade. Você pode dispensar este painel — ele não voltará a aparecer.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
              {onStartTour && (
                <Button variant="outline" size="sm" className="justify-start" onClick={onStartTour}>
                  <Compass className="h-3.5 w-3.5 mr-2" />
                  Iniciar tour guiado
                </Button>
              )}
              {onOpenShortcuts && (
                <Button variant="outline" size="sm" className="justify-start" onClick={onOpenShortcuts}>
                  <Keyboard className="h-3.5 w-3.5 mr-2" />
                  Atalhos de teclado
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => {
                  // Surface notifications via the global bell trigger if it exists.
                  const bell = document.querySelector<HTMLElement>("[data-notification-bell]");
                  bell?.click();
                }}
              >
                <Bell className="h-3.5 w-3.5 mr-2" />
                Ver notificações
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
              <BookOpen className="h-3 w-3" />
              Pressione <kbd className="px-1 py-0.5 text-[10px] rounded border bg-muted">?</kbd> a qualquer momento para abrir os atalhos.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
