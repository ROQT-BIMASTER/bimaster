import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface InsumoExtraido {
  codigo: string;
  nome: string;
  fornecedor: string;
  custo_nf: number;
  custo_servico: number;
  custo_condicao: number;
  nf_referencia: string;
  selecionado: boolean;
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

export function ImportarInsumosIA({ onImportar }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [insumosExtraidos, setInsumosExtraidos] = useState<InsumoExtraido[]>([]);
  const [etapa, setEtapa] = useState<"upload" | "revisao">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }

    // Converter para base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      await processarImagem(base64);
    };
    reader.readAsDataURL(file);
  };

  const processarImagem = async (base64Image: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extrair-insumos-imagem", {
        body: { image: base64Image },
      });

      if (error) throw error;

      if (data?.insumos && Array.isArray(data.insumos)) {
        setInsumosExtraidos(
          data.insumos.map((i: any) => ({
            ...i,
            custo_nf: parseFloat(i.custo_nf) || 0,
            custo_servico: parseFloat(i.custo_servico) || 0,
            custo_condicao: parseFloat(i.custo_condicao) || 0,
            selecionado: true,
          }))
        );
        setEtapa("revisao");
        toast.success(`${data.insumos.length} insumos identificados!`);
      } else {
        toast.warning("Não foi possível identificar insumos na imagem");
      }
    } catch (err: any) {
      console.error("Erro ao processar imagem:", err);
      toast.error("Erro ao processar imagem: " + (err.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const toggleSelecionado = (index: number) => {
    setInsumosExtraidos((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selecionado: !item.selecionado } : item
      )
    );
  };

  const toggleTodos = (checked: boolean) => {
    setInsumosExtraidos((prev) =>
      prev.map((item) => ({ ...item, selecionado: checked }))
    );
  };

  const handleImportar = () => {
    const selecionados = insumosExtraidos.filter((i) => i.selecionado);
    if (selecionados.length === 0) {
      toast.warning("Selecione pelo menos um insumo para importar");
      return;
    }

    const insumosParaImportar = selecionados.map((i) => ({
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
    toast.success(`${selecionados.length} insumos importados!`);
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
    setInsumosExtraidos([]);
    setEtapa("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const todosOsInsumosSelecionados = insumosExtraidos.every((i) => i.selecionado);
  const totalSelecionados = insumosExtraidos.filter((i) => i.selecionado).length;

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
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Importar Insumos com IA
            </DialogTitle>
            <DialogDescription>
              Envie uma imagem de tabela de custos e a IA irá extrair os insumos automaticamente
            </DialogDescription>
          </DialogHeader>

          {etapa === "upload" && (
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!imagePreview && !loading && (
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

              {imagePreview && (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden border">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-64 w-full object-contain bg-muted"
                    />
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-lg font-medium">Analisando imagem...</p>
                  <p className="text-sm text-muted-foreground">
                    A IA está extraindo os dados da tabela
                  </p>
                </div>
              )}
            </div>
          )}

          {etapa === "revisao" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={todosOsInsumosSelecionados}
                    onCheckedChange={(checked) => toggleTodos(!!checked)}
                  />
                  <span className="text-sm font-medium">
                    Selecionar todos ({totalSelecionados}/{insumosExtraidos.length})
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEtapa("upload");
                    setImagePreview(null);
                    setInsumosExtraidos([]);
                  }}
                >
                  Nova imagem
                </Button>
              </div>

              <ScrollArea className="h-[350px] border rounded-lg">
                <div className="p-3 space-y-2">
                  {insumosExtraidos.map((insumo, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg transition-colors ${
                        insumo.selecionado
                          ? "bg-primary/5 border-primary/30"
                          : "bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={insumo.selecionado}
                          onCheckedChange={() => toggleSelecionado(index)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                              {insumo.codigo || "S/C"}
                            </span>
                            <span className="font-medium truncate">
                              {insumo.nome}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                            {insumo.fornecedor && (
                              <span>Forn: {insumo.fornecedor}</span>
                            )}
                            {insumo.custo_nf > 0 && (
                              <span>NF: R$ {insumo.custo_nf.toFixed(6)}</span>
                            )}
                            {insumo.custo_servico > 0 && (
                              <span>Serv: R$ {insumo.custo_servico.toFixed(6)}</span>
                            )}
                            {insumo.custo_condicao > 0 && (
                              <span>Cond: R$ {insumo.custo_condicao.toFixed(6)}</span>
                            )}
                            {insumo.nf_referencia && (
                              <span>NF Ref: {insumo.nf_referencia}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={handleImportar} disabled={totalSelecionados === 0}>
                  <Check className="h-4 w-4 mr-2" />
                  Importar {totalSelecionados} insumos
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
