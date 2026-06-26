import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { ClienteHistoricoCompraChart } from "@/components/fornecedor/clientes/ClienteHistoricoCompraChart";
import { Users } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { FuturaBackButton } from "@/components/fornecedor/FuturaBackButton";

const sb = supabase as any;

export default function ClienteHistoricoPage() {
  const { id } = useParams<{ id: string }>();
  const clienteId = id ? Number(id) : NaN;
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!clienteId || Number.isNaN(clienteId)) return;
      // Tenta v_vendas primeiro (rápido); cai pra erp_clientes_raw se vazio
      const { data } = await sb
        .from("v_vendas")
        .select("cliente_nome")
        .eq("cliente_futura_id", clienteId)
        .limit(1);
      if (!cancelled && data && data.length > 0) {
        setNome(data[0].cliente_nome ?? null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  if (!clienteId || Number.isNaN(clienteId)) {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <p className="text-sm text-muted-foreground">Cliente inválido.</p>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 py-6 space-y-4">
      <PageHeader
        title={nome ?? `Cliente #${clienteId}`}
        description="Histórico de compras, tendência e projeção"
        icon={Users}
        breadcrumbs={[
          { label: "Fornecedor", href: "/dashboard/fornecedor" },
          { label: "Pedidos", href: "/dashboard/fornecedor/pedidos" },
          { label: nome ?? `Cliente #${clienteId}` },
        ]}
      />
      <ClienteHistoricoCompraChart
        clienteId={clienteId}
        clienteNome={nome}
        height={460}
      />
    </div>
  );
}
