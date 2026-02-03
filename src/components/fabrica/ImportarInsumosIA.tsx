import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Upload, Loader2, Check, X, ChevronLeft, ChevronRight, Image, FileText, AlertTriangle, Pencil, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface HistoricoAlteracao {
  campo: string;
  valorAnterior: string;
  valorNovo: string;
  timestamp: Date;
}

interface InsumoExtraido {
  codigo: string;
  nome: string;
  fornecedor: string;
  custo_nf: number;
  custo_servico: number;
  custo_condicao: number;
  nf_referencia: string;
  conferido: boolean;
  rejeitado: boolean;
  editado: boolean;
  valoresOriginais: {
    codigo: string;
    nome: string;
    fornecedor: string;
    custo_nf: number;
    custo_servico: number;
    custo_condicao: number;
    nf_referencia: string;
  };
  historicoAlteracoes: HistoricoAlteracao[];
}

interface Props {
  onImportar: (insumos: {
    mp_id?: string;
    codigo: string;
    nome: string;
    fornecedor?: string;
    tipo_insumo: string;
    custo_nf?: number;
    custo_servico?: number;
    custo_condicao?: number;
    nf_referencia?: string;
  }[]) => void;
}

type Etapa = "upload" | "conferencia" | "confirmacao";
type ModoInput = "imagem" | "texto";

