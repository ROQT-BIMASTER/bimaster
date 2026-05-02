import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Settings2, Sparkles } from "lucide-react";
import { ComoCriarLoteDialog } from "./ComoCriarLoteDialog";

const COLUNAS_DEMO = [
  {
    nome: "Revisão Técnica",
    cards: [
      { titulo: "Artes — Hidratante 200ml", etapa: "Em revisão", prazo: "2 dias" },
      { titulo: "Briefing — Linha Verão", etapa: "Em revisão", prazo: "1 dia" },
    ],
  },
  {
    nome: "Aprovação Gerencial",
    cards: [{ titulo: "Embalagem — Shampoo Kids", etapa: "Aguardando gerente", prazo: "3 dias" }],
  },
  {
    nome: "Validação Regulatória",
    cards: [{ titulo: "Rótulo — Protetor FPS50", etapa: "Validando ANVISA", prazo: "2 dias" }],
  },
  {
    nome: "Aprovação Final",
    cards: [{ titulo: "Lançamento — Kit Premium", etapa: "Decisão final", prazo: "1 dia" }],
  },
];

export function AprovacoesEmptyState() {
  const navigate = useNavigate();
  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-card border-primary/20">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Bem-vindo ao Kanban de Aprovações</h3>
              <Badge variant="secondary" className="text-[10px]">Sem lotes ainda</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Aqui você acompanha aprovações de artes, embalagens, briefings e qualquer item que
              precise passar por etapas de revisão. Cada coluna representa uma etapa do fluxo, e os
              cards avançam conforme os responsáveis aprovam.
            </p>
            <p className="text-sm text-muted-foreground">
              Já preparamos um <strong className="text-foreground">fluxo padrão</strong> para você
              começar — basta abrir uma tarefa e criar um lote.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={() => setShowTutorial(true)}>
                <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                Como criar um lote?
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/admin/templates-alcadas")}>
                <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                Ver fluxos de aprovação
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-1">
          Exemplo: como o Kanban funciona
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2 opacity-80">
          {COLUNAS_DEMO.map((col) => (
            <div
              key={col.nome}
              className="min-w-[260px] w-[260px] shrink-0 bg-muted/30 rounded-lg p-2 space-y-2 border border-dashed border-border"
            >
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold">{col.nome}</p>
                <Badge variant="outline" className="text-[10px] h-4">
                  {col.cards.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {col.cards.map((c, i) => (
                  <Card key={i} className="p-2.5 bg-card hover:shadow-none">
                    <p className="text-xs font-medium truncate">{c.titulo}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground">{c.etapa}</span>
                      <Badge variant="secondary" className="text-[10px] h-4">
                        {c.prazo}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 px-1 italic">
          Visualização ilustrativa. Seus lotes reais aparecerão aqui assim que forem criados.
        </p>
      </div>

      <ComoCriarLoteDialog open={showTutorial} onOpenChange={setShowTutorial} />
    </div>
  );
}
