import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";

/**
 * Banner informativo da Fase 4 da unificação Submissão↔Projeto.
 *
 * Visível apenas quando a feature flag `ff_unificacao_vincular_china`
 * estiver ativa. Com a flag desligada (padrão em produção), o componente
 * não renderiza nada — garantindo zero impacto no fluxo legado.
 */
export function UnificacaoBanner() {
  const { enabled } = useFeatureFlag("ff_unificacao_vincular_china");

  if (!enabled) return null;

  return (
    <Alert className="border-primary/30 bg-primary/5">
      <Info className="h-4 w-4" />
      <AlertTitle>Fluxo unificado disponível</AlertTitle>
      <AlertDescription>
        A vinculação de Submissões a Projetos agora pode ser feita diretamente
        pela tela da Submissão. Esta tela continua funcionando normalmente e
        será descontinuada em breve.
      </AlertDescription>
    </Alert>
  );
}
