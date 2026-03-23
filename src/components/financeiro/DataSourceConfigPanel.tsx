import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useDataSourceConfig } from '@/hooks/useDataSourceConfig';
import { Database, Zap, Server, Calendar, Save, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOURCE_OPTIONS = [
  { value: 'n8n' as const, label: 'N8N (Webhook)', icon: Zap, desc: 'Dados via workflow N8N' },
  { value: 'erp_api' as const, label: 'ERP API (Direto)', icon: Server, desc: 'API direta com ERP' },
  { value: 'both' as const, label: 'Ambos', icon: Database, desc: 'N8N + ERP API coexistindo' },
];

export function DataSourceConfigPanel() {
  const { config, isLoading, updateConfig, isSaving } = useDataSourceConfig();
  const [localNotes, setLocalNotes] = useState('');
  const [localDate, setLocalDate] = useState('');
  const [initialized, setInitialized] = useState(false);

  if (!initialized && config) {
    setLocalNotes(config.notes || '');
    setLocalDate(config.transition_date || '');
    setInitialized(true);
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!config) return null;

  const handleSourceChange = (source: 'n8n' | 'erp_api' | 'both') => {
    updateConfig({
      source_type: source,
      n8n_enabled: source === 'n8n' || source === 'both',
      erp_api_enabled: source === 'erp_api' || source === 'both',
    });
  };

  const handleSaveDetails = () => {
    updateConfig({
      transition_date: localDate || null,
      notes: localNotes || null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              Fonte de Dados Ativa
            </CardTitle>
            <CardDescription>
              Configure qual fonte alimenta as tabelas de Contas a Pagar
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'text-xs font-medium',
              config.source_type === 'n8n' && 'bg-amber-50 text-amber-700 border-amber-200',
              config.source_type === 'erp_api' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
              config.source_type === 'both' && 'bg-blue-50 text-blue-700 border-blue-200',
            )}
          >
            {config.source_type === 'n8n' ? 'N8N' : config.source_type === 'erp_api' ? 'ERP API' : 'Ambos'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Source selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SOURCE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = config.source_type === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleSourceChange(opt.value)}
                disabled={isSaving}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all text-center',
                  active
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                )}
              >
                <Icon className={cn('h-6 w-6', active ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-sm font-medium', active ? 'text-primary' : 'text-foreground')}>
                  {opt.label}
                </span>
                <span className="text-xs text-muted-foreground">{opt.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Status indicators */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className={cn('h-2.5 w-2.5 rounded-full', config.n8n_enabled ? 'bg-emerald-500' : 'bg-gray-300')} />
            <span className="text-muted-foreground">N8N: {config.n8n_enabled ? 'Ativo' : 'Inativo'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('h-2.5 w-2.5 rounded-full', config.erp_api_enabled ? 'bg-emerald-500' : 'bg-gray-300')} />
            <span className="text-muted-foreground">ERP API: {config.erp_api_enabled ? 'Ativo' : 'Inativo'}</span>
          </div>
        </div>

        <Separator />

        {/* Transition planning */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Planejamento de Migração
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Data prevista de migração</Label>
              <Input
                type="date"
                value={localDate}
                onChange={(e) => setLocalDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Intervalo de sync (minutos)</Label>
              <Input
                type="number"
                min={5}
                max={1440}
                value={config.auto_sync_interval_minutes}
                onChange={(e) => updateConfig({ auto_sync_interval_minutes: parseInt(e.target.value) || 60 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Observações da gestora</Label>
            <Textarea
              placeholder="Notas sobre a transição, decisões, etc..."
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              rows={3}
            />
          </div>

          <Button onClick={handleSaveDetails} disabled={isSaving} size="sm" className="gap-2">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar Detalhes
          </Button>
        </div>

        {/* Info box */}
        <div className="rounded-lg bg-muted/50 p-3 flex gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Como funciona:</strong> No modo "Ambos", os dados do N8N continuam sendo importados
            normalmente enquanto a ERP API está em preparação. Quando a migração estiver pronta,
            mude para "ERP API (Direto)" para desativar o N8N.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
