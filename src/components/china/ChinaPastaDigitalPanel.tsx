import { useState, useMemo, useRef, useEffect } from "react";
import {
  FileText, Upload, Loader2, ChevronRight, ChevronDown, Eye, Trash2,
  Plus, CheckCircle2, AlertCircle, XCircle, Clock, Building2, MessageSquare, Send, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useChinaPastaDigital,
  useAddChinaPastaDigitalItem,
  useEmitirParecerChina,
  useDeleteChinaPastaDigitalItem,
  useAutoImportChinaDocs,
  FASES_CHINA_PASTA,
  PARECER_STATUS_CONFIG,
  DESPACHO_MODULOS,
  type ChinaPastaDigitalItem,
} from "@/hooks/useChinaPastaDigital";
import { useAllDepartments } from "@/hooks/useUserDepartments";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { DespachoModuloDialog } from "./DespachoModuloDialog";

interface ChinaPastaDigitalPanelProps {
  submissaoId: string;
}

const parecerIcons: Record<string, React.ReactNode> = {
  pendente: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  aprovado: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  com_pendencia: <AlertCircle className="h-3.5 w-3.5 text-warning" />,
  rejeitado: <XCircle className="h-3.5 w-3.5 text-destructive" />,
};

export function ChinaPastaDigitalPanel({ submissaoId }: ChinaPastaDigitalPanelProps) {
  const { data: items = [], isLoading } = useChinaPastaDigital(submissaoId);
  const { data: departamentos = [] } = useAllDepartments();
  const addItem = useAddChinaPastaDigitalItem();
  const emitirParecer = useEmitirParecerChina();
  const deleteItem = useDeleteChinaPastaDigitalItem();
  const autoImport = useAutoImportChinaDocs();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedFases, setExpandedFases] = useState<Set<string>>(new Set(FASES_CHINA_PASTA.map(f => f.key)));
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [parecerDialogOpen, setParecerDialogOpen] = useState(false);
  const [despachoDialogOpen, setDespachoDialogOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [hasAutoImported, setHasAutoImported] = useState(false);

  // Add form state
  const [newFase, setNewFase] = useState<string>(FASES_CHINA_PASTA[0].key);
  const [newTitulo, setNewTitulo] = useState("");
  const [newPaginas, setNewPaginas] = useState("");
  const [newDepartamentoId, setNewDepartamentoId] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Parecer form state
  const [parecerStatus, setParecerStatus] = useState("aprovado");
  const [parecerObs, setParecerObs] = useState("");

  const selectedItem = useMemo(() => items.find(i => i.id === selectedId), [items, selectedId]);

  // Auto-import on first load if pasta is empty
  useEffect(() => {
    if (!isLoading && items.length === 0 && !hasAutoImported && submissaoId) {
      setHasAutoImported(true);
      autoImport.mutate(submissaoId);
    }
  }, [isLoading, items.length, hasAutoImported, submissaoId]);

  // Group items by fase
  const itemsByFase = useMemo(() => {
    const map: Record<string, ChinaPastaDigitalItem[]> = {};
    for (const fase of FASES_CHINA_PASTA) {
      const faseItems = items.filter(i => i.fase === fase.key);
      if (faseItems.length > 0) map[fase.key] = faseItems;
    }
    const knownKeys = new Set(FASES_CHINA_PASTA.map(f => f.key));
    const unknownItems = items.filter(i => !knownKeys.has(i.fase));
    if (unknownItems.length > 0) map["_outros"] = unknownItems;
    return map;
  }, [items]);

  const toggleFase = (key: string) => {
    setExpandedFases(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSelectItem = async (item: ChinaPastaDigitalItem) => {
    setSelectedId(item.id);
    const path = item.arquivo_path;
    if (path) {
      setViewerLoading(true);
      try {
        // Try china-pasta-digital bucket first, fallback to china-documentos
        let result = await getSignedUrl("china-pasta-digital", path, 3600);
        if (!result.signedUrl) {
          result = await getSignedUrl("china-documentos", path, 3600);
        }
        setViewerUrl(result.signedUrl);
      } catch {
        setViewerUrl(item.arquivo_url || null);
      } finally {
        setViewerLoading(false);
      }
    } else {
      setViewerUrl(item.arquivo_url || null);
    }
  };

  const handleAdd = async () => {
    if (!newTitulo.trim()) return;
    await addItem.mutateAsync({
      submissao_id: submissaoId,
      fase: newFase,
      titulo: newTitulo.trim(),
      paginas: newPaginas || undefined,
      departamento_id: newDepartamentoId || undefined,
      file: newFile || undefined,
    });
    setAddDialogOpen(false);
    setNewTitulo("");
    setNewPaginas("");
    setNewDepartamentoId("");
    setNewFile(null);
  };

  const handleEmitirParecer = async () => {
    if (!selectedItem) return;
    await emitirParecer.mutateAsync({
      id: selectedItem.id,
      submissao_id: submissaoId,
      parecer_status: parecerStatus,
      parecer_observacao: parecerObs || undefined,
    });
    setParecerDialogOpen(false);
    setParecerObs("");
  };

  const handleDelete = async (item: ChinaPastaDigitalItem) => {
    await deleteItem.mutateAsync({
      id: item.id,
      submissao_id: submissaoId,
      arquivo_path: item.arquivo_path,
    });
    if (selectedId === item.id) {
      setSelectedId(null);
      setViewerUrl(null);
    }
  };

  const getDeptName = (deptId: string | null) => {
    if (!deptId) return null;
    const dept = departamentos.find((d: any) => d.id === deptId);
    return dept?.nome || null;
  };

  const getDespachoLabel = (key: string | null) => {
    if (!key) return null;
    return DESPACHO_MODULOS.find(m => m.key === key);
  };

  // Counters
  const counters = useMemo(() => {
    const total = items.length;
    const aprovados = items.filter(i => i.parecer_status === "aprovado").length;
    const pendentes = items.filter(i => i.parecer_status === "pendente").length;
    const comPendencia = items.filter(i => i.parecer_status === "com_pendencia").length;
    const rejeitados = items.filter(i => i.parecer_status === "rejeitado").length;
    const despachados = items.filter(i => i.despacho_modulo).length;
    return { total, aprovados, pendentes, comPendencia, rejeitados, despachados };
  }, [items]);

  if (isLoading || autoImport.isPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          {autoImport.isPending ? "Importando documentos..." : "Carregando..."}
        </span>
      </div>
    );
  }

  const isImage = (path: string | null) => path && /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
  const isPdf = (path: string | null) => path && /\.pdf$/i.test(path);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Pasta Digital 数字档案
          </h3>
          <p className="text-xs text-muted-foreground">
            Rastreamento documental estilo TJSP — organizado por fases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => autoImport.mutate(submissaoId)} disabled={autoImport.isPending}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Re-importar
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Adicionar Peça
          </Button>
        </div>
      </div>

      {/* Counter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="text-[10px]">{counters.total} peças</Badge>
        {counters.aprovados > 0 && <Badge className="text-[10px] bg-success/10 text-success border-success/20">{counters.aprovados} aprovadas</Badge>}
        {counters.pendentes > 0 && <Badge variant="secondary" className="text-[10px]">{counters.pendentes} pendentes</Badge>}
        {counters.comPendencia > 0 && <Badge className="text-[10px] bg-warning/10 text-warning border-warning/20">{counters.comPendencia} com pendência</Badge>}
        {counters.rejeitados > 0 && <Badge variant="destructive" className="text-[10px]">{counters.rejeitados} rejeitadas</Badge>}
        {counters.despachados > 0 && <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">{counters.despachados} despachadas</Badge>}
      </div>

      {/* Split pane */}
      <div className="border rounded-xl overflow-hidden bg-card" style={{ height: "620px" }}>
        <ResizablePanelGroup direction="horizontal">
          {/* Left: Document tree */}
          <ResizablePanel defaultSize={35} minSize={25}>
            <ScrollArea className="h-full">
              <div className="p-3 space-y-1">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <FileText className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium">Pasta vazia</p>
                    <p className="text-xs">Adicione a primeira peça ou re-importe</p>
                  </div>
                ) : (
                  Object.entries(itemsByFase).map(([faseKey, faseItems]) => {
                    const faseConfig = FASES_CHINA_PASTA.find(f => f.key === faseKey);
                    const isExpanded = expandedFases.has(faseKey);
                    const faseLabel = faseConfig?.label || faseKey;
                    const faseLabelCn = faseConfig?.labelCn || "";
                    const faseIcon = faseConfig?.icon || "📁";

                    const faseAprovados = faseItems.filter(i => i.parecer_status === "aprovado").length;
                    const fasePendencias = faseItems.filter(i => i.parecer_status === "com_pendencia" || i.parecer_status === "rejeitado").length;

                    return (
                      <Collapsible key={faseKey} open={isExpanded} onOpenChange={() => toggleFase(faseKey)}>
                        <CollapsibleTrigger asChild>
                          <button className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors text-left">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                            <span className="text-sm">{faseIcon}</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold text-foreground block truncate">{faseLabel}</span>
                              {faseLabelCn && <span className="text-[9px] text-muted-foreground">{faseLabelCn}</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{faseItems.length}</Badge>
                              {faseAprovados > 0 && <span className="h-2 w-2 rounded-full bg-success" />}
                              {fasePendencias > 0 && <span className="h-2 w-2 rounded-full bg-warning" />}
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-5 space-y-0.5 pb-1">
                            {faseItems.map((item) => {
                              const isSelected = selectedId === item.id;
                              const deptName = getDeptName(item.departamento_id);
                              const despacho = getDespachoLabel(item.despacho_modulo);

                              return (
                                <button
                                  key={item.id}
                                  onClick={() => handleSelectItem(item)}
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded-lg transition-all text-xs flex items-start gap-2 group",
                                    isSelected
                                      ? "bg-primary/10 border border-primary/30 text-primary"
                                      : "hover:bg-accent/50 text-foreground",
                                    item.parecer_status === "aprovado" && "border-l-4 border-l-success",
                                    item.parecer_status === "com_pendencia" && "border-l-4 border-l-warning",
                                    item.parecer_status === "rejeitado" && "border-l-4 border-l-destructive",
                                  )}
                                >
                                  <div className="shrink-0 mt-0.5">
                                    {parecerIcons[item.parecer_status]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{item.titulo}</p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      {item.paginas && (
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                          Pág. {item.paginas}
                                        </span>
                                      )}
                                      {deptName && (
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                          <Building2 className="h-2.5 w-2.5" />
                                          {deptName}
                                        </span>
                                      )}
                                      {despacho && (
                                        <Badge className="text-[8px] px-1 py-0 h-3.5 bg-primary/10 text-primary border-primary/20">
                                          {despacho.icon} {despacho.label}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-opacity shrink-0"
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </button>
                                </button>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Viewer + Parecer */}
          <ResizablePanel defaultSize={65} minSize={40}>
            <div className="h-full flex flex-col">
              {!selectedItem ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <Eye className="h-12 w-12 mb-3 opacity-10" />
                  <p className="text-sm">Selecione uma peça para visualizar</p>
                  <p className="text-[10px] mt-1">选择文件进行查看</p>
                </div>
              ) : (
                <>
                  {/* Viewer header */}
                  <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedItem.titulo}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        {selectedItem.paginas && <span className="font-mono">Pág. {selectedItem.paginas}</span>}
                        <span>•</span>
                        <span>{format(new Date(selectedItem.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const cfg = PARECER_STATUS_CONFIG[selectedItem.parecer_status] || PARECER_STATUS_CONFIG.pendente;
                        return (
                          <Badge className={cn("text-[10px]", cfg.bgColor, cfg.color, "border-0")}>
                            {cfg.label}
                          </Badge>
                        );
                      })()}
                      <Button size="sm" variant="outline" onClick={() => {
                        setParecerStatus("aprovado");
                        setParecerObs("");
                        setParecerDialogOpen(true);
                      }}>
                        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                        Parecer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDespachoDialogOpen(true)}>
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Despachar
                      </Button>
                    </div>
                  </div>

                  {/* Despacho info bar */}
                  {selectedItem.despacho_modulo && (() => {
                    const despacho = getDespachoLabel(selectedItem.despacho_modulo);
                    return (
                      <div className="px-4 py-2 border-b bg-primary/5 text-xs flex items-center gap-2">
                        <Send className="h-3 w-3 text-primary" />
                        <span className="font-medium text-primary">
                          Despachado para: {despacho?.icon} {despacho?.label || selectedItem.despacho_modulo}
                        </span>
                        {selectedItem.despacho_data && (
                          <span className="text-muted-foreground">
                            — {format(new Date(selectedItem.despacho_data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Document viewer */}
                  <div className="flex-1 bg-muted/10 overflow-hidden">
                    {viewerLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : viewerUrl ? (
                      isPdf(selectedItem.arquivo_path) ? (
                        <iframe src={viewerUrl} className="w-full h-full border-0" title="Visualizador" />
                      ) : isImage(selectedItem.arquivo_path) || (viewerUrl && /\.(jpg|jpeg|png|gif|webp)/i.test(viewerUrl)) ? (
                        <div className="flex items-center justify-center h-full p-4">
                          <img src={viewerUrl} alt={selectedItem.titulo} className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <FileText className="h-12 w-12 mb-3 opacity-20" />
                          <p className="text-sm">Formato não suportado para visualização inline</p>
                          <a href={viewerUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-xs mt-2 underline flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> Abrir em nova aba
                          </a>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <FileText className="h-12 w-12 mb-3 opacity-10" />
                        <p className="text-sm">Nenhum arquivo anexado</p>
                      </div>
                    )}
                  </div>

                  {/* Parecer info bar */}
                  {selectedItem.parecer_status !== "pendente" && (
                    <div className={cn(
                      "px-4 py-3 border-t text-xs",
                      PARECER_STATUS_CONFIG[selectedItem.parecer_status]?.bgColor
                    )}>
                      <div className="flex items-center gap-2">
                        {parecerIcons[selectedItem.parecer_status]}
                        <span className="font-semibold">
                          Parecer: {PARECER_STATUS_CONFIG[selectedItem.parecer_status]?.label}
                        </span>
                        {selectedItem.parecer_data && (
                          <span className="text-muted-foreground">
                            — {format(new Date(selectedItem.parecer_data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        )}
                        {getDeptName(selectedItem.departamento_id) && (
                          <Badge variant="secondary" className="text-[9px]">
                            <Building2 className="h-2.5 w-2.5 mr-0.5" />
                            {getDeptName(selectedItem.departamento_id)}
                          </Badge>
                        )}
                      </div>
                      {selectedItem.parecer_observacao && (
                        <p className="mt-1 text-muted-foreground italic">"{selectedItem.parecer_observacao}"</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Despacho Dialog */}
      {selectedItem && (
        <DespachoModuloDialog
          open={despachoDialogOpen}
          onOpenChange={setDespachoDialogOpen}
          itemId={selectedItem.id}
          submissaoId={submissaoId}
          itemTitulo={selectedItem.titulo}
        />
      )}

      {/* Add Peça Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Adicionar Peça Documental 添加文件
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Fase / Categoria 阶段</Label>
              <Select value={newFase} onValueChange={setNewFase}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FASES_CHINA_PASTA.map(f => (
                    <SelectItem key={f.key} value={f.key}>
                      <span className="flex items-center gap-2">{f.icon} {f.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Título * 标题</Label>
              <Input value={newTitulo} onChange={e => setNewTitulo(e.target.value)} placeholder="Ex: Certificado de Análise Lote 2024-01" />
            </div>
            <div>
              <Label className="text-xs">Páginas (ref. visual) 页码</Label>
              <Input value={newPaginas} onChange={e => setNewPaginas(e.target.value)} placeholder="Ex: 1-14, 15, 17-18" />
            </div>
            <div>
              <Label className="text-xs">Departamento Responsável 负责部门</Label>
              <Select value={newDepartamentoId} onValueChange={setNewDepartamentoId}>
                <SelectTrigger><SelectValue placeholder="Selecionar departamento..." /></SelectTrigger>
                <SelectContent>
                  {departamentos.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Arquivo 文件</Label>
              <div className="mt-1">
                <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={e => setNewFile(e.target.files?.[0] || null)} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5 w-full">
                  <Upload className="h-3.5 w-3.5" />
                  {newFile ? newFile.name : "Selecionar arquivo 选择文件"}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newTitulo.trim() || addItem.isPending}>
              {addItem.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parecer Dialog */}
      <Dialog open={parecerDialogOpen} onOpenChange={setParecerDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Emitir Parecer 发表意见</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={parecerStatus} onValueChange={setParecerStatus} className="space-y-2">
              {Object.entries(PARECER_STATUS_CONFIG).filter(([k]) => k !== "pendente").map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2">
                  <RadioGroupItem value={key} id={`parecer-china-${key}`} />
                  <Label htmlFor={`parecer-china-${key}`} className={cn("text-sm cursor-pointer", cfg.color)}>
                    {cfg.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div>
              <Label className="text-xs">Observação 备注</Label>
              <Textarea value={parecerObs} onChange={e => setParecerObs(e.target.value)} placeholder="Descreva o parecer..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParecerDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEmitirParecer} disabled={emitirParecer.isPending}>
              {emitirParecer.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
