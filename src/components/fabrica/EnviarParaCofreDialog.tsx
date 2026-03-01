import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, Plus, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Anexo {
  nome: string;
  path: string;
  tipo: string;
  enviado_para_cofre?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anexo: Anexo;
  anexoIndex: number;
  revisaoId: string;
  produtoId: string;
  mensagemId: string;
  mensagemAnexos: Anexo[];
  onSaved: () => void;
}

const CATEGORIAS_COFRE = [
  { value: "orcamento", label: "Orçamento" },
  { value: "nf", label: "Nota Fiscal" },
  { value: "art", label: "ART" },
  { value: "embalagem_tampa", label: "Embalagem - Tampa" },
  { value: "embalagem_frasco", label: "Embalagem - Frasco" },
  { value: "embalagem_rotulo", label: "Embalagem - Rótulo" },
  { value: "embalagem_caixa", label: "Embalagem - Caixa" },
  { value: "materia_prima", label: "Matéria-Prima" },
  { value: "evidencia", label: "Evidência" },
  { value: "contrato", label: "Contrato" },
  { value: "geral", label: "Geral" },
];

interface MPItem {
  id: string;
  nome: string;
  codigo: string;
}

export function EnviarParaCofreDialog({
  open, onOpenChange, anexo, anexoIndex, revisaoId, produtoId, mensagemId, mensagemAnexos, onSaved,
}: Props) {
  const [categoria, setCategoria] = useState("");
  const [materiaPrimaId, setMateriaPrimaId] = useState("none");
  const [materiasPrimas, setMateriasPrimas] = useState<MPItem[]>([]);
  const [loadingMPs, setLoadingMPs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNovaMP, setShowNovaMP] = useState(false);
  const [novaMPNome, setNovaMPNome] = useState("");
  const [novaMPCodigo, setNovaMPCodigo] = useState("");
  const [criandoMP, setCriandoMP] = useState(false);

  // Load matérias-primas
  useEffect(() => {
    if (!open || !produtoId) return;
    (async () => {
      setLoadingMPs(true);
      // Try loading from formula
      const { data: formula } = await supabase
        .from("fabrica_formulas" as any)
        .select("id")
        .eq("produto_id", produtoId)
        .eq("status", "ativa")
        .limit(1)
        .single();

      let mpIds: string[] = [];
      if (formula) {
        const { data: itens } = await supabase
          .from("fabrica_formula_itens" as any)
          .select("materia_prima_id")
          .eq("formula_id", (formula as any).id);
        mpIds = (itens as any[] || []).map(i => i.materia_prima_id).filter(Boolean);
      }

      if (mpIds.length > 0) {
        const { data: mps } = await supabase
          .from("fabrica_materias_primas")
          .select("id, nome, codigo")
          .in("id", mpIds);
        setMateriasPrimas((mps as any[]) || []);
      } else {
        // Fallback: load all
        const { data: mps } = await supabase
          .from("fabrica_materias_primas")
          .select("id, nome, codigo")
          .order("nome")
          .limit(100);
        setMateriasPrimas((mps as any[]) || []);
      }
      setLoadingMPs(false);
    })();
  }, [open, produtoId]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCategoria("");
      setMateriaPrimaId("none");
      setShowNovaMP(false);
      setNovaMPNome("");
      setNovaMPCodigo("");
    }
  }, [open]);

  const requiresMP = categoria === "materia_prima";
  const isEmbalagem = categoria.startsWith("embalagem_");
  const canSave = categoria && (!requiresMP || materiaPrimaId !== "none") && !saving;

  const handleCriarMP = async () => {
    if (!novaMPNome.trim() || !novaMPCodigo.trim()) {
      toast.error("Preencha nome e código da matéria-prima");
      return;
    }
    setCriandoMP(true);
    try {
      const { data, error } = await supabase
        .from("fabrica_materias_primas")
        .insert({ nome: novaMPNome.trim(), codigo: novaMPCodigo.trim() } as any)
        .select()
        .single();
      if (error) throw error;
      const newMP = data as any;
      setMateriasPrimas(prev => [...prev, { id: newMP.id, nome: newMP.nome, codigo: newMP.codigo }]);
      setMateriaPrimaId(newMP.id);
      setShowNovaMP(false);
      setNovaMPNome("");
      setNovaMPCodigo("");
      toast.success("Matéria-prima cadastrada!");
    } catch (e: any) {
      toast.error("Erro ao cadastrar: " + e.message);
    } finally {
      setCriandoMP(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const nome = user?.user_metadata?.nome || user?.email || "Usuário";

      // 1. Insert into cofre
      await supabase.from("fabrica_revisao_documentos" as any).insert({
        revisao_id: revisaoId,
        produto_id: produtoId,
        mensagem_id: mensagemId,
        nome_arquivo: anexo.nome,
        arquivo_path: anexo.path,
        tipo_arquivo: anexo.tipo,
        tamanho: 0,
        categoria,
        status: "ativo",
        enviado_por: user?.id,
        enviado_por_nome: nome,
        materia_prima_id: (requiresMP || isEmbalagem) && materiaPrimaId !== "none" ? materiaPrimaId : null,
      } as any);

      // 2. Update message to mark attachment as sent to cofre
      const updatedAnexos = mensagemAnexos.map((a, i) =>
        i === anexoIndex ? { ...a, enviado_para_cofre: true } : a
      );
      await supabase.from("fabrica_revisao_mensagens" as any)
        .update({ anexos: updatedAnexos } as any)
        .eq("id", mensagemId);

      toast.success("Documento salvo no Cofre!");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            Enviar para o Cofre
          </DialogTitle>
          <DialogDescription>
            Categorize o documento antes de salvá-lo no cofre do produto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File info */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{anexo.nome}</span>
          </div>

          {/* Category select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Categoria *</Label>
            <Select value={categoria} onValueChange={(v) => {
              setCategoria(v);
              if (v !== "materia_prima" && !v.startsWith("embalagem_")) {
                setMateriaPrimaId("none");
              }
            }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_COFRE.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* MP select - required for materia_prima, optional for embalagem */}
          {(requiresMP || isEmbalagem) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Matéria-Prima {requiresMP ? "*" : "(opcional)"}
              </Label>
              {loadingMPs ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                </div>
              ) : (
                <>
                  <Select value={materiaPrimaId} onValueChange={setMateriaPrimaId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione a matéria-prima" />
                    </SelectTrigger>
                    <SelectContent>
                      {!requiresMP && <SelectItem value="none">Nenhuma</SelectItem>}
                      {materiasPrimas.map(mp => (
                        <SelectItem key={mp.id} value={mp.id}>
                          {mp.codigo} - {mp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Create new MP */}
                  {!showNovaMP ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 gap-1 text-primary"
                      onClick={() => setShowNovaMP(true)}
                    >
                      <Plus className="h-3 w-3" /> Cadastrar nova matéria-prima
                    </Button>
                  ) : (
                    <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Código</Label>
                          <Input
                            value={novaMPCodigo}
                            onChange={e => setNovaMPCodigo(e.target.value)}
                            placeholder="MP-001"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Nome</Label>
                          <Input
                            value={novaMPNome}
                            onChange={e => setNovaMPNome(e.target.value)}
                            placeholder="Nome da MP"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={handleCriarMP} disabled={criandoMP}>
                          {criandoMP ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cadastrar"}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowNovaMP(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Salvar no Cofre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
