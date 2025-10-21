import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const CNPJBizCreditos = () => {
  const [saldo, setSaldo] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);

  const carregarSaldo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cnpjbiz-consulta', {
        body: { operation: 'creditos' }
      });

      if (error) throw error;
      setSaldo(data.saldo);
    } catch (error) {
      console.error('Erro ao carregar saldo:', error);
      toast.error('Erro ao carregar saldo de créditos');
    } finally {
      setLoading(false);
    }
  };

  const carregarHistorico = async () => {
    try {
      const { data, error } = await supabase
        .from('cnpjbiz_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistorico(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  useEffect(() => {
    carregarSaldo();
    carregarHistorico();
  }, []);

  const getSaldoColor = () => {
    if (saldo === null) return 'default';
    if (saldo < 20) return 'destructive';
    if (saldo < 100) return 'secondary';
    return 'default';
  };

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h3 className="font-semibold text-lg">Créditos CNPJ.BIZ</h3>
            <p className="text-sm text-muted-foreground">Saldo disponível para consultas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarSaldo}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            variant="default"
            size="sm"
            asChild
          >
            <a href="https://cnpj.biz" target="_blank" rel="noopener noreferrer">
              Adquirir Créditos
              <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Saldo Atual</div>
          <div className="flex items-center gap-3">
            {saldo === null ? (
              <span className="text-2xl font-bold">Carregando...</span>
            ) : (
              <>
                <span className="text-3xl font-bold">{saldo.toLocaleString('pt-BR')}</span>
                <Badge variant={getSaldoColor()}>
                  {saldo < 20 ? 'Crítico' : saldo < 100 ? 'Baixo' : 'Normal'}
                </Badge>
              </>
            )}
          </div>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Últimas Operações</div>
          <div className="text-2xl font-bold">
            {historico.reduce((sum, h) => sum + (h.credits_used || 0), 0).toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {historico.length} operações registradas
          </div>
        </div>
      </div>

      {saldo !== null && saldo < 20 && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive font-medium">
            ⚠️ Atenção: Seu saldo de créditos está muito baixo. Adquira mais créditos para continuar usando a importação via API.
          </p>
        </div>
      )}
    </Card>
  );
};
