import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { StatusPipeline } from "@/components/produto-brasil/StatusPipeline";
import { ProjetoVinculoBanner } from "@/components/produto-brasil/ProjetoVinculoBanner";
import { TabIdentificacao } from "@/components/produto-brasil/tabs/TabIdentificacao";
import { TabClassificacao } from "@/components/produto-brasil/tabs/TabClassificacao";
import { TabRegulatorio } from "@/components/produto-brasil/tabs/TabRegulatorio";
import { TabDatasProcesso } from "@/components/produto-brasil/tabs/TabDatasProcesso";
import { SkuTable } from "@/components/produto-brasil/SkuTable";
import { ImagemTimeline } from "@/components/produto-brasil/ImagemTimeline";
import { ColunaChina } from "@/components/produto-brasil/ColunaChina";
import { ChecklistRegulatorio } from "@/components/produto-brasil/ChecklistRegulatorio";
import { HistoricoAtividades } from "@/components/produto-brasil/HistoricoAtividades";
import { FichaCustoImportado } from "@/components/produto-brasil/FichaCustoImportado";

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
            Pré-cadastro Brasil — {produto.nome_brasil || produto.china_nome || produto.china_codigo}
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

      {/* Main Tabbed Content */}
      <Tabs defaultValue="identificacao" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-9">
          <TabsTrigger value="identificacao" className="text-xs">Identificação</TabsTrigger>
          <TabsTrigger value="classificacao" className="text-xs">Classificação</TabsTrigger>
          <TabsTrigger value="regulatorio" className="text-xs">Regulatório</TabsTrigger>
          <TabsTrigger value="datas" className="text-xs">Datas</TabsTrigger>
          <TabsTrigger value="grade" className="text-xs">Grade / SKUs</TabsTrigger>
          <TabsTrigger value="custos" className="text-xs">Custos</TabsTrigger>
          <TabsTrigger value="imagens" className="text-xs">Imagens</TabsTrigger>
          <TabsTrigger value="china" className="text-xs">Dados China</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="identificacao" className="mt-4">
          <TabIdentificacao produto={produto} />
        </TabsContent>

        <TabsContent value="classificacao" className="mt-4">
          <TabClassificacao produto={produto} />
        </TabsContent>

        <TabsContent value="regulatorio" className="mt-4">
          <ChecklistRegulatorio produto={produto} />
        </TabsContent>

        <TabsContent value="datas" className="mt-4">
          <TabDatasProcesso produto={produto} />
        </TabsContent>

        <TabsContent value="grade" className="mt-4">
          <SkuTable produtoBrasilId={produto.id} submissaoChinaId={produto.submissao_china_id} />
        </TabsContent>

        <TabsContent value="imagens" className="mt-4">
          <ImagemTimeline produto={produto} />
        </TabsContent>

        <TabsContent value="china" className="mt-4">
          <ColunaChina produto={produto} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoAtividades produtoBrasilId={produto.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
