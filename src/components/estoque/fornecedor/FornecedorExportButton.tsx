import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchFornecedorIntegradoAll,
  type FornecedorExportOpts,
  type DistribuidoraEmpresa,
} from '@/hooks/estoque/useFornecedorIntegrado';
import { exportFornecedorEstoque } from '@/lib/estoque/exportFornecedorEstoque';

const MAX_ROWS = 20000;

interface Props {
  opts: FornecedorExportOpts;
  filiais: DistribuidoraEmpresa[];
  filtrosResumo: string;
}

export function FornecedorExportButton({ opts, filiais, filtrosResumo }: Props) {
  const [loading, setLoading] = useState(false);

  const exportar = async () => {
    setLoading(true);
    try {
      const rows = await fetchFornecedorIntegradoAll(opts, MAX_ROWS);
      if (rows.length === 0) {
        toast.warning('Nenhum item no recorte atual.');
        return;
      }
      if (rows.length >= MAX_ROWS) {
        toast.error(`Recorte muito grande (${MAX_ROWS.toLocaleString('pt-BR')}+ itens). Refine os filtros.`);
        return;
      }
      await exportFornecedorEstoque({ rows, filiais, filtrosResumo });
      toast.success(`${rows.length.toLocaleString('pt-BR')} item(ns) exportado(s).`);
    } catch (e: any) {
      toast.error('Falha ao exportar: ' + (e?.message ?? 'erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={exportar} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
      {loading ? 'Gerando...' : 'Exportar Excel'}
    </Button>
  );
}
