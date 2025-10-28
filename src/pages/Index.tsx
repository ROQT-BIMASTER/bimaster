import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Users, 
  MapPin, 
  TrendingUp, 
  Shield,
  Target,
  Clock,
  CheckCircle2,
  BookOpen,
  FileText,
  Video
} from "lucide-react";

const Index = () => {
  const sections = [
    {
      icon: BarChart3,
      title: "Dashboard e Métricas",
      description: "Aprenda a visualizar e interpretar os indicadores de desempenho da sua equipe",
      topics: ["KPIs principais", "Funil de prospecção", "Análise de conversão"]
    },
    {
      icon: Users,
      title: "Gestão de Prospects",
      description: "Domine o fluxo completo de gerenciamento de clientes potenciais",
      topics: ["Cadastro de prospects", "Pipeline Kanban", "Distribuição por território"]
    },
    {
      icon: MapPin,
      title: "Mapeamento Territorial",
      description: "Utilize o mapa para otimizar rotas e visualizar distribuição geográfica",
      topics: ["Atribuição de municípios", "Filtros geográficos", "Visualização de clientes"]
    },
    {
      icon: TrendingUp,
      title: "Relatórios e Análises",
      description: "Gere relatórios detalhados e tome decisões baseadas em dados",
      topics: ["Relatório de desempenho", "Análise financeira", "Exportação de dados"]
    },
    {
      icon: Shield,
      title: "Configurações e Segurança",
      description: "Configure permissões e personalize o sistema conforme sua necessidade",
      topics: ["Gerenciamento de usuários", "Controle de acesso", "Perfis e permissões"]
    },
    {
      icon: Target,
      title: "Trade Marketing",
      description: "Gerencie visitas, lojas e campanhas de trade marketing",
      topics: ["Registro de visitas", "Fotos de gôndola", "Análise competitiva"]
    }
  ];

  const resources = [
    {
      icon: BookOpen,
      title: "Guias Passo a Passo",
      description: "Tutoriais detalhados para cada funcionalidade do sistema"
    },
    {
      icon: FileText,
      title: "Documentação Completa",
      description: "Referência técnica e melhores práticas de uso"
    },
    {
      icon: Video,
      title: "Vídeos de Treinamento",
      description: "Aprenda visualmente com demonstrações práticas"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Union CRM - Manual de Treinamento</span>
          </div>
          <Button onClick={() => window.location.href = '/auth/login'}>
            Acessar Sistema
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-16 space-y-6">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <Badge variant="outline" className="mb-4">
            Plataforma de Treinamento
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Manual de Uso do
            <span className="text-primary block mt-2">Union CRM</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Aprenda a utilizar todas as funcionalidades do sistema de gestão de vendas e trade marketing
          </p>
        </div>
      </section>

      {/* Main Sections */}
      <section className="container py-16">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">Módulos de Treinamento</Badge>
          <h2 className="text-3xl font-bold mb-4">Conteúdo do Treinamento</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Explore cada módulo para dominar o sistema completamente
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
              <section.icon className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{section.title}</h3>
              <p className="text-muted-foreground mb-4">{section.description}</p>
              <div className="space-y-2">
                {section.topics.map((topic, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>{topic}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Resources */}
      <section className="bg-muted/50 py-16">
        <div className="container">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Recursos de Aprendizado</Badge>
            <h2 className="text-3xl font-bold mb-4">Material de Apoio</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {resources.map((resource, index) => (
              <Card key={index} className="p-6 text-center">
                <resource.icon className="h-10 w-10 text-primary mb-3 mx-auto" />
                <h3 className="text-lg font-semibold mb-2">{resource.title}</h3>
                <p className="text-sm text-muted-foreground">{resource.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="container py-16">
        <Card className="p-12 text-center bg-gradient-to-br from-primary/10 to-primary/5">
          <Clock className="h-12 w-12 text-primary mb-4 mx-auto" />
          <h2 className="text-3xl font-bold mb-4">
            Ambiente de Treinamento
          </h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Este é um ambiente exclusivo para treinamento e capacitação da equipe.
            Explore todas as funcionalidades sem restrições.
          </p>
          <Badge variant="secondary" className="text-base px-4 py-2">
            Sistema em Modo Treinamento
          </Badge>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2024 Union CRM - Plataforma de Treinamento</p>
          <p className="mt-2">Material destinado exclusivamente para fins educacionais</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
