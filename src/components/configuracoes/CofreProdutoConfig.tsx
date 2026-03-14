import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCofreProdutoConfig, CofreConfigItem } from "@/hooks/useCofreProdutoConfig";
import { Plus, Edit2, Power, GripVertical, FolderOpen, Camera, FileText, Video, File, Loader2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const TIPO_ANEXO_OPTIONS = [
  { value: "foto", label: "Foto", icon: Camera },
  { value: "video", label: "Vídeo", icon: Video },
  { value: "documento", label: "Documento", icon: FileText },
  { value: "qualquer", label: "Qualquer", icon: File },
];

const APLICAVEL_OPTIONS = [
  { value: '{"tipo":"todos"}', label: "Todos os Produtos" },
  { value: '{"tipo":"categoria"}', label: "Por Categoria" },
  { value: '{"tipo":"origem","valor":"china"}', label: "Origem China" },
  { value: '{"tipo":"origem","valor":"brasil"}', label: "Origem Brasil" },
  { value: '{"tipo":"origem","valor":"collab"}', label: "Collab" },
];

interface FormData {
  nome_pt: string;
  nome_zh: string;
  tipo_anexo: string;
  qtd_minima: number;
  obrigatorio: boolean;
  aplicavel_a: string;
}

const defaultForm: FormData = {
  nome_pt: "",
  nome_zh: "",
  tipo_anexo: "qualquer",
  qtd_minima: 1,
  obrigatorio: false,
  aplicavel_a: '{"tipo":"todos"}',
};

export function CofreProdutoConfig() {
  const { configs, loading, createConfig, updateConfig, toggleStatus, reorderConfigs } = useCofreProdutoConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (item: CofreConfigItem) => {
    setEditingId(item.id);
    setForm({
      nome_pt: item.nome_pt,
      nome_zh: item.nome_zh || "",
      tipo_anexo: item.tipo_anexo,
      qtd_minima: item.qtd_minima,
      obrigatorio: item.obrigatorio,
      aplicavel_a: JSON.stringify(item.aplicavel_a),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome_pt.trim()) return;
    let parsedAplicavel;
    try { parsedAplicavel = JSON.parse(form.aplicavel_a); } catch { parsedAplicavel = { tipo: "todos" }; }

    const payload = {
      nome_pt: form.nome_pt.trim(),
      nome_zh: form.nome_zh.trim() || null,
      tipo_anexo: form.tipo_anexo,
      qtd_minima: form.qtd_minima,
      obrigatorio: form.obrigatorio,
      aplicavel_a: parsedAplicavel,
    };

    if (editingId) {
      await updateConfig(editingId, payload as any);
    } else {
      await createConfig({ ...payload, ordem: configs.length, status: "ativo" } as any);
    }
    setDialogOpen(false);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const reordered = Array.from(configs);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    reorderConfigs(reordered);
  };

  const getTipoIcon = (tipo: string) => {
    const opt = TIPO_ANEXO_OPTIONS.find(o => o.value === tipo);
    const Icon = opt?.icon || File;
    return <Icon className="h-3.5 w-3.5" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                Cofre do Produto — Configuração
              </CardTitle>
              <CardDescription>
                Configure os itens de checklist exigidos para o cofre de anexos do produto
              </CardDescription>
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="cofre-config">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Nome PT</TableHead>
                        <TableHead>Nome ZH</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-center">Mín.</TableHead>
                        <TableHead className="text-center">Obrigatório</TableHead>
                        <TableHead>Aplicável a</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="w-24">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configs.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <TableRow
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={snapshot.isDragging ? "bg-accent" : item.status === "inativo" ? "opacity-50" : ""}
                            >
                              <TableCell className="p-1">
                                <div {...provided.dragHandleProps}>
                                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                </div>
                              </TableCell>
                              <TableCell className="font-medium text-sm">{item.nome_pt}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{item.nome_zh || "—"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-xs">
                                  {getTipoIcon(item.tipo_anexo)}
                                  {TIPO_ANEXO_OPTIONS.find(o => o.value === item.tipo_anexo)?.label}
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-sm">{item.qtd_minima}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={item.obrigatorio ? "destructive" : "secondary"} className="text-[10px]">
                                  {item.obrigatorio ? "Sim" : "Não"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {item.aplicavel_a?.tipo === "todos" ? "Todos" : item.aplicavel_a?.tipo}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={item.status === "ativo" ? "default" : "outline"} className="text-[10px]">
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => toggleStatus(item.id, item.status)}
                                  >
                                    <Power className={`h-3.5 w-3.5 ${item.status === "ativo" ? "text-success" : "text-muted-foreground"}`} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {configs.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhum item configurado</p>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Item" : "Novo Item do Cofre"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome PT-BR *</Label>
              <Input value={form.nome_pt} onChange={e => setForm(f => ({ ...f, nome_pt: e.target.value }))} placeholder="Ex: Design Garrafa" />
            </div>
            <div>
              <Label>Nome Chinês (ZH)</Label>
              <Input value={form.nome_zh} onChange={e => setForm(f => ({ ...f, nome_zh: e.target.value }))} placeholder="瓶子设计" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Anexo</Label>
                <select
                  value={form.tipo_anexo}
                  onChange={e => setForm(f => ({ ...f, tipo_anexo: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {TIPO_ANEXO_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Quantidade Mínima</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.qtd_minima}
                  onChange={e => setForm(f => ({ ...f, qtd_minima: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.obrigatorio}
                onCheckedChange={v => setForm(f => ({ ...f, obrigatorio: !!v }))}
              />
              <Label className="cursor-pointer">Obrigatório</Label>
            </div>
            <div>
              <Label>Aplicável a</Label>
              <select
                value={form.aplicavel_a}
                onChange={e => setForm(f => ({ ...f, aplicavel_a: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {APLICAVEL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nome_pt.trim()}>
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
