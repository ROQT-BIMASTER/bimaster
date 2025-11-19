import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, GripVertical, Save, RotateCcw } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";

interface Module {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  ordem: number;
  ativo: boolean;
}

interface SortableModuleItemProps {
  module: Module;
}

function SortableModuleItem({ module }: SortableModuleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 bg-background border rounded-lg hover:bg-accent/50 transition-colors"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{module.nome}</span>
          <Badge variant="outline" className="text-xs">
            {module.codigo}
          </Badge>
        </div>
        {module.descricao && (
          <p className="text-sm text-muted-foreground mt-1">
            {module.descricao}
          </p>
        )}
      </div>

      <Badge variant="secondary" className="ml-auto">
        Ordem: {module.ordem}
      </Badge>
    </div>
  );
}

export function GerenciadorOrdemModulos() {
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalModules, setOriginalModules] = useState<Module[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("modulos_sistema")
        .select("*")
        .eq("ativo", true)
        .order("ordem");

      if (error) throw error;

      setModules(data || []);
      setOriginalModules(data || []);
      setHasChanges(false);
    } catch (error) {
      console.error("Erro ao carregar módulos:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar módulos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setModules((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      
      // Atualizar a ordem de cada item
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        ordem: index + 1,
      }));

      setHasChanges(true);
      return updatedItems;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Atualizar a ordem de cada módulo no banco
      const updates = modules.map((module, index) =>
        supabase
          .from("modulos_sistema")
          .update({ ordem: index + 1 })
          .eq("id", module.id)
      );

      await Promise.all(updates);

      toast({
        title: "Sucesso",
        description: "Ordem dos módulos atualizada com sucesso",
      });

      setOriginalModules(modules);
      setHasChanges(false);
      
      // Forçar recarga do menu
      window.dispatchEvent(new Event("modules-updated"));
    } catch (error) {
      console.error("Erro ao salvar ordem:", error);
      toast({
        title: "Erro",
        description: "Falha ao salvar a ordem dos módulos",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setModules(originalModules);
    setHasChanges(false);
    toast({
      title: "Restaurado",
      description: "Ordem dos módulos foi restaurada",
    });
  };

  if (roleLoading || loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ordem dos Módulos</CardTitle>
          <CardDescription>
            Apenas administradores podem gerenciar a ordem dos módulos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar esta funcionalidade.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Ordem dos Módulos do Menu</CardTitle>
            <CardDescription>
              Arraste e solte para reorganizar os módulos do menu principal
            </CardDescription>
          </div>
          
          {hasChanges && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={saving}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Ordem
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={modules.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {modules.map((module) => (
                <SortableModuleItem key={module.id} module={module} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {modules.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum módulo ativo encontrado
          </p>
        )}
      </CardContent>
    </Card>
  );
}
