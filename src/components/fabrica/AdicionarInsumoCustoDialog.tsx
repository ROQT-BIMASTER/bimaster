import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdicionar: (insumo: {
    mp_id?: string;
    codigo: string;
    nome: string;
    fornecedor?: string;
    custo_nf?: number;
  }) => void;
}

interface MateriaPrima {
  id: string;
  codigo: string;
  nome: string;
  fornecedor_id: string | null;
  fornecedor_nome?: string | null;
  custo_unitario: number | null;
}

export function AdicionarInsumoCustoDialog({
  open,
  onOpenChange,
  onAdicionar,
}: Props) {
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [busca, setBusca] = useState("");
  const [mpSelecionada, setMpSelecionada] = useState<MateriaPrima | null>(null);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  
  // Campos manuais
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [fornecedor, setFornecedor] = useState("");

  // Carregar matérias-primas
  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from("fabrica_materias_primas")
        .select(`
          id, codigo, nome, fornecedor_id, custo_unitario,
          fornecedor:fabrica_fornecedores(nome)
        `)
        .eq("status", "ativo")
        .order("nome");

      const mpsFormatadas: MateriaPrima[] = (data || []).map((mp: any) => ({
        id: mp.id,
        codigo: mp.codigo,
        nome: mp.nome,
        fornecedor_id: mp.fornecedor_id,
        fornecedor_nome: mp.fornecedor?.nome || null,
        custo_unitario: mp.custo_unitario,
      }));

      setMateriasPrimas(mpsFormatadas);
    }

    if (open) {
      carregar();
    }
  }, [open]);

  // Filtrar MPs
  const mpsFiltradas = materiasPrimas.filter(
    (mp) =>
      mp.nome.toLowerCase().includes(busca.toLowerCase()) ||
      mp.codigo.toLowerCase().includes(busca.toLowerCase())
  );

  const handleAdicionar = () => {
    if (modoManual) {
      if (!codigo || !nome) return;
      onAdicionar({
        codigo,
        nome,
        fornecedor: fornecedor || undefined,
      });
    } else {
      if (!mpSelecionada) return;
      onAdicionar({
        mp_id: mpSelecionada.id,
        codigo: mpSelecionada.codigo,
        nome: mpSelecionada.nome,
        fornecedor: mpSelecionada.fornecedor_nome || undefined,
        custo_nf: mpSelecionada.custo_unitario || undefined,
      });
    }

    // Limpar e fechar
    setMpSelecionada(null);
    setCodigo("");
    setNome("");
    setFornecedor("");
    setBusca("");
    setModoManual(false);
    onOpenChange(false);
  };

  const handleClose = () => {
    setMpSelecionada(null);
    setCodigo("");
    setNome("");
    setFornecedor("");
    setBusca("");
    setModoManual(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Insumo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle modo */}
          <div className="flex gap-2">
            <Button
              variant={!modoManual ? "default" : "outline"}
              size="sm"
              onClick={() => setModoManual(false)}
            >
              Buscar MP
            </Button>
            <Button
              variant={modoManual ? "default" : "outline"}
              size="sm"
              onClick={() => setModoManual(true)}
            >
              Entrada Manual
            </Button>
          </div>

          {!modoManual ? (
            <div className="space-y-2">
              <Label>Selecione a Matéria-Prima</Label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {mpSelecionada
                      ? `${mpSelecionada.codigo} - ${mpSelecionada.nome}`
                      : "Selecione uma MP..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar por código ou nome..."
                      value={busca}
                      onValueChange={setBusca}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhuma MP encontrada</CommandEmpty>
                      <CommandGroup>
                        {mpsFiltradas.slice(0, 50).map((mp) => (
                          <CommandItem
                            key={mp.id}
                            value={`${mp.codigo} ${mp.nome}`}
                            onSelect={() => {
                              setMpSelecionada(mp);
                              setOpenCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                mpSelecionada?.id === mp.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {mp.codigo} - {mp.nome}
                              </span>
                              {mp.fornecedor_nome && (
                                <span className="text-xs text-muted-foreground">
                                  {mp.fornecedor_nome}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {mpSelecionada && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p>
                    <strong>Fornecedor:</strong>{" "}
                    {mpSelecionada.fornecedor_nome || "-"}
                  </p>
                  <p>
                    <strong>Custo Unitário:</strong>{" "}
                    {mpSelecionada.custo_unitario
                      ? `R$ ${mpSelecionada.custo_unitario.toFixed(6)}`
                      : "-"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex: 12345"
                />
              </div>
              <div>
                <Label htmlFor="nome">Nome do Insumo *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Frasco 100ml"
                />
              </div>
              <div>
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Input
                  id="fornecedor"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Ex: Kilimplast"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleAdicionar}
            disabled={modoManual ? !codigo || !nome : !mpSelecionada}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
