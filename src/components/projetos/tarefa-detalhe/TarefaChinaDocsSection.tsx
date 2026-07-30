import { useMemo } from "react";
import { useChinaDocsDaTarefa } from "@/hooks/useChinaDocsDaTarefa";
import { Badge } from "@/components/ui/badge";
import { Ship } from "lucide-react";
import { ChinaDocumentoBlock } from "./ChinaDocumentoBlock";
import { DocStatusFilterBar } from "@/components/projetos/DocStatusFilterBar";
import { normalizarDecisao, type DocDecisao } from "@/lib/china/docStatus";
import { ordenarDocs } from "@/lib/china/docSort";
import { useDocStatusFilterState } from "@/hooks/useDocStatusFilterState";

interface Props {
  tarefaId: string;
}

export function TarefaChinaDocsSection({ tarefaId }: Props) {
  const { data: docs = [], isLoading } = useChinaDocsDaTarefa(tarefaId);
  const { selected, sort, setSelected, setSort } = useDocStatusFilterState(`tarefa:${tarefaId}`);

  const counts = useMemo(() => {
    const c: Partial<Record<DocDecisao, number>> = {};
    for (const d of docs) {
      const dec = normalizarDecisao(d.status);
      c[dec] = (c[dec] || 0) + 1;
    }
    return c;
  }, [docs]);

  const visiveis = useMemo(() => {
    const filtrados =
      selected.length === 0
        ? docs
        : docs.filter((d) => selected.includes(normalizarDecisao(d.status)));
    return ordenarDocs(
      filtrados.map((d) => ({ ...d, created_at: d.doc_created_at ?? d.created_at })),
      sort,
    );
  }, [docs, selected, sort]);


  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Ship className="h-4 w-4 text-primary" />
          Documentos da China
        </h3>
        <p className="text-xs text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Ship className="h-4 w-4 text-primary" />
          Documentos da China
        </h3>
        <p className="text-xs text-muted-foreground">
          Nenhum documento da China vinculado a esta tarefa ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Ship className="h-4 w-4 text-primary" />
        Documentos da China
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{docs.length}</Badge>
      </h3>

      <DocStatusFilterBar
        counts={counts}
        selected={selected}
        onChange={setSelected}
        sort={sort}
        onSortChange={setSort}
        label="Situação"
      />


      <div className="space-y-2">
        {visiveis.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum documento nesta situação.
          </p>
        ) : (
          visiveis.map((d) => <ChinaDocumentoBlock key={d.vinculo_id} doc={d} />)
        )}
      </div>
    </div>
  );
}
