import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { Search, Package } from "lucide-react";

interface MateriaPrima {
  id: string;
  codigo: string;
  nome: string;
  custo_unitario: number | null;
  fornecedor_nome?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdicionar: (insumo: {
    mp_id?: string;
    codigo: string;
    nome: string;
    fornecedor?: string;
    tipo_insumo: string;
    custo_nf?: number;
    custo_servico?: number;
    custo_condicao?: number;
    nf_referencia?: string;
  }) => void;
}

const TIPOS_INSUMO = [
  { value: "bulk", label: "Bulk" },
  { value: "embalagem_primaria", label: "Emb. Primária" },
  { value: "embalagem_secundaria", label: "Emb. Secundária" },
  { value: "rotulo", label: "Rótulo" },
  { value: "acessorio", label: "Acessório" },
  { value: "outro", label: "Outro" },
];

export function AdicionarInsumoCustoDialog({
  open,
  onOpenChange,
  onAdicionar,
}: Props) {
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<"busca" | "manual">("busca");

  // Dados do insumo
  const [mpSelecionada, setMpSelecionada] = useState<MateriaPrima | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [tipoInsumo, setTipoInsumo] = useState("bulk");
  const [custoNF, setCustoNF] = useState("");
  const [custoServico, setCustoServico] = useState("");
  const [custoCondicao, setCustoCondicao] = useState("");
  const [nfReferencia, setNfReferencia] = useState("");

  // Buscar matérias-primas
  useEffect(() => {
    if (busca.length < 2) {
      setMateriasPrimas([]);
      return;
    }

    const buscar = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("fabrica_materias_primas")
        .select("id, codigo, nome, custo_unitario, fornecedor:fabrica_fornecedores(nome)")
        .eq("status", "ativo")
        .or(`codigo.ilike.%${busca}%,nome.ilike.%${busca}%`)
        .limit(10);

      if (!error && data) {
        setMateriasPrimas(
          data.map((mp: any) => ({
            id: mp.id,
            codigo: mp.codigo,
            nome: mp.nome,
            custo_unitario: mp.custo_unitario,
            fornecedor_nome: mp.fornecedor?.nome || null,
          }))
        );
      }
      setLoading(false);
    };

    const timeout = setTimeout(buscar, 300);
    return () => clearTimeout(timeout);
  }, [busca]);

  const handleSelecionarMP = (mp: MateriaPrima) => {
    setMpSelecionada(mp);
    setCodigo(mp.codigo);
    setNome(mp.nome);
    setFornecedor(mp.fornecedor_nome || "");
    // Pré-preencher custo NF com custo unitário da MP
    if (mp.custo_unitario) {
      setCustoNF(mp.custo_unitario.toString());
    }
    setBusca("");
  };

  const handleAdicionar = () => {
    if (!codigo || !nome) return;

    onAdicionar({
      mp_id: mpSelecionada?.id,
      codigo,
      nome,
      fornecedor: fornecedor || undefined,
      tipo_insumo: tipoInsumo,
      custo_nf: custoNF ? parseFloat(custoNF) : 0,
      custo_servico: custoServico ? parseFloat(custoServico) : 0,
      custo_condicao: custoCondicao ? parseFloat(custoCondicao) : 0,
      nf_referencia: nfReferencia || undefined,
    });

    // Limpar form
    setMpSelecionada(null);
    setCodigo("");
    setNome("");
    setFornecedor("");
    setTipoInsumo("bulk");
    setCustoNF("");
    setCustoServico("");
    setCustoCondicao("");
    setNfReferencia("");
    setBusca("");
    onOpenChange(false);
  };

  const limparForm = () => {
    setMpSelecionada(null);
    setCodigo("");
    setNome("");
    setFornecedor("");
    setTipoInsumo("bulk");
    setCustoNF("");
    setCustoServico("");
    setCustoCondicao("");
    setNfReferencia("");
    setBusca("");
  };

  // Calcular custo total
  const custoTotal =
    (parseFloat(custoNF) || 0) +
    (parseFloat(custoServico) || 0) +
    (parseFloat(custoCondicao) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Insumo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle modo */}
          <div className="flex gap-2">
            <Button
              variant={modo === "busca" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setModo("busca");
                limparForm();
              }}
            >
              <Search className="h-4 w-4 mr-1" />
              Buscar MP
            </Button>
            <Button
              variant={modo === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setModo("manual");
                limparForm();
              }}
            >
              <Package className="h-4 w-4 mr-1" />
              Manual
            </Button>
          </div>

          {/* Busca de MP */}
          {modo === "busca" && !mpSelecionada && (
            <div>
              <Label>Buscar Matéria-Prima</Label>
              <Command className="border rounded-md mt-1">
                <CommandInput
                  placeholder="Digite código ou nome..."
                  value={busca}
                  onValueChange={setBusca}
                />
                <CommandList>
                  {loading && (
                    <CommandEmpty>Buscando...</CommandEmpty>
                  )}
                  {!loading && busca.length >= 2 && materiasPrimas.length === 0 && (
                    <CommandEmpty>Nenhuma MP encontrada</CommandEmpty>
                  )}
                  {materiasPrimas.length > 0 && (
                    <CommandGroup>
                      {materiasPrimas.map((mp) => (
                        <CommandItem
                          key={mp.id}
                          onSelect={() => handleSelecionarMP(mp)}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {mp.codigo} - {mp.nome}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {mp.fornecedor_nome || "Sem fornecedor"}
                              {mp.custo_unitario &&
                                ` | R$ ${mp.custo_unitario.toFixed(4)}`}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </div>
          )}

          {/* MP Selecionada ou Modo Manual */}
          {(mpSelecionada || modo === "manual") && (
            <>
              {/* Dados básicos */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="codigo">Código *</Label>
                  <Input
                    id="codigo"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Ex: MP-001"
                    disabled={!!mpSelecionada}
                  />
                </div>
                <div>
                  <Label htmlFor="tipo">Tipo de Insumo</Label>
                  <Select value={tipoInsumo} onValueChange={setTipoInsumo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_INSUMO.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do insumo"
                  disabled={!!mpSelecionada}
                />
              </div>

              <div>
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Input
                  id="fornecedor"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Nome do fornecedor"
                />
              </div>

              {/* Custos detalhados */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3">Custos Detalhados</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="custoNF">Custo NF (R$)</Label>
                    <Input
                      id="custoNF"
                      type="number"
                      step="0.000001"
                      value={custoNF}
                      onChange={(e) => setCustoNF(e.target.value)}
                      placeholder="0,000000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custoServico">Custo Serviço (R$)</Label>
                    <Input
                      id="custoServico"
                      type="number"
                      step="0.000001"
                      value={custoServico}
                      onChange={(e) => setCustoServico(e.target.value)}
                      placeholder="0,000000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custoCondicao">Custo Condição (R$)</Label>
                    <Input
                      id="custoCondicao"
                      type="number"
                      step="0.000001"
                      value={custoCondicao}
                      onChange={(e) => setCustoCondicao(e.target.value)}
                      placeholder="0,000000"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <Label htmlFor="nfRef">NF de Referência</Label>
                  <Input
                    id="nfRef"
                    value={nfReferencia}
                    onChange={(e) => setNfReferencia(e.target.value)}
                    placeholder="Ex: NF12345"
                  />
                </div>

                {/* Custo total calculado */}
                <div className="mt-3 p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Custo Total do Insumo:</span>
                    <span className="font-bold text-lg">
                      {custoTotal.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        minimumFractionDigits: 6,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-4">
            {mpSelecionada && (
              <Button
                variant="outline"
                onClick={() => {
                  setMpSelecionada(null);
                  limparForm();
                }}
              >
                Trocar MP
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdicionar}
              disabled={!codigo || !nome}
            >
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
