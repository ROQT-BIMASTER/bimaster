import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarDays, MousePointerClick, Eye, Download, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { abrirCentralNovidades } from "@/lib/novidades/abrirCentralNovidades";

const STORAGE_PREFIX = "calendario-geral:boas-vindas:v1:";

const ITENS = [
  {
    icon: CalendarDays,
    titulo: "Tudo em um só lugar",
    texto: "As tarefas de todos os seus projetos aparecem junto com os eventos que você criar. Use as camadas no topo para exibir ou ocultar cada tipo.",
  },
  {
    icon: Eye,
    titulo: "Visibilidade sob controle",
    texto: "Escolha entre ver somente os seus compromissos, os das suas equipes ou tudo que o seu acesso permite. A opção fica salva para as próximas visitas.",
  },
  {
    icon: MousePointerClick,
    titulo: "Arraste para reagendar",
    texto: "Arraste um evento para outro dia e confirme a nova data. Quando o evento faz parte de uma série, você decide entre mover só aquela ocorrência ou a série inteira.",
  },
  {
    icon: Download,
    titulo: "Exporte ou assine",
    texto: "Baixe o período visível em iCalendar (.ics) ou gere um link de assinatura para acompanhar a agenda no Google Agenda, Outlook ou Apple Calendário.",
  },
];

/**
 * Modal de boas-vindas do Calendário Geral, exibido apenas na primeira visita
 * de cada usuário (registro local por conta).
 */
export function CalendarioBoasVindasDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    try {
      if (!localStorage.getItem(STORAGE_PREFIX + user.id)) setOpen(true);
    } catch {
      /* storage indisponível: não bloqueia a tela */
    }
  }, [user?.id]);

  const concluir = () => {
    try {
      if (user?.id) localStorage.setItem(STORAGE_PREFIX + user.id, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) concluir(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Bem-vindo ao Calendário Geral
          </DialogTitle>
          <DialogDescription>
            Uma visão única dos prazos dos seus projetos e dos seus compromissos.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {ITENS.map(({ icon: Icon, titulo, texto }) => (
            <li key={titulo} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{titulo}</p>
                <p className="text-xs text-muted-foreground">{texto}</p>
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => { concluir(); abrirCentralNovidades(); }}
          >
            <Sparkles className="h-4 w-4" />
            Ver Central de Novidades
          </Button>
          <Button onClick={concluir}>Começar a usar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
