import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RoteiroStep {
  id: string;
  sequencia: number;
  descricao: string;
  maquina_sugerida_id?: string;
  tempo_estimado_minutos?: number;
  temperatura_ideal?: number;
  pressao_ideal?: number;
  velocidade_ideal?: number;
  instrucoes?: string;
  pontos_criticos?: string;
}

interface RoteiroProducaoEditorProps {
  formulaId: string;
  maquinas: any[];
  onSave: (steps: RoteiroStep[]) => void;
  initialSteps?: RoteiroStep[];
}

export function RoteiroProducaoEditor({
  formulaId,
  maquinas,
  onSave,
  initialSteps = [],
}: RoteiroProducaoEditorProps) {
  const [steps, setSteps] = useState<RoteiroStep[]>(
    initialSteps.length > 0
      ? initialSteps
      : [
          {
            id: crypto.randomUUID(),
            sequencia: 1,
            descricao: "",
            tempo_estimado_minutos: 0,
          },
        ]
  );

  const adicionarPasso = () => {
    setSteps([
      ...steps,
      {
        id: crypto.randomUUID(),
        sequencia: steps.length + 1,
        descricao: "",
        tempo_estimado_minutos: 0,
      },
    ]);
  };

  const removerPasso = (index: number) => {
    const novosSteps = steps.filter((_, i) => i !== index);
    // Reordenar sequências
    setSteps(novosSteps.map((step, i) => ({ ...step, sequencia: i + 1 })));
  };

  const atualizarPasso = (index: number, campo: keyof RoteiroStep, valor: any) => {
    const novosSteps = [...steps];
    novosSteps[index] = { ...novosSteps[index], [campo]: valor };
    setSteps(novosSteps);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Roteiro de Produção</CardTitle>
            <CardDescription>
              Defina o passo a passo do processo produtivo
            </CardDescription>
          </div>
          <Button onClick={adicionarPasso} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Passo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step, index) => (
          <Card key={step.id} className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">Passo {step.sequencia}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removerPasso(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição do Passo *</Label>
                <Textarea
                  value={step.descricao}
                  onChange={(e) =>
                    atualizarPasso(index, "descricao", e.target.value)
                  }
                  placeholder="Ex: Misturar ingredientes secos..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Máquina Sugerida</Label>
                  <Select
                    value={step.maquina_sugerida_id || ""}
                    onValueChange={(value) =>
                      atualizarPasso(index, "maquina_sugerida_id", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {maquinas?.map((maq) => (
                        <SelectItem key={maq.id} value={maq.id}>
                          {maq.codigo} - {maq.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tempo Estimado (min)</Label>
                  <Input
                    type="number"
                    value={step.tempo_estimado_minutos || ""}
                    onChange={(e) =>
                      atualizarPasso(
                        index,
                        "tempo_estimado_minutos",
                        parseInt(e.target.value) || 0
                      )
                    }
                    placeholder="Ex: 15"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Temperatura (°C)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={step.temperatura_ideal || ""}
                    onChange={(e) =>
                      atualizarPasso(
                        index,
                        "temperatura_ideal",
                        parseFloat(e.target.value) || undefined
                      )
                    }
                    placeholder="Ex: 180"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Pressão (bar)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={step.pressao_ideal || ""}
                    onChange={(e) =>
                      atualizarPasso(
                        index,
                        "pressao_ideal",
                        parseFloat(e.target.value) || undefined
                      )
                    }
                    placeholder="Ex: 2.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Velocidade</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={step.velocidade_ideal || ""}
                    onChange={(e) =>
                      atualizarPasso(
                        index,
                        "velocidade_ideal",
                        parseFloat(e.target.value) || undefined
                      )
                    }
                    placeholder="RPM ou m/min"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Instruções Detalhadas</Label>
                <Textarea
                  value={step.instrucoes || ""}
                  onChange={(e) =>
                    atualizarPasso(index, "instrucoes", e.target.value)
                  }
                  placeholder="Instruções detalhadas para execução..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Pontos Críticos ⚠️</Label>
                <Textarea
                  value={step.pontos_criticos || ""}
                  onChange={(e) =>
                    atualizarPasso(index, "pontos_criticos", e.target.value)
                  }
                  placeholder="Aspectos críticos para atenção do operador..."
                  rows={2}
                  className="border-orange-300 focus:border-orange-500"
                />
              </div>
            </CardContent>
          </Card>
        ))}

        {steps.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum passo definido. Clique em "Adicionar Passo" para começar.
          </div>
        )}

        <Button onClick={() => onSave(steps)} className="w-full">
          Salvar Roteiro de Produção
        </Button>
      </CardContent>
    </Card>
  );
}
