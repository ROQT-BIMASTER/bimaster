import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sparkles, FileText, Video, Mail, Image, Instagram, Check } from "lucide-react";

interface TarefaTemplate {
  tipo: string;
  titulo: string;
  descricao: string;
}

interface Template {
  id: string;
  nome: string;
  descricao: string | null;
  tarefas: TarefaTemplate[];
}

interface LaunchTemplateSelectorProps {
  selectedId: string | null;
  onSelect: (template: Template | null) => void;
}

const tarefaIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  post_social: Instagram,
  stories: Instagram,
  reels: Video,
  email_marketing: Mail,
  video: Video,
  catalogo: FileText,
  banner: Image,
};

const templateStyles: Record<string, { bg: string; border: string; icon: string }> = {
  "Template Padrão": {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    icon: "text-blue-500",
  },
  "Template Premium": {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    icon: "text-purple-500",
  },
  "Template Express": {
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    icon: "text-green-500",
  },
};

export default function LaunchTemplateSelector({
  selectedId,
  onSelect,
}: LaunchTemplateSelectorProps) {
  const { data: templates, isLoading } = useQuery({
    queryKey: ["launch-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_templates_lancamento")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        tarefas: (t.tarefas as unknown as TarefaTemplate[]) || []
      })) as Template[];
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 h-32 bg-muted/50" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Selecione um Template de Tarefas</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates?.map((template) => {
          const isSelected = selectedId === template.id;
          const styles = templateStyles[template.nome] || templateStyles["Template Padrão"];

          return (
            <Card
              key={template.id}
              onClick={() => onSelect(isSelected ? null : template)}
              className={cn(
                "cursor-pointer transition-all hover:scale-[1.02]",
                isSelected
                  ? "ring-2 ring-primary shadow-lg"
                  : "hover:shadow-md",
                styles.bg,
                styles.border
              )}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className={cn("h-5 w-5", styles.icon)} />
                    <h4 className="font-semibold text-sm">{template.nome}</h4>
                  </div>
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">{template.descricao}</p>

                <div className="flex flex-wrap gap-1.5">
                  {template.tarefas.map((tarefa) => {
                    const Icon = tarefaIcons[tarefa.tipo] || FileText;
                    return (
                      <Badge
                        key={tarefa.tipo}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0.5 gap-1"
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {tarefa.titulo.split(" ")[0]}
                      </Badge>
                    );
                  })}
                </div>

                <div className="text-xs text-muted-foreground">
                  {template.tarefas.length} tarefa{template.tarefas.length !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
