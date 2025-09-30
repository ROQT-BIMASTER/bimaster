import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="text-center space-y-6 px-4">
        <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4">
          CRM Sistema
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-8">
          Gestão Inteligente de Prospects e Vendas
        </p>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
          Sistema completo para gerenciar prospects, distribui-los por município, 
          controlar atividades e acompanhar o desempenho da equipe de vendas.
        </p>
        <div className="flex gap-4 justify-center">
          <Button 
            size="lg" 
            onClick={() => navigate("/auth/login")}
            className="group"
          >
            Fazer Login
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/auth/signup")}
          >
            Criar Conta
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
