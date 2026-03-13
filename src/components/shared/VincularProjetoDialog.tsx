import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Trash2, Link2 } from "lucide-react";
import { useProjetosParaVinculo, useSecoesETarefas } from "@/hooks/useChinaTarefaVinculos";
import { useVinculosDoRegistro, useCreateModuloVinculo, useDeleteModuloVinculo, type ModuloType, type ModuloVinculo } from "@/hooks/useModuloVinculos";
import { useNavigate } from "react-router-dom";

interface Props {
  modulo: ModuloType;
  registroId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VincularProjetoDialog({ modulo, registroId, open, onOpenChange }: Props) {
  const [selectedProjeto, setSelectedProjeto] = useState("");
  const [selectedSecao, setSelectedSecao] = useState("");
  const [selectedTarefa, setSelectedTarefa] = useState("");

  const { data: projetos = [] } = useProjetosParaVinculo();
  const { data: secoesData } = useSecoesETarefas(selectedProjeto || null);
  const { data: vinculos = [] } = useVinculosDoRegistro(modulo, registroId);
  const createVinculo = useCreateModuloVinculo();
  const deleteVinculo = useDeleteModuloVinculo();

  const secoes = secoesData?.secoes || [];
  const tarefas = (secoesData?.tarefas || []).filter((t: any) =>
    !selectedSecao || t.secao_id === selectedSecao
  );

  const handleVincular = () => {
    if (!selectedProjeto) return;
    createVinculo.mutate(
      {
        modulo,
        registro_id: registroId,
        projeto_id: selectedProjeto,
        secao_id: selectedSecao || undefined,
        tarefa_id: selectedTarefa || undefined,
      },
      {
        onSuccess: () => {
          setSelectedProjeto("");
          setSelectedSecao("");
          setSelectedTarefa("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Vincular ao Projeto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Projeto</Label>
            <Select value={selectedProjeto} onValueChange={(v) => { setSelectedProjeto(v); setSelectedSecao(""); setSelectedTarefa(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecionar projeto" /></SelectTrigger>
              <SelectContent>
                {projetos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProjeto && secoes.length > 0 && (
            <div className="space-y-2">
              <Label>Seção</Label>
              <Select value={selectedSecao} onValueChange={(v) => { setSelectedSecao(v); setSelectedTarefa(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar seção (opcional)" /></SelectTrigger>
                <SelectContent>
                  {secoes.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedProjeto && tarefas.length > 0 && (
            <div className="space-y-2">
              <Label>Tarefa</Label>
              <Select value={selectedTarefa} onValueChange={setSelectedTarefa}>
                <SelectTrigger><SelectValue placeholder="Selecionar tarefa (opcional)" /></SelectTrigger>
                <SelectContent>
                  {tarefas.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleVincular} disabled={!selectedProjeto || createVinculo.isPending} className="w-full">
            <Link2 className="h-4 w-4 mr-2" />
            Vincular
          </Button>

          {vinculos.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Vínculos atuais</Label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {vinculos.map((v) => (
                  <VinculoItem key={v.id} vinculo={v} onDelete={() => deleteVinculo.mutate(v.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VinculoItem({ vinculo, onDelete }: { vinculo: ModuloVinculo; onDelete: () => void }) {
  const navigate = useNavigate();
  const path = [vinculo.projeto_nome, vinculo.secao_nome, vinculo.tarefa_titulo].filter(Boolean).join(" › ");

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
      <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" />
      <span
        className="flex-1 truncate cursor-pointer hover:text-primary transition-colors"
        onClick={() => navigate(`/dashboard/projetos/${vinculo.projeto_id}`)}
      >
        {path}
      </span>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onDelete}>
        <Trash2 className="h-3 w-3 text-destructive" />
      </Button>
    </div>
  );
}
