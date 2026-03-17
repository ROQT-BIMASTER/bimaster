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
import { TabTestes } from "@/components/produto-brasil/tabs/TabTestes";
import { TabFormulacao } from "@/components/produto-brasil/tabs/TabFormulacao";
import { TabAnvisaPipeline } from "@/components/produto-brasil/tabs/TabAnvisaPipeline";
import { TabAprovacaoFisica } from "@/components/produto-brasil/tabs/TabAprovacaoFisica";
import { SkuTable } from "@/components/produto-brasil/SkuTable";
import { ImagemTimeline } from "@/components/produto-brasil/ImagemTimeline";
import { ColunaChina } from "@/components/produto-brasil/ColunaChina";
import { ChecklistRegulatorio } from "@/components/produto-brasil/ChecklistRegulatorio";
import { HistoricoAtividades } from "@/components/produto-brasil/HistoricoAtividades";
import { FichaCustoImportado } from "@/components/produto-brasil/FichaCustoImportado";
import { AprovacaoSubmissaoChina } from "@/components/produto-brasil/AprovacaoSubmissaoChina";
import { DocumentosBrasilAssinatura } from "@/components/produto-brasil/DocumentosBrasilAssinatura";
import { PastaDigitalPanel } from "@/components/produto-brasil/PastaDigitalPanel";

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
            {produto.nome_brasil || produto.china_nome || produto.china_codigo || "Novo Produto"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ciclo de vida completo do produto — da ideia ao lançamento
          </p>
        </div>
      </div>

      {/* Project linking banner */}
      {!produto.projeto_id && <ProjetoVinculoBanner produto={produto} />}

      {/* Status Pipeline - 12 stages */}
      <StatusPipeline currentStatus={produto.status} />

      {/* Approval card - only when linked to China submission */}
      {produto.submissao_china_id && <AprovacaoSubmissaoChina produto={produto} />}

      {/* Brasil documents signing */}
      {produto.submissao_china_id && (
        <DocumentosBrasilAssinatura
          submissaoId={produto.submissao_china_id}
          produtoNome={produto.nome_brasil || produto.china_nome || "Produto"}
        />
      )}

      {/* Main Tabbed Content */}
      <Tabs defaultValue="identificacao" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger value="identificacao" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Identificação</TabsTrigger>
          <TabsTrigger value="formulacao" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Formulação</TabsTrigger>
          <TabsTrigger value="classificacao" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Classificação</TabsTrigger>
          <TabsTrigger value="testes" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Testes</TabsTrigger>
          <TabsTrigger value="checklist" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Checklist</TabsTrigger>
          <TabsTrigger value="anvisa" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">ANVISA</TabsTrigger>
          <TabsTrigger value="aprovacao" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Aprovação</TabsTrigger>
          <TabsTrigger value="datas" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Datas</TabsTrigger>
          <TabsTrigger value="grade" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Grade/SKUs</TabsTrigger>
          <TabsTrigger value="custos" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Custos</TabsTrigger>
          <TabsTrigger value="pasta" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Pasta Digital</TabsTrigger>
          <TabsTrigger value="imagens" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Imagens</TabsTrigger>
          <TabsTrigger value="china" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Dados China</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs data-[state=active]:bg-primary/10 rounded-full px-3 py-1.5">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="identificacao" className="mt-4">
          <TabIdentificacao produto={produto} />
        </TabsContent>

        <TabsContent value="formulacao" className="mt-4">
          <TabFormulacao produto={produto} />
        </TabsContent>

        <TabsContent value="classificacao" className="mt-4">
          <TabClassificacao produto={produto} />
        </TabsContent>

        <TabsContent value="testes" className="mt-4">
          <TabTestes produtoBrasilId={produto.id} />
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <ChecklistRegulatorio produto={produto} />
        </TabsContent>

        <TabsContent value="anvisa" className="mt-4">
          <TabAnvisaPipeline produto={produto} />
        </TabsContent>

        <TabsContent value="aprovacao" className="mt-4">
          <TabAprovacaoFisica produtoBrasilId={produto.id} />
        </TabsContent>

        <TabsContent value="datas" className="mt-4">
          <TabDatasProcesso produto={produto} />
        </TabsContent>

        <TabsContent value="grade" className="mt-4">
          <SkuTable produtoBrasilId={produto.id} submissaoChinaId={produto.submissao_china_id} />
        </TabsContent>

        <TabsContent value="custos" className="mt-4">
          <FichaCustoImportado produtoBrasilId={produto.id} produtoNome={produto.nome_brasil || produto.china_nome || "Produto"} />
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
