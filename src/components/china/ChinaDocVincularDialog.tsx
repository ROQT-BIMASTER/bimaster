import { useState, useMemo, useEffect } from "react";
import { Link2, Plus, Search, Loader2, UserCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetosParaVinculo, useSecoesETarefas } from "@/hooks/useChinaTarefaVinculos";
import { useCreateDocVinculo } from "@/hooks/useChinaDocumentoVinculos";
import { useCategoriaResponsaveis } from "@/hooks/useChinaCategoriaResponsaveis";
import { cn } from "@/lib/utils";

interface ChinaDocVincularDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: {
    id: string;
    nome_arquivo: string | null;
    tipo_documento: string;
    status: string;
  } | null;
  categoriaKey: string;
}

export function ChinaDocVincularDialog({ open, onOpenChange, documento, categoriaKey }: ChinaDocVincularDialogProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [selectedTarefaId, setSelectedTarefaId] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [newTarefaTitulo, setNewTarefaTitulo] = useState("");
  const [searchTarefa, setSearchTarefa] = useState("");

  const { data: projetos = [] } = useProjetosParaVinculo();
  const { data: secoesData } = useSecoesETarefas(selectedProjetoId);
  const createDocVinculo = useCreateDocVinculo();
  const { data: catResponsaveis = [] } = useCategoriaResponsaveis(selectedProjetoId);

  // Load team members for responsible selection
  const { data: membros = [] } = useQuery({
    queryKey: ["projeto-membros-vincular", selectedProjetoId],
    enabled: !!selectedProjetoId,
    queryFn: async () => {
      const { data: membs } = await supabase
        .from("projeto_membros")
        .select("user_id")
        .eq("projeto_id", selectedProjetoId!);
      if (!membs || membs.length === 0) return [];
      const userIds = membs.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", userIds);
      return profiles || [];
    },
  });

  const secoes = secoesData?.secoes || [];
  const tarefas = secoesData?.tarefas || [];

  const filteredTarefas = useMemo(() => {
    if (!searchTarefa.trim()) return tarefas;
    return tarefas.filter((t: any) =>
      t.titulo.toLowerCase().includes(searchTarefa.toLowerCase()) ||
      (t.codigo && t.codigo.toLowerCase().includes(searchTarefa.toLowerCase()))
    );
  }, [tarefas, searchTarefa]);

  // Auto-fill responsible from category config
  useEffect(() => {
    if (selectedProjetoId && categoriaKey) {
      const config = catResponsaveis.find((c) => c.categoria_key === categoriaKey);
      if (config) setResponsavelId(config.responsavel_id);
    }
  }, [selectedProjetoId, categoriaKey, catResponsaveis]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedTarefaId(null);
      setNewTarefaTitulo("");
      setSearchTarefa("");
      setMode("existing");
    }
  }, [open]);

  const handleVincular = async () => {
    if (!documento || !selectedProjetoId) return;

    let tarefaId = selectedTarefaId;

    if (mode === "new" && newTarefaTitulo.trim()) {
      // Create new task in the project
      const firstSecao = secoes[0];
      const { data: newTarefa, error } = await supabase
        .from("projeto_tarefas")
        .insert({
          titulo: newTarefaTitulo.trim(),
          projeto_id: selectedProjetoId,
          secao_id: firstSecao?.id || null,
          responsavel_id: responsavelId,
          status: "pendente",
          ordem: 999,
        })
        .select("id")
        .single();
      if (error || !newTarefa) return;
      tarefaId = newTarefa.id;
    }

    if (!tarefaId) return;

    const tarefa = tarefas.find((t: any) => t.id === tarefaId);
    await createDocVinculo.mutateAsync({
      documento_id: documento.id,
      tarefa_id: tarefaId,
      secao_id: tarefa?.secao_id || null,
      projeto_id: selectedProjetoId,
      responsavel_id: responsavelId,
    });

    onOpenChange(false);
  };

  const canSubmit = documento && selectedProjetoId && (
    (mode === "existing" && selectedTarefaId) ||
    (mode === "new" && newTarefaTitulo.trim())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Link2 className="h-4 w-4 text-primary" />
            Vincular Documento a Tarefa
          </DialogTitle>
        </DialogHeader>

        {documento && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Documento:</span>{" "}
            <span className="font-medium">{documento.nome_arquivo || documento.tipo_documento}</span>
            <Badge variant="secondary" className="ml-2 text-[9px]">{documento.status}</Badge>
          </div>
        )}

        <div className="space-y-4">
          {/* Project selection */}
          <div className="space-y-1.5">
            <Label className="text-xs">Projeto</Label>
            <Select value={selectedProjetoId || ""} onValueChange={(v) => { setSelectedProjetoId(v); setSelectedTarefaId(null); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um projeto..." />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.cor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.cor }} />}
                      {p.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProjetoId && (
            <>
              {/* Mode toggle */}
              <div className="flex gap-2">
                <Button
                  variant={mode === "existing" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("existing")}
                  className="flex-1"
                >
                  Tarefa existente
                </Button>
                <Button
                  variant={mode === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("new")}
                  className="flex-1"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Nova tarefa
                </Button>
              </div>

              {mode === "existing" ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar tarefa..."
                      value={searchTarefa}
                      onChange={(e) => setSearchTarefa(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <ScrollArea className="h-[200px] rounded-md border">
                    <RadioGroup value={selectedTarefaId || ""} onValueChange={setSelectedTarefaId}>
                      {secoes.map((secao: any) => {
                        const secTarefas = filteredTarefas.filter((t: any) => t.secao_id === secao.id);
                        if (secTarefas.length === 0) return null;
                        return (
                          <div key={secao.id} className="px-2 py-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                              {secao.nome}
                            </p>
                            {secTarefas.map((t: any) => (
                              <label
                                key={t.id}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent/50 transition-colors",
                                  selectedTarefaId === t.id && "bg-primary/5"
                                )}
                              >
                                <RadioGroupItem value={t.id} className="shrink-0" />
                                <span className="text-xs flex-1">{t.titulo}</span>
                                {t.codigo && <span className="text-[10px] text-muted-foreground font-mono">{t.codigo}</span>}
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </ScrollArea>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Título da nova tarefa</Label>
                  <Input
                    placeholder="Ex: Revisar rótulo produto X..."
                    value={newTarefaTitulo}
                    onChange={(e) => setNewTarefaTitulo(e.target.value)}
                  />
                </div>
              )}

              {/* Responsible selection */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5" />
                  Responsável
                </Label>
                <Select value={responsavelId || ""} onValueChange={setResponsavelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável..." />
                  </SelectTrigger>
                  <SelectContent>
                    {membros.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome || m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleVincular}
            disabled={!canSubmit || createDocVinculo.isPending}
          >
            {createDocVinculo.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Vincular
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
