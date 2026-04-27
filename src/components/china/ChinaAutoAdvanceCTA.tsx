import { CheckCircle2, ShoppingCart, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  produtoCodigo: string;
  onIniciarOC?: () => void;
  onVerSubmissao?: () => void;
}

/**
 * Banner verde exibido no topo da Caixa de Entrada e do Painel
 * sempre que uma submissão atinge 100% de aprovação.
 *
 * Mensagem clara, bilíngue, próxima ação em 1 clique.
 */
export function ChinaAutoAdvanceCTA({ produtoCodigo, onIniciarOC, onVerSubmissao }: Props) {
  return (
    <Card className="p-4 border-success/30 bg-success/5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-success flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Tudo aprovado / 全部批准
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">{produtoCodigo}</span> está pronto
            para a próxima etapa. <span className="opacity-75">下一步可以开始</span>
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {onIniciarOC && (
              <Button size="sm" variant="success" onClick={onIniciarOC}>
                <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                Emitir OC / 发出采购单
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
            {onVerSubmissao && (
              <Button size="sm" variant="outline" onClick={onVerSubmissao}>
                Abrir submissão / 打开
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
