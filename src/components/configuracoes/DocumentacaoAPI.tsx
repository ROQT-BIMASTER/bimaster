import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Copy, Database, TrendingUp, ExternalLink, Info, FileJson, Server, RefreshCw, History } from "lucide-react";
import { toast } from "sonner";

export const DocumentacaoAPI = () => {
  const apiBaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const crmEndpoints = [
    {
      name: "Exportar Prospects",
      method: "GET",
      path: "/functions/v1/export-prospects",
      description: "Exporta todos os dados de prospects incluindo vendedores responsáveis e estatísticas de atividades",
      icon: Database,
      exemplo: {
        curl: `curl -X GET '${apiBaseUrl}/functions/v1/export-prospects' \\
  -H 'Content-Type: application/json'`,
        response: `{
  "success": true,
  "total": 150,
  "data": [
    {
      "id": "uuid",
      "nome_empresa": "Empresa Exemplo LTDA",
      "cnpj": "12.345.678/0001-90",
      "email": "contato@exemplo.com",
      "telefone": "(11) 98765-4321",
      "status": "negociacao",
      "vendedor": {
        "id": "uuid",
        "nome": "João Silva",
        "email": "joao@empresa.com"
      },
      "total_atividades": 5,
      "atividades_pendentes": 2,
      "atividades_concluidas": 3
    }
  ],
  "exported_at": "2025-10-21T12:00:00.000Z"
}`
      }
    },
    {
      name: "Taxas de Conversão",
      method: "GET",
      path: "/functions/v1/export-conversion-rates",
      description: "Retorna métricas e taxas de conversão detalhadas por vendedor e status",
      icon: TrendingUp,
      exemplo: {
        curl: `curl -X GET '${apiBaseUrl}/functions/v1/export-conversion-rates' \\
  -H 'Content-Type: application/json'`,
        response: `{
  "success": true,
  "metricas_gerais": {
    "total_prospects": 150,
    "prospects_ganhos": 45,
    "prospects_perdidos": 30,
    "prospects_ativos": 75,
    "taxa_conversao_geral": "30.00",
    "taxa_perda_geral": "20.00"
  },
  "distribuicao_por_status": {
    "novo": 25,
    "em_contato": 20,
    "proposta_enviada": 15,
    "negociacao": 15,
    "ganho": 45,
    "perdido": 30
  },
  "funil_conversao": {
    "novo_para_contato": "83.33",
    "contato_para_proposta": "75.00",
    "proposta_para_negociacao": "80.00",
    "negociacao_para_ganho": "75.00"
  },
  "taxas_por_vendedor": [
    {
      "vendedor_id": "uuid",
      "vendedor_nome": "João Silva",
      "vendedor_email": "joao@empresa.com",
      "total_prospects": 50,
      "prospects_ganhos": 20,
      "prospects_perdidos": 10,
      "prospects_ativos": 20,
      "taxa_conversao": "40.00",
      "taxa_perda": "20.00"
    }
  ],
  "exported_at": "2025-10-21T12:00:00.000Z"
}`
      }
    }
  ];

  const dwEndpoints = [
    {
      name: "Exportar Data Warehouse",
      method: "POST",
      path: "/functions/v1/export-datawarehouse",
      description: "Exporta dados completos do DW em formato JSON ou CSV (dimensões, fatos ou agregações)",
      icon: FileJson,
      requiresAuth: true,
      exemplo: {
        curl: `curl -X POST '${apiBaseUrl}/functions/v1/export-datawarehouse' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -d '{
    "entity_type": "aggregations",
    "format": "json",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "regiao": "Sul",
    "uf": "RS"
  }'`,
        response: `{
  "agg_daily_kpis": [
    {
      "date": "2025-10-20",
      "regiao": "Sul",
      "uf": "RS",
      "total_visitas": 45,
      "total_vendas": 125000.00,
      "total_investimentos": 15000.00,
      "media_ticket": 2777.78,
      "total_prospects": 120,
      "prospects_convertidos": 36,
      "taxa_conversao": 30.00,
      "total_atividades": 89
    }
  ],
  "mv_sales_performance": [...],
  "mv_conversion_funnel": [...],
  "mv_trade_performance": [...]
}`,
        params: [
          { name: "entity_type", type: "string", required: true, description: "'dimensions', 'facts' ou 'aggregations'" },
          { name: "format", type: "string", required: false, description: "'json' (padrão) ou 'csv'" },
          { name: "table_name", type: "string", required: false, description: "Nome específico da tabela (opcional)" },
          { name: "start_date", type: "string", required: false, description: "Data inicial (YYYY-MM-DD)" },
          { name: "end_date", type: "string", required: false, description: "Data final (YYYY-MM-DD)" },
          { name: "regiao", type: "string", required: false, description: "Filtrar por região" },
          { name: "uf", type: "string", required: false, description: "Filtrar por UF" }
        ]
      }
    },
    {
      name: "API Data Warehouse - Schema",
      method: "GET",
      path: "/functions/v1/datawarehouse-api",
      description: "Retorna o schema completo do Data Warehouse (dimensões, fatos, agregações)",
      icon: Server,
      requiresAuth: true,
      exemplo: {
        curl: `curl -X GET '${apiBaseUrl}/functions/v1/datawarehouse-api' \\
  -H 'Authorization: Bearer YOUR_TOKEN'`,
        response: `{
  "dimensions": [
    "municipios",
    "prospects",
    "stores",
    "profiles",
    "competitors",
    "trade_chart_of_accounts",
    "trade_campaigns"
  ],
  "facts": [
    "atividades",
    "visits",
    "gondola_audits",
    "shelf_share",
    "trade_investments",
    "trade_financial_entries",
    "trade_bank_transactions",
    "sales",
    "kpis_tracking"
  ],
  "aggregations": [
    "mv_sales_performance",
    "mv_conversion_funnel",
    "mv_trade_performance",
    "agg_daily_kpis"
  ]
}`
      }
    },
    {
      name: "Consultar Dimensões",
      method: "GET",
      path: "/functions/v1/datawarehouse-api/dimensions/{table}",
      description: "Consulta dados de uma tabela de dimensão com paginação e filtros",
      icon: Database,
      requiresAuth: true,
      exemplo: {
        curl: `curl -X GET '${apiBaseUrl}/functions/v1/datawarehouse-api/dimensions/prospects?page=1&pageSize=50&status=negociacao&sort=created_at&order=desc' \\
  -H 'Authorization: Bearer YOUR_TOKEN'`,
        response: `{
  "data": [
    {
      "id": "uuid",
      "nome_empresa": "Empresa ABC",
      "cnpj": "12.345.678/0001-90",
      "status": "negociacao",
      "created_at": "2025-10-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 125,
    "totalPages": 3
  }
}`,
        params: [
          { name: "page", type: "number", required: false, description: "Número da página (padrão: 1)" },
          { name: "pageSize", type: "number", required: false, description: "Itens por página (padrão: 100)" },
          { name: "sort", type: "string", required: false, description: "Campo para ordenação" },
          { name: "order", type: "string", required: false, description: "'asc' ou 'desc'" },
          { name: "{campo}", type: "any", required: false, description: "Filtros por qualquer campo da tabela" }
        ]
      }
    },
    {
      name: "Consultar Fatos",
      method: "GET",
      path: "/functions/v1/datawarehouse-api/facts/{table}",
      description: "Consulta dados de uma tabela de fatos com filtros de data",
      icon: TrendingUp,
      requiresAuth: true,
      exemplo: {
        curl: `curl -X GET '${apiBaseUrl}/functions/v1/datawarehouse-api/facts/sales?start_date=2025-01-01&end_date=2025-12-31&page=1&pageSize=100' \\
  -H 'Authorization: Bearer YOUR_TOKEN'`,
        response: `{
  "data": [
    {
      "id": "uuid",
      "sale_date": "2025-10-15",
      "total_value": 15000.00,
      "net_value": 14250.00,
      "status": "completed"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 100,
    "total": 450,
    "totalPages": 5
  }
}`,
        params: [
          { name: "start_date", type: "string", required: false, description: "Data inicial (YYYY-MM-DD)" },
          { name: "end_date", type: "string", required: false, description: "Data final (YYYY-MM-DD)" },
          { name: "page", type: "number", required: false, description: "Número da página" },
          { name: "pageSize", type: "number", required: false, description: "Itens por página" },
          { name: "sort", type: "string", required: false, description: "Campo para ordenação" },
          { name: "order", type: "string", required: false, description: "'asc' ou 'desc'" }
        ]
      }
    },
    {
      name: "Consultar Agregações",
      method: "GET",
      path: "/functions/v1/datawarehouse-api/aggregations",
      description: "Consulta views materializadas e KPIs agregados",
      icon: TrendingUp,
      requiresAuth: true,
      exemplo: {
        curl: `curl -X GET '${apiBaseUrl}/functions/v1/datawarehouse-api/aggregations?view=agg_daily_kpis&regiao=Sul&uf=RS&page=1' \\
  -H 'Authorization: Bearer YOUR_TOKEN'`,
        response: `{
  "data": [
    {
      "date": "2025-10-20",
      "regiao": "Sul",
      "uf": "RS",
      "total_visitas": 45,
      "total_vendas": 125000.00,
      "taxa_conversao": 30.00
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 100,
    "total": 365,
    "totalPages": 4
  }
}`,
        params: [
          { name: "view", type: "string", required: false, description: "Nome da view (padrão: agg_daily_kpis)" },
          { name: "regiao", type: "string", required: false, description: "Filtrar por região" },
          { name: "uf", type: "string", required: false, description: "Filtrar por UF" },
          { name: "page", type: "number", required: false, description: "Número da página" }
        ]
      }
    },
    {
      name: "Changelog (CDC)",
      method: "GET",
      path: "/functions/v1/datawarehouse-api/changelog",
      description: "Consulta histórico de mudanças (Change Data Capture)",
      icon: History,
      requiresAuth: true,
      exemplo: {
        curl: `curl -X GET '${apiBaseUrl}/functions/v1/datawarehouse-api/changelog?table_name=sales&operation=INSERT&start_date=2025-10-01&page=1' \\
  -H 'Authorization: Bearer YOUR_TOKEN'`,
        response: `{
  "data": [
    {
      "id": "uuid",
      "table_name": "sales",
      "operation": "INSERT",
      "record_id": "uuid",
      "changed_data": {...},
      "changed_at": "2025-10-20T15:30:00Z",
      "changed_by": "uuid"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 100,
    "total": 1250,
    "totalPages": 13
  }
}`,
        params: [
          { name: "table_name", type: "string", required: false, description: "Nome da tabela" },
          { name: "operation", type: "string", required: false, description: "'INSERT', 'UPDATE' ou 'DELETE'" },
          { name: "start_date", type: "string", required: false, description: "Data inicial" },
          { name: "end_date", type: "string", required: false, description: "Data final" }
        ]
      }
    },
    {
      name: "Atualizar Views/KPIs",
      method: "POST",
      path: "/functions/v1/datawarehouse-api/refresh/{target}",
      description: "Atualiza views materializadas ou KPIs diários manualmente",
      icon: RefreshCw,
      requiresAuth: true,
      exemplo: {
        curl: `curl -X POST '${apiBaseUrl}/functions/v1/datawarehouse-api/refresh/views' \\
  -H 'Authorization: Bearer YOUR_TOKEN'`,
        response: `{
  "success": true,
  "message": "Refresh completed successfully",
  "timestamp": "2025-10-21T12:00:00.000Z"
}`,
        params: [
          { name: "target", type: "string", required: true, description: "'views', 'kpis' ou vazio para ambos" }
        ]
      }
    }
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const renderEndpointCard = (endpoint: any, index: number) => {
    const Icon = endpoint.icon;
    return (
      <Card key={index}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  {endpoint.name}
                  <Badge variant="outline">{endpoint.method}</Badge>
                  {endpoint.requiresAuth && (
                    <Badge variant="secondary" className="text-xs">
                      Requer Auth
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  {endpoint.description}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Endpoint</h4>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
              <Badge className="shrink-0">{endpoint.method}</Badge>
              <span className="flex-1 break-all">{endpoint.path}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(`${apiBaseUrl}${endpoint.path}`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {endpoint.exemplo.params && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Parâmetros</h4>
              <div className="space-y-2">
                {endpoint.exemplo.params.map((param: any, i: number) => (
                  <div key={i} className="flex gap-2 text-sm p-2 bg-muted/50 rounded">
                    <code className="font-semibold text-primary">{param.name}</code>
                    <Badge variant="outline" className="text-xs">{param.type}</Badge>
                    {param.required && (
                      <Badge variant="destructive" className="text-xs">obrigatório</Badge>
                    )}
                    <span className="text-muted-foreground">- {param.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center justify-between">
              Exemplo de Requisição (cURL)
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(endpoint.exemplo.curl)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </h4>
            <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs">
              <code>{endpoint.exemplo.curl}</code>
            </pre>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center justify-between">
              Exemplo de Resposta
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(endpoint.exemplo.response)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </h4>
            <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs">
              <code>{endpoint.exemplo.response}</code>
            </pre>
          </div>

          {!endpoint.requiresAuth && (
            <Button
              variant="outline"
              className="w-full"
              asChild
            >
              <a
                href={`${apiBaseUrl}${endpoint.path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Testar API no Navegador
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Documentação de APIs</h3>
        <p className="text-sm text-muted-foreground">
          Endpoints disponíveis para integração com sistemas externos e ferramentas de BI
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            URL Base da API
          </CardTitle>
          <CardDescription>
            Todas as requisições devem usar esta URL como base
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm break-all">
            <span className="flex-1">{apiBaseUrl}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(apiBaseUrl)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="crm" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="crm">APIs CRM</TabsTrigger>
          <TabsTrigger value="datawarehouse">Data Warehouse ETL</TabsTrigger>
        </TabsList>

        <TabsContent value="crm" className="space-y-6 mt-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Nota:</strong> Estas APIs são públicas e não requerem autenticação. 
              Use-as para integrar os dados do CRM com outros sistemas e ferramentas de análise.
            </AlertDescription>
          </Alert>

          {crmEndpoints.map((endpoint, index) => renderEndpointCard(endpoint, index))}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Dica:</strong> Estas APIs podem ser consumidas por qualquer linguagem de programação 
              (Python, PHP, Java, etc.) ou ferramenta de integração (Zapier, Make, n8n). 
              Use os exemplos de requisição como base para sua implementação.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="datawarehouse" className="space-y-6 mt-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Autenticação:</strong> Todas as APIs do Data Warehouse requerem autenticação via token JWT. 
              Inclua o header <code className="text-xs bg-muted px-1 rounded">Authorization: Bearer YOUR_TOKEN</code> em todas as requisições.
            </AlertDescription>
          </Alert>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Arquitetura ETL Profissional</CardTitle>
              <CardDescription>
                Sistema completo de Data Warehouse com Star Schema, CDC e agregações pré-calculadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-background rounded-lg border">
                  <h4 className="font-semibold text-sm mb-2">📊 Dimensões</h4>
                  <p className="text-xs text-muted-foreground">
                    Tabelas de referência: municípios, prospects, lojas, usuários, concorrentes, campanhas
                  </p>
                </div>
                <div className="p-3 bg-background rounded-lg border">
                  <h4 className="font-semibold text-sm mb-2">📈 Fatos</h4>
                  <p className="text-xs text-muted-foreground">
                    Eventos transacionais: atividades, visitas, auditorias, vendas, investimentos, KPIs
                  </p>
                </div>
                <div className="p-3 bg-background rounded-lg border">
                  <h4 className="font-semibold text-sm mb-2">⚡ Agregações</h4>
                  <p className="text-xs text-muted-foreground">
                    Views materializadas e KPIs pré-calculados para consultas rápidas de BI
                  </p>
                </div>
              </div>

              <div className="p-3 bg-background rounded-lg border">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  CDC - Change Data Capture
                </h4>
                <p className="text-xs text-muted-foreground">
                  Histórico completo de mudanças (INSERT/UPDATE/DELETE) em todas as tabelas de fatos principais, 
                  permitindo auditoria e sincronização incremental com sistemas externos.
                </p>
              </div>

              <div className="p-3 bg-background rounded-lg border">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Atualização de Dados
                </h4>
                <p className="text-xs text-muted-foreground">
                  Views materializadas e KPIs podem ser atualizados manualmente via API ou automaticamente 
                  em jobs agendados para manter os dados sempre atualizados.
                </p>
              </div>
            </CardContent>
          </Card>

          {dwEndpoints.map((endpoint, index) => renderEndpointCard(endpoint, index))}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Integração com BI:</strong> Estas APIs são perfeitas para integração com ferramentas como 
              Power BI, Tableau, Metabase, Looker, etc. Use os endpoints de agregações para dashboards de alta 
              performance ou consulte os fatos diretamente para análises customizadas.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
};
