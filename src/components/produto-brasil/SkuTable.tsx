import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Layers } from "lucide-react";
import { useAddSku, useDeleteSku, useProdutoBrasilSkus } from "@/hooks/useProdutoBrasil";

interface Props {
  produtoBrasilId: string;
}

export function SkuTable({ produtoBrasilId }: Props) {
  const { data: skus = [] } = useProdutoBrasilSkus(produtoBrasilId);
  const addSku = useAddSku();
  const deleteSku = useDeleteSku();

  const [newSku, setNewSku] = useState({ cor: "", tamanho_grade: "", codigo_interno: "", ean: "", quantidade_inicial: 0 });

  const handleAdd = () => {
    addSku.mutate({ produto_brasil_id: produtoBrasilId, ...newSku });
    setNewSku({ cor: "", tamanho_grade: "", codigo_interno: "", ean: "", quantidade_inicial: 0 });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Variações / SKUs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cor</TableHead>
              <TableHead>Tamanho/Grade</TableHead>
              <TableHead>Código Interno</TableHead>
              <TableHead>EAN</TableHead>
              <TableHead>Qtd Inicial</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {skus.map((sku) => (
              <TableRow key={sku.id}>
                <TableCell className="text-sm">{sku.cor || "—"}</TableCell>
                <TableCell className="text-sm">{sku.tamanho_grade || "—"}</TableCell>
                <TableCell className="text-sm font-mono">{sku.codigo_interno || "—"}</TableCell>
                <TableCell className="text-sm font-mono">{sku.ean || "—"}</TableCell>
                <TableCell className="text-sm">{sku.quantidade_inicial}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSku.mutate({ id: sku.id, produtoBrasilId })}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {/* Add row */}
            <TableRow>
              <TableCell>
                <Input placeholder="Cor" value={newSku.cor} onChange={(e) => setNewSku((p) => ({ ...p, cor: e.target.value }))} className="h-8 text-sm" />
              </TableCell>
              <TableCell>
                <Input placeholder="Grade" value={newSku.tamanho_grade} onChange={(e) => setNewSku((p) => ({ ...p, tamanho_grade: e.target.value }))} className="h-8 text-sm" />
              </TableCell>
              <TableCell>
                <Input placeholder="Código" value={newSku.codigo_interno} onChange={(e) => setNewSku((p) => ({ ...p, codigo_interno: e.target.value }))} className="h-8 text-sm" />
              </TableCell>
              <TableCell>
                <Input placeholder="EAN" value={newSku.ean} onChange={(e) => setNewSku((p) => ({ ...p, ean: e.target.value }))} className="h-8 text-sm" />
              </TableCell>
              <TableCell>
                <Input type="number" value={newSku.quantidade_inicial} onChange={(e) => setNewSku((p) => ({ ...p, quantidade_inicial: parseInt(e.target.value) || 0 }))} className="h-8 text-sm w-20" />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={handleAdd} disabled={addSku.isPending}>
                  <Plus className="h-4 w-4 text-primary" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
