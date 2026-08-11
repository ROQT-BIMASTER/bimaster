import { useEffect, useMemo, useState } from "react";
import { usePerfisMarkup, useTabelasCadeia } from "@/hooks/usePerfisMarkup";
import { PerfilMarkupSelector } from "./PerfilMarkupSelector";
import { ProdutosHipoteticosGrid } from "./ProdutosHipoteticosGrid";
import { ComparativoPerfisTable } from "./ComparativoPerfisTable";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProdutoHipotetico } from "@/lib/fabrica/perfilSimulacao";

const PRODUTOS_INICIAIS: Omit<ProdutoHipotetico, "id" | "nivel_id">[] = [
  { descricao: "Corretivo", valor: 5.25 },
  { descricao: "Pó", valor: 5.5 },
  { descricao: "Blush", valor: 4.75 },
  { descricao: "Base", valor: 9 },
];

export function SimuladorPerfisTab() {
  const { data: perfis = [], isLoading, salvarItem, duplicarPerfil } = usePerfisMarkup();
  const { data: tabelas = [], isLoading: loadingTabelas } = useTabelasCadeia();

  const [perfilAId, setPerfilAId] = useState<string | null>(null);
  const [perfilBId, setPerfilBId] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<ProdutoHipotetico[]>([]);

  // Nível padrão dos valores informados: Tabela Clear, quando existir.
  const nivelClear = useMemo(
    () => tabelas.find((t) => /clear/i.test(t.nome))?.id ?? null,
    [tabelas],
  );

  useEffect(() => {
    if (produtos.length === 0 && tabelas.length > 0) {
      setProdutos(
        PRODUTOS_INICIAIS.map((p) => ({
          ...p,
          id: crypto.randomUUID(),
          nivel_id: nivelClear,
        })),
      );
    }
  }, [tabelas.length, nivelClear]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!perfilAId && perfis[0]) setPerfilAId(perfis[0].id);
    if (!perfilBId && perfis[1]) setPerfilBId(perfis[1].id);
  }, [perfis]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || loadingTabelas) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const perfilA = perfis.find((p) => p.id === perfilAId) ?? null;
  const perfilB = perfis.find((p) => p.id === perfilBId) ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerfilMarkupSelector
          titulo="Perfil A"
          perfis={perfis}
          perfilId={perfilAId}
          onSelect={setPerfilAId}
          onEditItem={(id, tipo, valor) =>
            salvarItem.mutate({ id, tipo_markup: tipo, valor_markup: valor })
          }
          onDuplicar={(p) => duplicarPerfil.mutate(p)}
        />
        <PerfilMarkupSelector
          titulo="Perfil B (comparação)"
          perfis={perfis}
          perfilId={perfilBId}
          onSelect={setPerfilBId}
          onEditItem={(id, tipo, valor) =>
            salvarItem.mutate({ id, tipo_markup: tipo, valor_markup: valor })
          }
          onDuplicar={(p) => duplicarPerfil.mutate(p)}
        />
      </div>

      <ProdutosHipoteticosGrid produtos={produtos} tabelas={tabelas} onChange={setProdutos} />

      <ComparativoPerfisTable
        produtos={produtos}
        tabelas={tabelas}
        perfilA={perfilA}
        perfilB={perfilB}
      />
    </div>
  );
}
