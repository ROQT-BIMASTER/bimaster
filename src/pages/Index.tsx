import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  BarChart3, 
  Users, 
  MapPin, 
  Phone,
  Calendar,
  TrendingUp,
  Shield,
  Zap,
  Target,
  MessageSquare,
  CheckCircle2
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: "Gestão de Prospects",
      description: "Organize e gerencie seus prospects com facilidade usando quadros Kanban intuitivos"
    },
    {
      icon: Phone,
      title: "Chamadas com IA",
      description: "Realize ligações automatizadas com inteligência artificial para qualificar leads"
    },
    {
      icon: MapPin,
      title: "Geolocalização",
      description: "Visualize prospects no mapa e distribua por território e município"
    },
    {
      icon: BarChart3,
      title: "Relatórios Completos",
      description: "Análises detalhadas de desempenho, conversão e métricas da equipe"
    },
    {
      icon: Calendar,
      title: "Gestão de Atividades",
      description: "Controle tarefas, visitas, reuniões e follow-ups em um só lugar"
    },
    {
      icon: MessageSquare,
      title: "Chat Integrado",
      description: "Comunicação em tempo real com a equipe e insights de IA"
    }
  ];

  const benefits = [
    "Aumente a produtividade da equipe em até 40%",
    "Reduza o tempo de qualificação de leads",
    "Melhore a taxa de conversão com dados precisos",
    "Automatize processos repetitivos"
  ];

  const stats = [
    { value: "10k+", label: "Prospects Gerenciados" },
    { value: "500+", label: "Usuários Ativos" },
    { value: "98%", label: "Taxa de Satisfação" },
    { value: "24/7", label: "Suporte Disponível" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Target className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">CRM Sistema</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Funcionalidades
            </a>
            <a href="#benefits" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Benefícios
            </a>
            <Button 
              variant="ghost"
              onClick={() => navigate("/auth/login")}
            >
              Login
            </Button>
            <Button 
              onClick={() => navigate("/auth/signup")}
            >
              Começar Agora
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <Badge variant="outline" className="text-sm py-1 px-4">
              <Zap className="h-3 w-3 mr-1 inline" />
              Plataforma Completa de CRM
            </Badge>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              Gestão Inteligente de
              <span className="block mt-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Prospects e Vendas
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Sistema completo para gerenciar prospects, automatizar processos e 
              impulsionar os resultados da sua equipe comercial
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth/signup")}
                className="group text-lg px-8"
              >
                Começar Gratuitamente
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/auth/login")}
                className="text-lg px-8"
              >
                Fazer Login
              </Button>
            </div>
            
            <div className="pt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Sem cartão de crédito
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Configuração em 5 minutos
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Suporte em português
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center space-y-2">
                <div className="text-3xl md:text-4xl font-bold text-primary">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <Badge variant="outline" className="text-sm py-1 px-4">
              Funcionalidades
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold">
              Tudo que você precisa para vender mais
            </h2>
            <p className="text-lg text-muted-foreground">
              Ferramentas poderosas para gerenciar todo o ciclo de vendas da sua empresa
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50">
                <CardContent className="p-6 space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 md:py-32 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="outline" className="text-sm py-1 px-4">
                <TrendingUp className="h-3 w-3 mr-1 inline" />
                Resultados Comprovados
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold">
                Impulsione seus resultados comerciais
              </h2>
              <p className="text-lg text-muted-foreground">
                Junte-se a centenas de empresas que transformaram suas vendas com nossa plataforma
              </p>
              
              <div className="space-y-4 pt-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-lg">{benefit}</p>
                  </div>
                ))}
              </div>
              
              <Button 
                size="lg" 
                onClick={() => navigate("/auth/signup")}
                className="group mt-6"
              >
                Começar Agora
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl blur-3xl" />
              <Card className="relative">
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Segurança e Privacidade</span>
                    </div>
                    <p className="text-muted-foreground">
                      Seus dados protegidos com criptografia de ponta e conformidade com LGPD
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Zap className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Inteligência Artificial</span>
                    </div>
                    <p className="text-muted-foreground">
                      IA integrada para insights automáticos e otimização de processos
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Colaboração em Equipe</span>
                    </div>
                    <p className="text-muted-foreground">
                      Trabalhe em conjunto com permissões personalizadas e comunicação integrada
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-accent/90" />
            <CardContent className="relative p-12 md:p-16 text-center space-y-6">
              <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground">
                Pronto para transformar suas vendas?
              </h2>
              <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto">
                Comece gratuitamente hoje e veja como é fácil gerenciar prospects e fechar mais negócios
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={() => navigate("/auth/signup")}
                  className="group text-lg px-8"
                >
                  Criar Conta Grátis
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate("/auth/login")}
                  className="text-lg px-8 bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  Já tenho conta
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl">CRM Sistema</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Gestão inteligente de prospects e vendas para equipes de alta performance
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
                <li><a href="#benefits" className="hover:text-foreground transition-colors">Benefícios</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Atualizações</a></li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Sobre</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Carreiras</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contato</a></li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacidade</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Termos</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">LGPD</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Cookies</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-12 pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} CRM Sistema. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
