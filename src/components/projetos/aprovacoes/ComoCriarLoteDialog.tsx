import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileText, Layers, Send, Users } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const passos = [
  {
    icon: Layers,
    titulo: "1. Abra uma tarefa de aprovação",
    desc: "Em qualquer projeto, abra a tarefa que precisa passar por aprovação (ex.: artes, embalagens, briefings).",
  },
  {
    icon: FileText,
    titulo: "2. Crie um lote de aprovação",
    desc: 'Dentro da tarefa, clique em "Novo lote", dê um nome (ex.: "Artes — rev. 1") e selecione os documentos que serão analisados.',
  },
  {
    icon: Users,
    titulo: "3. Escolha o fluxo de alçadas",
    desc: 'Selecione um modelo (ex.: "Aprovação Padrão") — ele define as etapas que o lote vai percorrer e quem aprova cada uma.',
  },
  {
    icon: Send,
    titulo: "4. Acompanhe pelo Kanban",
    desc: "Cada coluna do Kanban representa uma etapa. Quando um aprovador decide, o card avança automaticamente para a próxima coluna.",
  },
  {
    icon: CheckCircle2,
    titulo: "5. Conclusão",
    desc: "Após a última etapa, o lote vai para a coluna 'Concluído'. Se for rejeitado, uma nova rodada é aberta com comentários.",
  },
];

export function ComoCriarLoteDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Como criar um lote de aprovação</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {passos.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.titulo} className="flex gap-3 p-3 rounded-md border border-border bg-card/50">
                <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{p.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
