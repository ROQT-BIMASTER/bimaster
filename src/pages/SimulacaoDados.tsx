import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  FlaskConical,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Package,
  ClipboardList,
  TestTube,
  Palette,
  Tag,
  PenTool,
  ShieldCheck,
  FolderKanban,
  FileSpreadsheet,
  Truck,
  Rocket,
  Lightbulb,
  ArrowRight,
} from "lucide-react";

const STAGES = [
  { icon: Lightbulb, label: "1. Ideia / Briefing", desc: "Definição do conceito, benchmark e briefing inicial do produto.", color: "text-amber-500" },
  { icon: FolderKanban, label: "2. Projeto / Planejamento", desc: "Montagem de equipe, cronograma e milestones.", color: "text-blue-500" },
  { icon: FileSpreadsheet, label: "3. Pré-Cadastro", desc: "Criação de SKUs preliminares e códigos internos.", color: "text-violet-500" },
  { icon: Package, label: "4. Desenvolvimento (China)", desc: "Envio de briefing à fábrica, cotação, negociação de MOQ e PI.", color: "text-red-500" },
  { icon: ClipboardList, label: "5. Composição / INCI", desc: "Lista de ingredientes INCI, validação ANVISA, percentuais por cor.", color: "text-emerald-500" },
  { icon: TestTube, label: "6. Amostras / Testes", desc: "Solicitação e avaliação de amostras físicas (cor, textura, rótulo).", color: "text-cyan-500" },
  { icon: Palette, label: "7. Embalagem", desc: "Definição de materiais, acabamento, Pantone e cores de referência.", color: "text-pink-500" },
  { icon: ShieldCheck, label: "8. Regulatório", desc: "Submissão ANVISA, verificação de textos legais e advertências.", color: "text-orange-500" },
  { icon: Tag, label: "9. Etiqueta / Bula", desc: "Criação de layout de etiqueta com checklist regulatório.", color: "text-teal-500" },
  { icon: PenTool, label: "10. Artes Finais", desc: "Motor de aprovação de artes com fluxo multi-etapas.", color: "text-indigo-500" },
  { icon: CheckCircle2, label: "11. Aprovação Final", desc: "Gate de diretoria antes da emissão de Ordem de Compra.", color: "text-green-600" },
  { icon: Truck, label: "12. Produção / Lançamento", desc: "Emissão de OC, acompanhamento de produção e embarque.", color: "text-slate-600" },
];

const MODULE_LINKS = [
  { label: "Projetos", href: "/dashboard/projetos", desc: "Veja o projeto criado com seções e tarefas" },
  { label: "Composição INCI", href: "/dashboard/composicao", desc: "Ingredientes com status ANVISA" },
  { label: "Amostras", href: "/dashboard/amostras", desc: "Rodadas de avaliação de amostras" },
  { label: "Análise de Embalagem", href: "/dashboard/analise-embalagem", desc: "Cores Pantone e acabamentos" },
  { label: "Etiqueta / Bula", href: "/dashboard/etiqueta-bula", desc: "Checklist regulatório de etiquetas" },
  { label: "Motor de Artes", href: "/dashboard/fluxo-artes", desc: "Fluxo de aprovação de artes" },
  { label: "Aprovação de Artes", href: "/dashboard/aprovacao-artes", desc: "Instâncias de aprovação configuradas" },
];

export default function SimulacaoDados() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<any>(null);
  const navigate = useNavigate();

  const handleSeed = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-demo-data");
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      setResult(data.data);
      setDone(true);
      toast.success("Dados de simulação criados com sucesso!");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao criar dados"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="p-2.5 rounded-xl bg-primary/10">
            <FlaskConical className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Simulação do Ciclo de Vida</h1>
            <p className="text-muted-foreground text-sm">
              Gere dados fictícios para entender todo o fluxo de desenvolvimento de produto
            </p>
          </div>
        </div>

        {/* 12 Stages Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Os 12 Estágios do Ciclo de Vida</CardTitle>
            <CardDescription>
              Cada produto passa por estas etapas — da concepção ao lançamento. A simulação cria dados reais em cada uma delas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {STAGES.map((stage, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <stage.icon className={`h-5 w-5 mt-0.5 shrink-0 ${stage.color}`} />
                  <div>
                    <p className="text-sm font-medium">{stage.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{stage.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* What will be created */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">O que será criado?</CardTitle>
            <CardDescription>
              Um clique gera um cenário completo e realista
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {[
                "📂 1 Projeto com 12 seções e ~21 tarefas",
                "🧴 3 Produtos (submissões China)",
                "🧪 7 ingredientes INCI com status ANVISA",
                "📦 2 Amostras (1 reprovada, 1 aguardando envio)",
                "🎨 2 Análises de embalagem com cores Pantone",
                "🏷️ 2 Etiquetas com checklist regulatório",
                "✏️ 2 Fluxos de artes (motor genérico)",
                "✅ 1 Fluxo de aprovação com 4 etapas",
                "📋 1 Ordem de compra pendente",
                "🎨 5 Variantes de cor dos produtos",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action */}
        <Card className={done ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "border-dashed"}>
          <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
            {!done ? (
              <>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Ao clicar no botão abaixo, dados fictícios serão inseridos no banco de dados. 
                  Você poderá navegar normalmente pelos módulos e ver como o sistema funciona com dados reais.
                </p>
                <Button size="lg" onClick={handleSeed} disabled={loading} className="gap-2">
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Rocket className="h-5 w-5" />
                  )}
                  {loading ? "Criando dados..." : "Gerar Dados de Simulação"}
                </Button>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-10 w-10 text-primary" />
                <div className="text-center">
                  <p className="font-semibold text-primary">Dados criados com sucesso!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Projeto com {result?.secoes} seções, {result?.tarefas} tarefas e {result?.submissoes} produtos.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation Links */}
        {done && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Explore os Módulos</CardTitle>
              <CardDescription>Clique em qualquer módulo para ver os dados de simulação</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MODULE_LINKS.map((link) => (
                  <Button
                    key={link.href}
                    variant="outline"
                    className="h-auto py-3 px-4 justify-start text-left"
                    onClick={() => navigate(link.href)}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{link.label}</p>
                      <p className="text-xs text-muted-foreground">{link.desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
