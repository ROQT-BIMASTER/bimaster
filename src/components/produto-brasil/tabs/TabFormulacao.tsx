import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Beaker } from "lucide-react";
import { useUpdateProdutoBrasil, type ProdutoBrasil } from "@/hooks/useProdutoBrasil";

export function TabFormulacao({ produto }: { produto: ProdutoBrasil }) {
  const updateProduto = useUpdateProdutoBrasil();

  const [composicao, setComposicao] = useState(produto.composicao || "");
  const [ativos, setAtivos] = useState(produto.ativos || "");
  const [fragrancia, setFragrancia] = useState(produto.fragrancia || "");
  const [modoUso, setModoUso] = useState(produto.modo_uso || "");
  const [precaucoes, setPrecaucoes] = useState(produto.precaucoes || "");
  const [aplicador, setAplicador] = useState(produto.tipo_aplicador || "");

  useEffect(() => {
    setComposicao(produto.composicao || "");
    setAtivos(produto.ativos || "");
    setFragrancia(produto.fragrancia || "");
    setModoUso(produto.modo_uso || "");
    setPrecaucoes(produto.precaucoes || "");
    setAplicador(produto.tipo_aplicador || "");
  }, [produto]);

  const handleSave = () => {
    updateProduto.mutate({
      id: produto.id,
      composicao: composicao || null,
      ativos: ativos || null,
      fragrancia: fragrancia || null,
      modo_uso: modoUso || null,
      precaucoes: precaucoes || null,
      tipo_aplicador: aplicador || null,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Beaker className="h-4 w-4" />
          Formulação e Uso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Composição / INCI</Label>
          <Textarea value={composicao} onChange={(e) => setComposicao(e.target.value)} rows={3} placeholder="Lista de ingredientes..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Ativos Principais</Label>
            <Input value={ativos} onChange={(e) => setAtivos(e.target.value)} placeholder="Ex: Ácido Hialurônico, Vitamina C" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fragrância</Label>
            <Input value={fragrancia} onChange={(e) => setFragrancia(e.target.value)} placeholder="Ex: Floral suave" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Modo de Uso</Label>
          <Textarea value={modoUso} onChange={(e) => setModoUso(e.target.value)} rows={2} placeholder="Instruções de aplicação..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Precauções</Label>
            <Textarea value={precaucoes} onChange={(e) => setPrecaucoes(e.target.value)} rows={2} placeholder="Avisos de segurança..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo de Aplicador</Label>
            <Input value={aplicador} onChange={(e) => setAplicador(e.target.value)} placeholder="Ex: Pump, Spray, Bisnaga" />
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={updateProduto.isPending}>
          Salvar Formulação
        </Button>
      </CardContent>
    </Card>
  );
}
