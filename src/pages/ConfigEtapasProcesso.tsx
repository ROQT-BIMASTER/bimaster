import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, GripVertical, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEtapasConfig, type EtapaConfig } from "@/hooks/useEtapasConfig";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TIPOS = [
  { key: "china", label: "China" },
  { key: "brasil", label: "Brasil" },
  { key: "fabrica", label: "Fábrica" },
] as const;

export default function ConfigEtapasProcesso() {
  const navigate = useNavigate();
  const { allEtapas, etapasForTipo, isLoading, reorderEtapas } = useEtapasConfig();
  const [activeTab, setActiveTab] = useState("china");
  const [localOrder, setLocalOrder] = useState<Record<string, EtapaConfig[]>>({});
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const getEtapas = useCallback((tipo: string) => {
    return localOrder[tipo] || etapasForTipo(tipo);
  }, [localOrder, etapasForTipo]);

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;

    const etapas = [...getEtapas(activeTab)];
    const [moved] = etapas.splice(draggedIdx, 1);
    etapas.splice(idx, 0, moved);
    
    setLocalOrder(prev => ({ ...prev, [activeTab]: etapas }));
    setDraggedIdx(idx);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const hasChanges = (tipo: string) => {
    const local = localOrder[tipo];
    if (!local) return false;
    const original = etapasForTipo(tipo);
    return local.some((e, i) => e.etapa_key !== original[i]?.etapa_key);
  };

  const handleSave = async (tipo: string) => {
    const etapas = getEtapas(tipo);
    try {
      await reorderEtapas.mutateAsync({
        produtoTipo: tipo,
        orderedKeys: etapas.map(e => e.etapa_key),
      });
      setLocalOrder(prev => {
        const next = { ...prev };
        delete next[tipo];
        return next;
      });
      toast.success(`Ordem das etapas de ${tipo} salva com sucesso!`);
    } catch {
      toast.error("Erro ao salvar a ordem das etapas.");
    }
  };

  const handleReset = (tipo: string) => {
    setLocalOrder(prev => {
      const next = { ...prev };
      delete next[tipo];
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Configurar Etapas do Processo
            </h1>
            <p className="text-sm text-muted-foreground">
              Arraste para reordenar as etapas do ciclo de vida por tipo de produto
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            {TIPOS.map(t => (
              <TabsTrigger key={t.key} value={t.key} className="relative">
                {t.label}
                {hasChanges(t.key) && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {TIPOS.map(tipo => (
            <TabsContent key={tipo.key} value={tipo.key}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Etapas — {tipo.label}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {getEtapas(tipo.key).length} etapas
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                  ) : (
                    <>
                      {getEtapas(tipo.key).map((etapa, idx) => (
                        <div
                          key={etapa.etapa_key}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-background cursor-grab active:cursor-grabbing transition-all",
                            draggedIdx === idx && "opacity-50 scale-[0.98]",
                            "hover:bg-muted/50"
                          )}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Badge variant="outline" className="text-[10px] w-6 justify-center shrink-0">
                            {idx + 1}
                          </Badge>
                          <span className="text-sm font-medium text-foreground flex-1">
                            {etapa.etapa_label}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {etapa.etapa_key}
                          </span>
                        </div>
                      ))}

                      {hasChanges(tipo.key) && (
                        <div className="flex justify-end gap-2 pt-3 border-t mt-3">
                          <Button variant="outline" size="sm" onClick={() => handleReset(tipo.key)}>
                            Desfazer
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSave(tipo.key)}
                            disabled={reorderEtapas.isPending}
                          >
                            {reorderEtapas.isPending ? "Salvando..." : "Salvar Ordem"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
