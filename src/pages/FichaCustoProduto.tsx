import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useFichaCustoProduto } from "@/hooks/useFichaCustoProduto";
import { FichaCustoProdutoEditor } from "@/components/fabrica/FichaCustoProdutoEditor";

export default function FichaCustoProduto() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    produto,
    insumos,
    config,
    totais,
    loading,
    saving,
    adicionarInsumo,
    atualizarInsumo,
    removerInsumo,
    atualizarConfig,
    salvarFicha,
    TIPOS_INSUMO,
  } = useFichaCustoProduto(id);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!produto) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Produto não encontrado</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header com botão voltar */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/fabrica/produtos-acabados")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Ficha de Custos</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os custos detalhados do produto acabado
            </p>
          </div>
        </div>

        {/* Editor */}
        <FichaCustoProdutoEditor
          produto={produto}
          insumos={insumos}
          config={config}
          totais={totais}
          saving={saving}
          tiposInsumo={TIPOS_INSUMO}
          onAdicionarInsumo={adicionarInsumo}
          onAtualizarInsumo={atualizarInsumo}
          onRemoverInsumo={removerInsumo}
          onAtualizarConfig={atualizarConfig}
          onSalvar={salvarFicha}
        />
      </div>
    </DashboardLayout>
  );
}
