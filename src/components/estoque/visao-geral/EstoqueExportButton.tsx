import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { EstoqueFiltros } from '@/lib/estoque/estoqueFilters';

interface Props {
  filtros: EstoqueFiltros;
  total: number;
}

export function EstoqueExportButton({ filtros, total }: Props) {
  const [loading, setLoading] = useState(false);

  const exportar = async () => {
    if (total === 0) {
      toast.warning('Nenhum registro no recorte atual.');
      return;
    }
    if (total > 50000) {
      toast.error('Recorte muito grande (>50.000). Refine os filtros.');
      return;
    }
    setLoading(true);
    try {
      // Reaplica filtros (mesma lógica do hook, sem ordenação/paginação)
      let q = supabase.from('erp_estoque_distribuidora').select(
        'empresa_par,abrev_par,cod_produto,cod_fabricante,nome_prod,nome_linha,unidade_medida,saldo,pedido_pendente,custo_unitario,custo_total,valor_venda,curva_fisica,curva_monetaria,data_ultima_compra,validade,lote,localizacao,sincronizado_em'
      );
      if (filtros.busca) q = q.or(`nome_prod.ilike.%${filtros.busca}%,cod_fabricante.ilike.%${filtros.busca}%,erp_id.ilike.%${filtros.busca}%`);
      if (filtros.empresa_ids.length) q = q.in('empresa_par', filtros.empresa_ids);
      if (filtros.linhas.length) q = q.in('nome_linha', filtros.linhas);
      if (filtros.unidades.length) q = q.in('unidade_medida', filtros.unidades);
      if (filtros.curvas_fisicas.length) q = q.in('curva_fisica', filtros.curvas_fisicas);
      if (filtros.curvas_monetarias.length) q = q.in('curva_monetaria', filtros.curvas_monetarias);
      if (filtros.apenas_com_saldo) q = q.gt('saldo', 0);
      if (filtros.com_pedido_pendente) q = q.gt('pedido_pendente', 0);
      if (filtros.saldo_min != null) q = q.gte('saldo', filtros.saldo_min);
      if (filtros.saldo_max != null) q = q.lte('saldo', filtros.saldo_max);
      if (filtros.valor_min != null) q = q.gte('custo_total', filtros.valor_min);
      if (filtros.valor_max != null) q = q.lte('custo_total', filtros.valor_max);

      const { data, error } = await q.limit(50000);
      if (error) throw error;

      const ws = XLSX.utils.json_to_sheet((data ?? []).map((r: any) => ({
        Empresa: r.abrev_par,
        Cod_ERP: r.cod_produto,
        Cod_Fabricante: r.cod_fabricante,
        Produto: r.nome_prod,
        Linha: r.nome_linha,
        UM: r.unidade_medida,
        Saldo: r.saldo,
        Pedido_Pendente: r.pedido_pendente,
        Custo_Unitario: r.custo_unitario,
        Custo_Total: r.custo_total,
        Valor_Venda: r.valor_venda,
        Curva_Fisica: r.curva_fisica,
        Curva_Monetaria: r.curva_monetaria,
        Ultima_Compra: r.data_ultima_compra,
        Validade: r.validade,
        Lote: r.lote,
        Localizacao: r.localizacao,
        Sincronizado_Em: r.sincronizado_em,
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
      XLSX.writeFile(wb, `estoque_${new Date().toISOString().slice(0,10)}.xlsx`);
      toast.success(`${data?.length ?? 0} registros exportados.`);
    } catch (e: any) {
      toast.error('Falha ao exportar: ' + (e.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={exportar} disabled={loading} className="h-9">
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
      Exportar
    </Button>
  );
}