export function ImportarInsumosIA({ onImportar }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [modoInput, setModoInput] = useState<ModoInput>("imagem");
  
  // Upload
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [textoColado, setTextoColado] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Conferência
  const [insumosExtraidos, setInsumosExtraidos] = useState<InsumoExtraido[]>([]);
  const [itemAtual, setItemAtual] = useState(0);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  
  // Confirmação
  const [aceitouResponsabilidade, setAceitouResponsabilidade] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      await processarDados(base64, undefined);
    };
    reader.readAsDataURL(file);
  };

  const processarTexto = async () => {
    if (!textoColado.trim()) {
      toast.error("Cole o texto da tabela antes de processar");
      return;
    }
    await processarDados(undefined, textoColado);
  };

  const processarDados = async (image?: string, text?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extrair-insumos-imagem", {
        body: { image, text },
      });

      if (error) throw error;

      if (data?.insumos && Array.isArray(data.insumos) && data.insumos.length > 0) {
        setInsumosExtraidos(
          data.insumos.map((i: any) => {
            const valoresBase = {
              codigo: i.codigo || "",
              nome: i.nome || "",
              fornecedor: i.fornecedor || "",
              custo_nf: parseFloat(i.custo_nf) || 0,
              custo_servico: parseFloat(i.custo_servico) || 0,
              custo_condicao: parseFloat(i.custo_condicao) || 0,
              nf_referencia: i.nf_referencia || "",
            };
            return {
              ...valoresBase,
              conferido: false,
              rejeitado: false,
              editado: false,
              valoresOriginais: { ...valoresBase },
              historicoAlteracoes: [],
            };
          })
        );
        setItemAtual(0);
        setEtapa("conferencia");
        toast.success(`${data.insumos.length} insumos identificados! Confira cada um.`);
      } else {
        toast.warning("Não foi possível identificar insumos");
      }
    } catch (err: any) {
      console.error("Erro ao processar:", err);
      toast.error("Erro ao processar: " + (err.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const registrarAlteracao = (campo: string, valorAnterior: string | number, valorNovo: string | number) => {
    setInsumosExtraidos((prev) =>
      prev.map((item, i) => {
        if (i !== itemAtual) return item;
        
        const novaAlteracao: HistoricoAlteracao = {
          campo,
          valorAnterior: String(valorAnterior),
          valorNovo: String(valorNovo),
          timestamp: new Date(),
        };
        
        return {
          ...item,
          editado: true,
          historicoAlteracoes: [...item.historicoAlteracoes, novaAlteracao],
        };
      })
    );
  };

  const atualizarCampo = (campo: keyof InsumoExtraido, valor: string | number) => {
    const itemAtualData = insumosExtraidos[itemAtual];
    if (!itemAtualData) return;
    
    const valorAnterior = itemAtualData[campo];
    
    if (valorAnterior !== valor) {
      registrarAlteracao(
        getNomeCampo(campo),
        valorAnterior as string | number,
        valor
      );
    }
    
    setInsumosExtraidos((prev) =>
      prev.map((item, i) =>
        i === itemAtual ? { ...item, [campo]: valor } : item
      )
    );
  };

  const getNomeCampo = (campo: string): string => {
    const nomes: Record<string, string> = {
      codigo: "Código",
      nome: "Nome",
      fornecedor: "Fornecedor",
      custo_nf: "Custo NF",
      custo_servico: "Custo Serviço",
      custo_condicao: "Custo Condição",
      nf_referencia: "NF Referência",
    };
    return nomes[campo] || campo;
  };

  const restaurarValoresOriginais = () => {
    const itemAtualData = insumosExtraidos[itemAtual];
    if (!itemAtualData) return;
    
    const originais = itemAtualData.valoresOriginais;
    
    setInsumosExtraidos((prev) =>
      prev.map((item, i) =>
        i === itemAtual
          ? {
              ...item,
              ...originais,
              editado: false,
              historicoAlteracoes: [
                ...item.historicoAlteracoes,
                {
                  campo: "Restauração",
                  valorAnterior: "Valores editados",
                  valorNovo: "Valores originais da IA",
                  timestamp: new Date(),
                },
              ],
            }
          : item
      )
    );
    toast.info("Valores restaurados para os originais da IA");
  };

  const confirmarItem = () => {
    setInsumosExtraidos((prev) =>
      prev.map((item, i) =>
        i === itemAtual ? { ...item, conferido: true, rejeitado: false } : item
      )
    );
    setModoEdicao(false);
    avancarItem();
  };

  const rejeitarItem = () => {
    setInsumosExtraidos((prev) =>
      prev.map((item, i) =>
        i === itemAtual ? { ...item, conferido: false, rejeitado: true } : item
      )
    );
    setModoEdicao(false);
    avancarItem();
  };

  const avancarItem = () => {
    const proximoNaoConferido = insumosExtraidos.findIndex(
      (item, i) => i > itemAtual && !item.conferido && !item.rejeitado
    );
    
    if (proximoNaoConferido !== -1) {
      setItemAtual(proximoNaoConferido);
    } else {
      // Verificar se todos foram conferidos
      const todosProcessados = insumosExtraidos.every(
        (item, i) => i === itemAtual || item.conferido || item.rejeitado
      );
      if (todosProcessados) {
        setEtapa("confirmacao");
      } else if (itemAtual < insumosExtraidos.length - 1) {
        setItemAtual(itemAtual + 1);
      }
    }
  };

  const handleImportar = () => {
    const aprovados = insumosExtraidos.filter((i) => i.conferido && !i.rejeitado);
    if (aprovados.length === 0) {
      toast.warning("Nenhum insumo foi aprovado para importação");
      return;
    }

    const insumosParaImportar = aprovados.map((i) => ({
      codigo: i.codigo,
      nome: i.nome,
      fornecedor: i.fornecedor || undefined,
      tipo_insumo: inferirTipoInsumo(i.nome),
      custo_nf: i.custo_nf,
      custo_servico: i.custo_servico,
      custo_condicao: i.custo_condicao,
      nf_referencia: i.nf_referencia || undefined,
    }));

    onImportar(insumosParaImportar);
    toast.success(`${aprovados.length} insumos importados!`);
    handleClose();
  };

  const inferirTipoInsumo = (nome: string): string => {
    const nomeLower = nome.toLowerCase();
    if (nomeLower.includes("bulk")) return "bulk";
    if (nomeLower.includes("frasco") || nomeLower.includes("tampa") || nomeLower.includes("batoque")) return "embalagem_primaria";
    if (nomeLower.includes("caixa") || nomeLower.includes("cartucho") || nomeLower.includes("display")) return "embalagem_secundaria";
    if (nomeLower.includes("rótulo") || nomeLower.includes("rotulo") || nomeLower.includes("filme")) return "rotulo";
    if (nomeLower.includes("berço") || nomeLower.includes("berco") || nomeLower.includes("tabuleiro")) return "acessorio";
    return "outro";
  };

  const handleClose = () => {
    setOpen(false);
    setImagePreview(null);
    setTextoColado("");
    setInsumosExtraidos([]);
    setEtapa("upload");
    setModoInput("imagem");
    setItemAtual(0);
    setAceitouResponsabilidade(false);
    setModoEdicao(false);
    setHistoricoAberto(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const totalConferidos = insumosExtraidos.filter((i) => i.conferido).length;
  const totalRejeitados = insumosExtraidos.filter((i) => i.rejeitado).length;
  const totalEditados = insumosExtraidos.filter((i) => i.editado).length;
  const totalProcessados = totalConferidos + totalRejeitados;
  const progresso = insumosExtraidos.length > 0 ? (totalProcessados / insumosExtraidos.length) * 100 : 0;
  const itemAtualData = insumosExtraidos[itemAtual];
  
  const todosProcessados = insumosExtraidos.length > 0 && 
    insumosExtraidos.every((i) => i.conferido || i.rejeitado);
  
  const podeImportar = todosProcessados && aceitouResponsabilidade && totalConferidos > 0;

  const formatarData = (data: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(data);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Importar com IA
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Importar Insumos com IA
            </DialogTitle>
            <DialogDescription>
              {etapa === "upload" && "Envie uma imagem ou cole o texto da tabela de custos"}
              {etapa === "conferencia" && "Confira cada item extraído pela IA antes de importar"}
              {etapa === "confirmacao" && "Revise e confirme a importação"}
            </DialogDescription>
          </DialogHeader>

          {/* ETAPA 1: UPLOAD */}
          {etapa === "upload" && (
            <div className="space-y-4">
              {/* Seletor de modo */}
              <div className="flex gap-2">
                <Button
                  variant={modoInput === "imagem" ? "default" : "outline"}
                  onClick={() => setModoInput("imagem")}
                  className="flex-1 gap-2"
                >
                  <Image className="h-4 w-4" />
                  Enviar Imagem
                </Button>
                <Button
                  variant={modoInput === "texto" ? "default" : "outline"}
                  onClick={() => setModoInput("texto")}
                  className="flex-1 gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Colar Texto
                </Button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {modoInput === "imagem" && !imagePreview && !loading && (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">
                    Clique para enviar uma imagem
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Formatos: JPG, PNG, WEBP (máx. 10MB)
                  </p>
                </div>
              )}

              {modoInput === "imagem" && imagePreview && (
                <div className="relative rounded-lg overflow-hidden border">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-64 w-full object-contain bg-muted"
                  />
                </div>
              )}

              {modoInput === "texto" && !loading && (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Cole aqui o texto da tabela de custos...&#10;&#10;Exemplo:&#10;Código  Nome         Fornecedor  NF      Serviço&#10;22904   Bulk         Rodrigues   0.18    0.18&#10;00987   Frasco 50ml  GlassCo     0.24    0.24"
                    value={textoColado}
                    onChange={(e) => setTextoColado(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                  <Button 
                    onClick={processarTexto} 
                    disabled={!textoColado.trim()}
                    className="w-full gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Processar com IA
                  </Button>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-lg font-medium">Analisando...</p>
                  <p className="text-sm text-muted-foreground">
                    A IA está extraindo os dados
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ETAPA 2: CONFERÊNCIA ITEM A ITEM */}
          {etapa === "conferencia" && itemAtualData && (
            <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
              {/* Header com navegação */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Item {itemAtual + 1} de {insumosExtraidos.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setItemAtual(Math.max(0, itemAtual - 1));
                      setModoEdicao(false);
                    }}
                    disabled={itemAtual === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setItemAtual(Math.min(insumosExtraidos.length - 1, itemAtual + 1));
                      setModoEdicao(false);
                    }}
                    disabled={itemAtual === insumosExtraidos.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Card do item atual */}
              <div className="border rounded-lg p-4 space-y-4 flex-1 overflow-auto">
                {/* Header do card */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!modoEdicao ? (
                      <>
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {itemAtualData.codigo || "S/C"}
                        </span>
                        <span className="font-semibold text-lg">{itemAtualData.nome}</span>
                      </>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <Input
                          value={itemAtualData.codigo}
                          onChange={(e) => atualizarCampo("codigo", e.target.value)}
                          placeholder="Código"
                          className="w-24 font-mono text-sm"
                        />
                        <Input
                          value={itemAtualData.nome}
                          onChange={(e) => atualizarCampo("nome", e.target.value)}
                          placeholder="Nome do insumo"
                          className="w-48"
                        />
                      </div>
                    )}
                    {itemAtualData.editado && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              <Pencil className="h-3 w-3 mr-1" /> Editado
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{itemAtualData.historicoAlteracoes.length} alteração(ões)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {itemAtualData.conferido && (
                      <Badge variant="default" className="bg-green-600">
                        <Check className="h-3 w-3 mr-1" /> Conferido
                      </Badge>
                    )}
                    {itemAtualData.rejeitado && (
                      <Badge variant="destructive">
                        <X className="h-3 w-3 mr-1" /> Rejeitado
                      </Badge>
                    )}
                    {!itemAtualData.conferido && !itemAtualData.rejeitado && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        Pendente
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Fornecedor */}
                <div>
                  <span className="text-sm text-muted-foreground">Fornecedor:</span>
                  {!modoEdicao ? (
                    <span className="ml-2 font-medium">{itemAtualData.fornecedor || "-"}</span>
                  ) : (
                    <Input
                      value={itemAtualData.fornecedor}
                      onChange={(e) => atualizarCampo("fornecedor", e.target.value)}
                      placeholder="Fornecedor"
                      className="mt-1"
                    />
                  )}
                </div>

                {/* Custos */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">Custos</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <span className="text-xs text-muted-foreground block mb-1">Custo NF</span>
                      {!modoEdicao ? (
                        <span className="text-lg font-mono font-semibold">
                          R$ {itemAtualData.custo_nf.toFixed(6)}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          step="0.000001"
                          value={itemAtualData.custo_nf}
                          onChange={(e) => atualizarCampo("custo_nf", parseFloat(e.target.value) || 0)}
                          className="font-mono"
                        />
                      )}
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <span className="text-xs text-muted-foreground block mb-1">Custo Serviço</span>
                      {!modoEdicao ? (
                        <span className="text-lg font-mono font-semibold">
                          R$ {itemAtualData.custo_servico.toFixed(6)}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          step="0.000001"
                          value={itemAtualData.custo_servico}
                          onChange={(e) => atualizarCampo("custo_servico", parseFloat(e.target.value) || 0)}
                          className="font-mono"
                        />
                      )}
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <span className="text-xs text-muted-foreground block mb-1">Custo Condição</span>
                      {!modoEdicao ? (
                        <span className="text-lg font-mono font-semibold">
                          R$ {itemAtualData.custo_condicao.toFixed(6)}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          step="0.000001"
                          value={itemAtualData.custo_condicao}
                          onChange={(e) => atualizarCampo("custo_condicao", parseFloat(e.target.value) || 0)}
                          className="font-mono"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* NF Referência */}
                <div className="text-sm">
                  <span className="text-muted-foreground">NF Referência:</span>
                  {!modoEdicao ? (
                    <span className="ml-2">{itemAtualData.nf_referencia || "-"}</span>
                  ) : (
                    <Input
                      value={itemAtualData.nf_referencia}
                      onChange={(e) => atualizarCampo("nf_referencia", e.target.value)}
                      placeholder="Número da NF"
                      className="mt-1"
                    />
                  )}
                </div>

                {/* Histórico de Alterações */}
                {itemAtualData.historicoAlteracoes.length > 0 && (
                  <Collapsible open={historicoAberto} onOpenChange={setHistoricoAberto}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full gap-2">
                        <History className="h-4 w-4" />
                        Histórico de Alterações ({itemAtualData.historicoAlteracoes.length})
                        <ChevronRight className={`h-4 w-4 transition-transform ${historicoAberto ? 'rotate-90' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="border rounded-lg divide-y max-h-[150px] overflow-auto">
                        {itemAtualData.historicoAlteracoes.map((alt, idx) => (
                          <div key={idx} className="p-2 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{alt.campo}</span>
                              <span className="text-muted-foreground">{formatarData(alt.timestamp)}</span>
                            </div>
                            <div className="mt-1 text-muted-foreground">
                              <span className="line-through text-red-600">{alt.valorAnterior || "(vazio)"}</span>
                              {" → "}
                              <span className="text-green-600">{alt.valorNovo || "(vazio)"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>

              {/* Botões de edição */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={modoEdicao ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setModoEdicao(!modoEdicao)}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  {modoEdicao ? "Sair da Edição" : "Editar Valores"}
                </Button>
                {itemAtualData.editado && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={restaurarValoresOriginais}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restaurar Original
                  </Button>
                )}
              </div>

              {/* Botões de ação */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={rejeitarItem}
                  className="flex-1 gap-2"
                  disabled={itemAtualData.conferido || itemAtualData.rejeitado}
                >
                  <X className="h-4 w-4" />
                  Rejeitar Item
                </Button>
                <Button
                  onClick={confirmarItem}
                  className="flex-1 gap-2"
                  disabled={itemAtualData.conferido || itemAtualData.rejeitado}
                >
                  <Check className="h-4 w-4" />
                  Confirmar e Avançar
                </Button>
              </div>

              {/* Progresso */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    {totalConferidos} aprovados • {totalRejeitados} rejeitados
                    {totalEditados > 0 && <span className="text-blue-600"> • {totalEditados} editados</span>}
                  </span>
                  <span>{totalProcessados}/{insumosExtraidos.length} conferidos</span>
                </div>
                <Progress value={progresso} className="h-2" />
              </div>

              {todosProcessados && (
                <Button onClick={() => setEtapa("confirmacao")} className="w-full">
                  Ir para Confirmação Final
                </Button>
              )}
            </div>
          )}

          {/* ETAPA 3: CONFIRMAÇÃO FINAL */}
          {etapa === "confirmacao" && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-3">Resumo da Importação</h4>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <span className="text-2xl font-bold text-green-600">{totalConferidos}</span>
                    <p className="text-sm text-muted-foreground">Aprovados</p>
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-red-600">{totalRejeitados}</span>
                    <p className="text-sm text-muted-foreground">Rejeitados</p>
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-blue-600">{totalEditados}</span>
                    <p className="text-sm text-muted-foreground">Editados</p>
                  </div>
                  <div>
                    <span className="text-2xl font-bold">{insumosExtraidos.length}</span>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>

              {/* Lista resumida dos aprovados */}
              {totalConferidos > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-3 py-2 text-sm font-medium">
                    Itens a serem importados
                  </div>
                  <div className="max-h-[200px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 min-w-[80px]">Código</th>
                          <th className="text-left px-3 py-2 min-w-[150px]">Nome</th>
                          <th className="text-left px-3 py-2 min-w-[100px]">Fornecedor</th>
                          <th className="text-right px-3 py-2 min-w-[100px]">NF</th>
                          <th className="text-right px-3 py-2 min-w-[100px]">Serviço</th>
                          <th className="text-right px-3 py-2 min-w-[100px]">Condição</th>
                          <th className="text-center px-3 py-2 min-w-[80px]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insumosExtraidos
                          .filter((i) => i.conferido)
                          .map((insumo, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-3 py-2 font-mono">{insumo.codigo || "-"}</td>
                              <td className="px-3 py-2">{insumo.nome}</td>
                              <td className="px-3 py-2">{insumo.fornecedor || "-"}</td>
                              <td className="px-3 py-2 text-right font-mono">
                                {insumo.custo_nf.toFixed(6)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {insumo.custo_servico.toFixed(6)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {insumo.custo_condicao.toFixed(6)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {insumo.editado ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                                          Editado
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{insumo.historicoAlteracoes.length} alteração(ões)</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <Badge variant="outline" className="text-xs">Original</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Aviso de responsabilidade */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-yellow-800">
                      IMPORTANTE: Os dados foram extraídos automaticamente por IA.
                    </p>
                    <p className="text-sm text-yellow-700">
                      É de sua responsabilidade verificar se todos os valores estão corretos antes de confirmar a importação.
                      {totalEditados > 0 && (
                        <span className="font-medium"> Você editou {totalEditados} item(ns).</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox
                  id="responsabilidade"
                  checked={aceitouResponsabilidade}
                  onCheckedChange={(checked) => setAceitouResponsabilidade(!!checked)}
                  className="mt-0.5"
                />
                <Label htmlFor="responsabilidade" className="text-sm cursor-pointer leading-relaxed">
                  Li e concordo que conferi todos os itens e assumo responsabilidade pela validação dos dados importados.
                </Label>
              </div>

              {/* Botões finais */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEtapa("conferencia")} className="flex-1">
                  Voltar para Conferência
                </Button>
                <Button 
                  onClick={handleImportar} 
                  disabled={!podeImportar}
                  className="flex-1 gap-2"
                >
                  <Check className="h-4 w-4" />
                  Importar {totalConferidos} Insumos
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
