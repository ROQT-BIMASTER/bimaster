import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ComparadorVersoesProps {
  versaoAntiga: any;
  versaoNova: any;
  onClose: () => void;
}

// Labels amigáveis para campos conhecidos
const FIELD_LABELS: Record<string, string> = {
  nome: "Nome",
  descricao: "Descrição",
  peso_liquido: "Peso Líquido",
  peso_bruto: "Peso Bruto",
  validade: "Validade",
  ingredientes: "Ingredientes",
  modo_preparo: "Modo de Preparo",
  informacao_nutricional: "Inf. Nutricional",
  alergenos: "Alérgenos",
  embalagem: "Embalagem",
  lote: "Lote",
  status: "Status",
  motivo_alteracao: "Motivo da Alteração",
  versao: "Versão",
  created_at: "Data de Criação",
  updated_at: "Data de Atualização",
};

function getLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export function ComparadorVersoes({
  versaoAntiga,
  versaoNova,
  onClose,
}: ComparadorVersoesProps) {
  // Collect all keys from both versions, excluding internal IDs
  const SKIP_KEYS = new Set(["id", "ficha_tecnica_id", "produto_id", "user_id", "created_by"]);

  const diffRows = useMemo(() => {
    const allKeys = new Set([
      ...Object.keys(versaoAntiga || {}),
      ...Object.keys(versaoNova || {}),
    ]);

    return Array.from(allKeys)
      .filter((key) => !SKIP_KEYS.has(key))
      .sort()
      .map((key) => {
        const oldVal = stringify(versaoAntiga?.[key]);
        const newVal = stringify(versaoNova?.[key]);
        const changed = oldVal !== newVal;
        return { key, oldVal, newVal, changed };
      });
  }, [versaoAntiga, versaoNova]);

  const changedCount = diffRows.filter((r) => r.changed).length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparação de Versões</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header cards */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Versão Anterior</span>
                <Badge variant="secondary">v{versaoAntiga?.versao ?? "?"}</Badge>
              </div>
              <p className="text-sm">
                {versaoAntiga?.created_at
                  ? new Date(versaoAntiga.created_at).toLocaleDateString("pt-BR")
                  : "—"}
              </p>
            </div>

            <div className="p-4 border rounded-lg bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Versão Nova</span>
                <Badge>v{versaoNova?.versao ?? "?"}</Badge>
              </div>
              <p className="text-sm">
                {versaoNova?.created_at
                  ? new Date(versaoNova.created_at).toLocaleDateString("pt-BR")
                  : "—"}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="text-sm text-muted-foreground">
            {changedCount > 0
              ? `${changedCount} campo(s) alterado(s) de ${diffRows.length} total`
              : "Nenhuma diferença encontrada"}
          </div>

          {/* Diff table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Campo</TableHead>
                  <TableHead>Versão Anterior</TableHead>
                  <TableHead>Versão Nova</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diffRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium text-sm">
                      {getLabel(row.key)}
                      {row.changed && (
                        <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">
                          alterado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-sm whitespace-pre-wrap max-w-[300px] break-words",
                        row.changed && "bg-red-50 dark:bg-red-950/30"
                      )}
                    >
                      {row.oldVal}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-sm whitespace-pre-wrap max-w-[300px] break-words",
                        row.changed && "bg-yellow-50 dark:bg-yellow-950/30"
                      )}
                    >
                      {row.newVal}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Justificativa */}
          {versaoNova?.motivo_alteracao && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Motivo da Alteração</h4>
              <p className="text-sm text-muted-foreground">{versaoNova.motivo_alteracao}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
