/**
 * ChatIaActionCard — renderiza uma ação proposta pela IA dentro do chat.
 * Mostra nome da ação + parâmetros + botões Confirmar / Descartar.
 * NUNCA executa sozinho — apenas dispara o callback.
 */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X } from "lucide-react";

export interface IaToolProposal {
  id: string;
  nome: string;
  args: Record<string, any>;
}

const NOMES_PT: Record<string, string> = {
  aprovar_submissao: "Aprovar submissão",
  pedir_ajuste: "Pedir ajuste à China",
  encaminhar_responsavel: "Encaminhar a outro responsável",
  marcar_lida: "Marcar como lida",
};

interface Props {
  proposta: IaToolProposal;
  onConfirmar: (proposta: IaToolProposal) => void;
  onDescartar: (id: string) => void;
  disabled?: boolean;
}

export function ChatIaActionCard({ proposta, onConfirmar, onDescartar, disabled }: Props) {
  const titulo = NOMES_PT[proposta.nome] || proposta.nome;
  return (
    <Card className="border-dashed border-accent bg-accent/10 p-3 space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-accent-foreground" />
        <span className="text-xs font-semibold">Ação sugerida pela IA</span>
        <span className="text-xs text-muted-foreground">— {titulo}</span>
      </div>
      {Object.keys(proposta.args).length > 0 && (
        <div className="text-xs space-y-0.5 bg-background/60 rounded p-2 border">
          {Object.entries(proposta.args).map(([k, v]) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}:</span>{" "}
              <span className="font-medium">{Array.isArray(v) ? v.join(", ") : String(v)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onConfirmar(proposta)} disabled={disabled}>
          <Check className="h-3 w-3" /> Confirmar e executar
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onDescartar(proposta.id)} disabled={disabled}>
          <X className="h-3 w-3" /> Descartar
        </Button>
      </div>
    </Card>
  );
}
