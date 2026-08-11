import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, Layers } from "lucide-react";
import type { PerfilMarkup } from "@/hooks/usePerfisMarkup";
import type { TipoMarkup } from "@/lib/fabrica/cascataPricing";

interface Props {
  titulo: string;
  perfis: PerfilMarkup[];
  perfilId: string | null;
  onSelect: (id: string) => void;
  onEditItem: (itemId: string, tipo: TipoMarkup, valor: number) => void;
  onDuplicar: (perfil: PerfilMarkup) => void;
}

const TIPOS: { value: TipoMarkup; label: string }[] = [
  { value: "percentual", label: "% sobre a base" },
  { value: "multiplicador", label: "Multiplicador" },
  { value: "margem_pct", label: "Margem %" },
  { value: "valor_fixo", label: "Valor fixo" },
  { value: "desconto_pct", label: "Desconto %" },
];

export function PerfilMarkupSelector({
  titulo,
  perfis,
  perfilId,
  onSelect,
  onEditItem,
  onDuplicar,
}: Props) {
  const perfil = perfis.find((p) => p.id === perfilId) || null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              {titulo}
            </CardTitle>
            <CardDescription>{perfil?.descricao || "Selecione um perfil de cálculo"}</CardDescription>
          </div>
          {perfil && (
            <Button variant="ghost" size="sm" onClick={() => onDuplicar(perfil)}>
              <Copy className="h-4 w-4 mr-1" />
              Duplicar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Perfil</Label>
          <Select value={perfilId ?? undefined} onValueChange={onSelect}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Escolher perfil" />
            </SelectTrigger>
            <SelectContent>
              {perfis.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {perfil && (
          <div className="space-y-2">
            {perfil.itens.map((item) => (
              <div key={item.id} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-4 text-sm truncate" title={item.nome_linha || ""}>
                  {item.nome_linha || "Linha"}
                </div>
                <div className="col-span-5">
                  <Select
                    value={item.tipo_markup}
                    onValueChange={(v) => onEditItem(item.id, v as TipoMarkup, item.valor_markup)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    step="0.0001"
                    className="h-8 text-xs font-mono text-right"
                    defaultValue={item.valor_markup}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v) && v !== item.valor_markup) {
                        onEditItem(item.id, item.tipo_markup, v);
                      }
                    }}
                  />
                </div>
              </div>
            ))}
            {perfil.itens.length === 0 && (
              <Badge variant="secondary">Perfil sem regras configuradas</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
