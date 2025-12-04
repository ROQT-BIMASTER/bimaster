import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Minus,
  Shield,
  AlertCircle,
  Ban
} from "lucide-react";

interface ClienteAgrupado {
  cliente_codigo: string;
  cliente_nome: string;
  total_aberto: number;
  total_titulos: number;
  dias_medio_atraso: number;
  maior_atraso: number;
  contas: any[];
  ultima_cobranca?: {
    tipo_acao: string;
    data_acao: string;
    status: string;
  };
}

interface Props {
  cliente: ClienteAgrupado;
}

export function ClienteScoring({ cliente }: Props) {
  // Calcular score de risco (0-100, onde 100 = alto risco)
  const scoring = useMemo(() => {
    let score = 0;
    let factors: { label: string; impact: 'positive' | 'negative' | 'neutral'; value: string }[] = [];

    // Fator: Dias de atraso (peso 40%)
    if (cliente.maior_atraso >= 90) {
      score += 40;
      factors.push({ label: 'Atraso crítico (+90 dias)', impact: 'negative', value: `${cliente.maior_atraso} dias` });
    } else if (cliente.maior_atraso >= 60) {
      score += 30;
      factors.push({ label: 'Atraso alto (60-90 dias)', impact: 'negative', value: `${cliente.maior_atraso} dias` });
    } else if (cliente.maior_atraso >= 30) {
      score += 20;
      factors.push({ label: 'Atraso moderado (30-60 dias)', impact: 'negative', value: `${cliente.maior_atraso} dias` });
    } else {
      score += 10;
      factors.push({ label: 'Atraso recente (<30 dias)', impact: 'neutral', value: `${cliente.maior_atraso} dias` });
    }

    // Fator: Valor em aberto (peso 30%)
    if (cliente.total_aberto >= 50000) {
      score += 30;
      factors.push({ label: 'Valor muito alto', impact: 'negative', value: `R$ ${(cliente.total_aberto/1000).toFixed(0)}k` });
    } else if (cliente.total_aberto >= 20000) {
      score += 22;
      factors.push({ label: 'Valor alto', impact: 'negative', value: `R$ ${(cliente.total_aberto/1000).toFixed(0)}k` });
    } else if (cliente.total_aberto >= 5000) {
      score += 15;
      factors.push({ label: 'Valor moderado', impact: 'neutral', value: `R$ ${(cliente.total_aberto/1000).toFixed(0)}k` });
    } else {
      score += 5;
      factors.push({ label: 'Valor baixo', impact: 'positive', value: `R$ ${cliente.total_aberto.toFixed(0)}` });
    }

    // Fator: Quantidade de títulos (peso 15%)
    if (cliente.total_titulos >= 5) {
      score += 15;
      factors.push({ label: 'Muitos títulos vencidos', impact: 'negative', value: `${cliente.total_titulos} títulos` });
    } else if (cliente.total_titulos >= 3) {
      score += 10;
      factors.push({ label: 'Vários títulos vencidos', impact: 'negative', value: `${cliente.total_titulos} títulos` });
    } else {
      score += 5;
      factors.push({ label: 'Poucos títulos', impact: 'neutral', value: `${cliente.total_titulos} títulos` });
    }

    // Fator: Histórico de cobrança (peso 15%)
    if (!cliente.ultima_cobranca) {
      score += 10;
      factors.push({ label: 'Sem histórico de contato', impact: 'neutral', value: 'Novo' });
    } else if (cliente.ultima_cobranca.status === 'acordo') {
      score -= 10;
      factors.push({ label: 'Tem acordo vigente', impact: 'positive', value: 'Acordo' });
    } else if (cliente.ultima_cobranca.status === 'sem_sucesso') {
      score += 15;
      factors.push({ label: 'Última tentativa sem sucesso', impact: 'negative', value: 'Difícil' });
    } else {
      score += 5;
      factors.push({ label: 'Histórico de contato', impact: 'neutral', value: 'Regular' });
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      factors,
      classification: score >= 70 ? 'critical' : score >= 50 ? 'high' : score >= 30 ? 'medium' : 'low'
    };
  }, [cliente]);

  const getClassificationInfo = () => {
    switch (scoring.classification) {
      case 'critical':
        return { 
          label: 'Risco Crítico', 
          color: 'destructive',
          icon: Ban,
          action: 'Ação imediata necessária'
        };
      case 'high':
        return { 
          label: 'Alto Risco', 
          color: 'orange-500',
          icon: AlertCircle,
          action: 'Priorizar contato'
        };
      case 'medium':
        return { 
          label: 'Risco Médio', 
          color: 'yellow-500',
          icon: AlertTriangle,
          action: 'Monitorar de perto'
        };
      default:
        return { 
          label: 'Baixo Risco', 
          color: 'green-500',
          icon: Shield,
          action: 'Seguir processo padrão'
        };
    }
  };

  const classInfo = getClassificationInfo();
  const Icon = classInfo.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Score de Risco</span>
          <Badge 
            variant={scoring.classification === 'critical' ? 'destructive' : 'secondary'}
            className={
              scoring.classification === 'high' ? 'bg-orange-500' :
              scoring.classification === 'medium' ? 'bg-yellow-500 text-black' :
              scoring.classification === 'low' ? 'bg-green-500' : ''
            }
          >
            <Icon className="h-3 w-3 mr-1" />
            {classInfo.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Visual */}
        <div className="relative">
          <Progress 
            value={scoring.score} 
            className="h-3"
          />
          <div 
            className="absolute top-0 h-3 bg-gradient-to-r from-green-500 via-yellow-500 via-orange-500 to-red-500 opacity-20 rounded-full"
            style={{ width: '100%' }}
          />
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>Baixo</span>
            <span className="font-bold">{scoring.score}/100</span>
            <span>Crítico</span>
          </div>
        </div>

        {/* Fatores */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Fatores de risco:</p>
          {scoring.factors.map((factor, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {factor.impact === 'negative' ? (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                ) : factor.impact === 'positive' ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">{factor.label}</span>
              </div>
              <span className={
                factor.impact === 'negative' ? 'text-destructive' :
                factor.impact === 'positive' ? 'text-green-500' : ''
              }>
                {factor.value}
              </span>
            </div>
          ))}
        </div>

        {/* Recomendação */}
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">Recomendação:</p>
          <p className="text-sm font-medium">{classInfo.action}</p>
        </div>
      </CardContent>
    </Card>
  );
}
