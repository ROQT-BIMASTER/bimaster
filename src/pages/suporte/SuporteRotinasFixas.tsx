import { useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Repeat, Plus, Play, Pencil, Trash2, Clock, AlertTriangle, Workflow } from "lucide-react";
import { useRotinasFixas, useDeleteRotinaFixa, useGerarRotinasManual, useRotinasEmAtraso, type RotinaFixa } from "@/hooks/suporte/useRotinasFixas";
import { RotinaFixaDialog } from "@/components/suporte/RotinaFixaDialog";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DIAS_LABEL = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function SuporteRotinasFixas() {
  const [filaFilter, setFilaFilter] = useState<string | undefined>(undefined);
  const { data: filas = [] } = useSuporteFilas();
  const { data: rotinas = [], isLoading } = useRotinasFixas(filaFilter);
  const { data: atrasadas = [] } = useRotinasEmAtraso();
  const del = useDeleteRotinaFixa();
  const gerar = useGerarRotinasManual();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RotinaFixa | null>(null);

  const abrirNova = () => { setEditing(null); setDialogOpen(true); };
  const abrirEdit = (r: RotinaFixa) => { setEditing(r); setDialogOpen(true); };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Repeat className="h-6 w-6 text-primary" /> Rotinas fixas
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure tarefas diárias obrigatórias por colaborador. O sistema gera automaticamente
              um chamado com protocolo e uma tarefa espelho todo dia útil.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => gerar.mutate()} disabled={gerar.isPending}>
              <Play className="h-4 w-4 mr-1" /> Gerar agora
            </Button>
            <Button onClick={abrirNova}>
              <Plus className="h-4 w-4 mr-1" /> Nova rotina
            </Button>
          </div>
        </div>

        {atrasadas.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /> {atrasadas.length} rotina(s) em atraso
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Líderes foram notificados. Verifique com os responsáveis.
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={!filaFilter ? "default" : "outline"} onClick={() => setFilaFilter(undefined)}>Todas</Button>
          {filas.map((f) => (
            <Button key={f.id} size="sm" variant={filaFilter === f.id ? "default" : "outline"} onClick={() => setFilaFilter(f.id)}>
              {f.nome}
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando…</div>
            ) : rotinas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma rotina configurada. Clique em "Nova rotina" para começar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Fila</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rotinas.map((r) => {
                    const filaNome = filas.find((f) => f.id === r.fila_id)?.nome ?? "—";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.titulo}</TableCell>
                        <TableCell>{filaNome}</TableCell>
                        <TableCell className="text-xs">
                          {r.dias_semana.map((d) => DIAS_LABEL[d]).join(", ")}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Clock className="h-3 w-3 inline mr-1" />{r.horario_geracao?.slice(0,5)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.prioridade === "critica" ? "destructive" : r.prioridade === "alta" ? "default" : "secondary"}>
                            {r.prioridade}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.ativo ? "default" : "outline"}>{r.ativo ? "Ativa" : "Pausada"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => abrirEdit(r)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => {
                              if (confirm("Remover essa rotina fixa?")) del.mutate(r.id);
                            }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <RotinaFixaDialog open={dialogOpen} onOpenChange={setDialogOpen} rotina={editing} />
    </DashboardLayout>
  );
}
