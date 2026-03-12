import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { StatusPipeline } from "@/components/produto-brasil/StatusPipeline";
import { ColunaChina } from "@/components/produto-brasil/ColunaChina";
import { ColunaBrasil } from "@/components/produto-brasil/ColunaBrasil";
import { SkuTable } from "@/components/produto-brasil/SkuTable";
import { ChecklistRegulatorio } from "@/components/produto-brasil/ChecklistRegulatorio";
import { ProjetoVinculoBanner } from "@/components/produto-brasil/ProjetoVinculoBanner";
import { ImagemTimeline } from "@/components/produto-brasil/ImagemTimeline";
import { HistoricoAtividades } from "@/components/produto-brasil/HistoricoAtividades";

export default function ProdutoBrasilCadastro() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: produto, isLoading } = useProdutoBrasil(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Produto não encontrado.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">
            Pré-cadastro Brasil — {produto.china_nome || produto.china_codigo}
          </h1>
          <p className="text-sm text-muted-foreground">
            Adapte os dados do produto importado para o mercado brasileiro
          </p>
        </div>
      </div>

      {/* Project linking banner */}
      {!produto.projeto_id && <ProjetoVinculoBanner produto={produto} />}

      {/* Status Pipeline */}
      <StatusPipeline currentStatus={produto.status} />

      {/* Two columns: China x Brasil */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ColunaChina produto={produto} />
        <ColunaBrasil produto={produto} />
      </div>

      {/* SKU Table */}
      <SkuTable produtoBrasilId={produto.id} submissaoChinaId={produto.submissao_china_id} />

      {/* Image Timeline */}
      <ImagemTimeline produto={produto} />

      {/* Regulatory Checklist */}
      <ChecklistRegulatorio produto={produto} />

      {/* Activity History */}
      <HistoricoAtividades produtoBrasilId={produto.id} />
    </div>
  );
}
