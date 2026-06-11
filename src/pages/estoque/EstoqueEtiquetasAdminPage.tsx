import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Save } from 'lucide-react';
import { useState } from 'react';
import {
  useEstoqueEtiquetas,
  useCreateEtiqueta,
  useUpdateEtiqueta,
  useDeleteEtiqueta,
  type EstoqueEtiqueta,
} from '@/hooks/estoque/useEstoqueEtiquetas';
import { toast } from 'sonner';

function EtiquetaCard({ e }: { e: EstoqueEtiqueta }) {
  const upd = useUpdateEtiqueta();
  const del = useDeleteEtiqueta();
  const [draft, setDraft] = useState(e);

  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="sm:col-span-2">
          <Label className="text-xs">Nome</Label>
          <Input value={draft.nome} onChange={(ev) => setDraft({ ...draft, nome: ev.target.value })} className="h-8" />
        </div>
        <div>
          <Label className="text-xs">Cor</Label>
          <Input
            type="color"
            value={draft.cor_hex}
            onChange={(ev) => setDraft({ ...draft, cor_hex: ev.target.value })}
            className="h-8 p-1"
          />
        </div>
        <div>
          <Label className="text-xs">Início</Label>
          <Input
            type="date"
            value={draft.vigencia_inicio ?? ''}
            onChange={(ev) => setDraft({ ...draft, vigencia_inicio: ev.target.value || null })}
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">Fim</Label>
          <Input
            type="date"
            value={draft.vigencia_fim ?? ''}
            onChange={(ev) => setDraft({ ...draft, vigencia_fim: ev.target.value || null })}
            className="h-8"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={draft.ativo}
            onCheckedChange={(v) => setDraft({ ...draft, ativo: v })}
          />
          <Label className="text-xs">Ativa</Label>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={upd.isPending}
            onClick={async () => {
              await upd.mutateAsync({
                id: draft.id,
                nome: draft.nome,
                cor_hex: draft.cor_hex,
                vigencia_inicio: draft.vigencia_inicio,
                vigencia_fim: draft.vigencia_fim,
                ativo: draft.ativo,
              });
              toast.success('Etiqueta atualizada');
            }}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={del.isPending}
            onClick={async () => {
              if (!confirm(`Remover etiqueta "${draft.nome}" e todos os vínculos?`)) return;
              await del.mutateAsync(draft.id);
              toast.success('Etiqueta removida');
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function EstoqueEtiquetasAdminPage() {
  const { data: etiquetas = [], isLoading } = useEstoqueEtiquetas(false);
  const create = useCreateEtiqueta();
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#111827');

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Etiquetas de Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Campanhas usadas para marcar produtos no estoque (ex.: Black, Liquidação). Valem para todas as filiais.
          </p>
        </div>

        <Card className="p-4">
          <Label className="text-xs">Criar nova etiqueta</Label>
          <div className="flex items-end gap-2 mt-2">
            <div className="flex-1">
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Black Friday" className="h-9" />
            </div>
            <Input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-9 w-16 p-1" />
            <Button
              disabled={!nome.trim() || create.isPending}
              onClick={async () => {
                await create.mutateAsync({ nome: nome.trim(), cor_hex: cor, ativo: true });
                setNome('');
                toast.success('Etiqueta criada');
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> Criar
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && etiquetas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma etiqueta cadastrada.</p>
          )}
          {etiquetas.map((e) => <EtiquetaCard key={e.id} e={e} />)}
        </div>
      </div>
    </DashboardLayout>
  );
}
