import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Code, Copy, Database, TrendingUp, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";

export const DocumentacaoAPI = () => {
  const apiBaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const endpoints = [
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Documentação de APIs</h3>
        <p className="text-sm text-muted-foreground">
          Endpoints disponíveis para integração com sistemas externos
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Nota:</strong> Estas APIs são públicas e não requerem autenticação. 
          Use-as para integrar os dados do CRM com outros sistemas e ferramentas de análise.
        </AlertDescription>
      </Alert>

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
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
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

      {endpoints.map((endpoint, index) => {
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
                    <CardTitle className="flex items-center gap-2">
                      {endpoint.name}
                      <Badge variant="outline">{endpoint.method}</Badge>
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
                  <span className="flex-1">{endpoint.path}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(`${apiBaseUrl}${endpoint.path}`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

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
            </CardContent>
          </Card>
        );
      })}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Dica:</strong> Estas APIs podem ser consumidas por qualquer linguagem de programação 
          (Python, PHP, Java, etc.) ou ferramenta de integração (Zapier, Make, n8n). 
          Use os exemplos de requisição como base para sua implementação.
        </AlertDescription>
      </Alert>
    </div>
  );
};
