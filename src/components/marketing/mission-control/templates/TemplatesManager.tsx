import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileText, Plus, Search, Copy, Pencil, Trash2,
  Clock, Zap, CheckSquare, MoreVertical
} from "lucide-react";

const FileTemplate = FileText;
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NewTemplateDialog } from "./NewTemplateDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Template {
  id: string;
  nome: string;
  tipo: string;
  descricao: string | null;
  configuracao: Record<string, unknown> | null;
  etapas_workflow: string[] | null;
  checklist_padrao: Record<string, unknown>[] | null;
  sla_dias: number | null;
  pontos_base: number | null;
  created_at: string;
}

const tipoLabels: Record<string, string> = {
  post_instagram: 'Post Instagram',
  post_tiktok: 'Post TikTok',
  catalogo: 'Catálogo',
  video: 'Vídeo',
  email: 'Email Marketing',
  banner: 'Banner',
  arte: 'Arte Gráfica',
  campanha: 'Campanha Completa',
};

const tipoColors: Record<string, string> = {
  post_instagram: 'bg-pink-500',
  post_tiktok: 'bg-black',
  catalogo: 'bg-blue-500',
  video: 'bg-purple-500',
  email: 'bg-green-500',
  banner: 'bg-amber-500',
  arte: 'bg-cyan-500',
  campanha: 'bg-primary',
};

export function TemplatesManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['marketing-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_templates')
        .select('*')
        .order('nome');

      if (error) throw error;
      return data as Template[];
    }
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-templates'] });
      toast.success('Template excluído');
      setTemplateToDelete(null);
    },
    onError: () => {
      toast.error('Erro ao excluir template');
    }
  });

  const duplicateTemplate = useMutation({
    mutationFn: async (template: Template) => {
      const newTemplate = {
        nome: `${template.nome} (Cópia)`,
        tipo: template.tipo,
        descricao: template.descricao,
        configuracao: template.configuracao,
        etapas_workflow: template.etapas_workflow,
        checklist_padrao: template.checklist_padrao,
        sla_dias: template.sla_dias,
        pontos_base: template.pontos_base,
      };
      const { error } = await supabase
        .from('marketing_templates')
        .insert(newTemplate as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-templates'] });
      toast.success('Template duplicado');
    }
  });

  const filteredTemplates = templates?.filter(t =>
    t.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.descricao?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const tipo = template.tipo;
    if (!acc[tipo]) acc[tipo] = [];
    acc[tipo].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setIsNewDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{templates?.length || 0}</p>
              </div>
              <FileTemplate className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tipos</p>
                <p className="text-2xl font-bold">{Object.keys(groupedTemplates).length}</p>
              </div>
              <CheckSquare className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">SLA Médio</p>
                <p className="text-2xl font-bold">
                  {templates?.length ? 
                    (templates.reduce((sum, t) => sum + (t.sla_dias || 0), 0) / templates.length).toFixed(0) : 0}d
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pontos Médios</p>
                <p className="text-2xl font-bold">
                  {templates?.length ? 
                    (templates.reduce((sum, t) => sum + (t.pontos_base || 0), 0) / templates.length).toFixed(0) : 0}
                </p>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-muted/50" />
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileTemplate className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum template encontrado</p>
            <Button className="mt-4" onClick={() => setIsNewDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTemplates).map(([tipo, typeTemplates]) => (
            <div key={tipo} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className={cn(tipoColors[tipo] || 'bg-gray-500')}>
                  {tipoLabels[tipo] || tipo}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {typeTemplates.length} template{typeTemplates.length > 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {typeTemplates.map(template => (
                  <Card key={template.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{template.nome}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {template.descricao || 'Sem descrição'}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => duplicateTemplate.mutate(template)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => setTemplateToDelete(template)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {template.sla_dias || 0} dias
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {template.pontos_base || 0} pts
                        </div>
                        {template.checklist_padrao && (
                          <div className="flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" />
                            {template.checklist_padrao.length} itens
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewTemplateDialog 
        open={isNewDialogOpen} 
        onOpenChange={setIsNewDialogOpen}
      />

      <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o template "{templateToDelete?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground"
              onClick={() => templateToDelete && deleteTemplate.mutate(templateToDelete.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
