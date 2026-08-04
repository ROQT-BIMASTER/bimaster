/**
 * AprovacaoLoteDialog — ações em lote sobre documentos da submissão China
 * dentro do quadro do projeto.
 *
 * Ações disponíveis:
 * - Em análise / Pendente de aprovação: mudança de situação auditada, sem senha.
 * - Aprovar / Não aprovar: exigem um único step-up de senha; o servidor grava
 *   uma trilha homologada separada para cada documento.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  FileWarning,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_CATEGORIES } from "@/lib/china-document-types";
import {
  docStatusLabel,
  docStatusTone,
  docStatusVisual,

  normalizarDecisao,
  type DocDecisao,
} from "@/lib/china/docStatus";
import { ordenarDocs, type DocSortKey } from "@/lib/china/docSort";
import {
  useDecisaoLoteHomologada,
  useProjetoChinaDocs,
  useStatusLoteDocumentos,
} from "@/hooks/useDecisaoDocumentoChina";

type Acao = "aprovado" | "rejeitado" | "em_analise" | "pendente";

const ACOES: Array<{ value: Acao; label: string; icon: typeof Check; senha: boolean }> = [
  { value: "em_analise", label: "Em análise", icon: Clock, senha: false },
  { value: "pendente", label: "Pendente de aprovação", icon: FileWarning, senha: false },
  { value: "aprovado", label: "Aprovar", icon: Check, senha: true },
  { value: "rejeitado", label: "Não aprovar", icon: XCircle, senha: true },
];

const SEM_CATEGORIA = "__outros__";
const SEM_COLUNA = "__sem_coluna__";

/** tipo_documento → chave da categoria (montado uma vez). */
const TIPO_PARA_CATEGORIA: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const cat of DOCUMENT_CATEGORIES) {
    for (const tipo of cat.tipos) map[tipo] = cat.key;
  }
  return map;
})();

const CATEGORIA_LABEL: Record<string, string> = (() => {
  const map: Record<string, string> = { [SEM_CATEGORIA]: "Outros" };
  for (const cat of DOCUMENT_CATEGORIES) map[cat.key] = cat.labelPt;
  return map;
})();

interface OpcaoFiltro {
  value: string;
  label: string;
  count: number;
}

/** Popover de seleção múltipla com contagem por opção. */
function FiltroMulti({
  label,
  opcoes,
  selecionados,
  onChange,
  busca = false,
}: {
  label: string;
  opcoes: OpcaoFiltro[];
  selecionados: string[];
  onChange: (v: string[]) => void;
  busca?: boolean;
}) {
  const [termo, setTermo] = useState("");
  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase();
    if (!t) return opcoes;
    return opcoes.filter((o) => o.label.toLowerCase().includes(t));
  }, [opcoes, termo]);

  const toggle = (value: string) =>
    onChange(
      selecionados.includes(value)
        ? selecionados.filter((v) => v !== value)
        : [...selecionados, value],
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={selecionados.length > 0 ? "secondary" : "outline"}
          className="h-7 gap-1.5 text-[11px]"
        >
          {label}
          {selecionados.length > 0 && (
            <Badge className="h-4 px-1 text-[10px]">{selecionados.length}</Badge>
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        {busca && (
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar…"
            className="mb-2 h-7 text-xs"
          />
        )}
        <ScrollArea className="max-h-56">
          <div className="space-y-0.5 pr-2">
            {visiveis.length === 0 && (
              <p className="px-1 py-2 text-[11px] text-muted-foreground">Nenhuma opção.</p>
            )}
            {visiveis.map((o) => (
              <label
                key={o.value}
                className={`flex items-center gap-2 rounded px-1 py-1 text-[11px] ${
                  o.count === 0 ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={selecionados.includes(o.value)}
                  disabled={o.count === 0 && !selecionados.includes(o.value)}
                  onCheckedChange={() => toggle(o.value)}
                />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                <span className="text-[10px] text-muted-foreground">{o.count}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projetoId: string;
  /** Restringe a lista às tarefas visíveis no quadro filtrado. */
  tarefaIds?: string[];
  /** Tarefas visíveis no quadro, com a coluna (seção) a que pertencem. */
  tarefas?: Array<{ id: string; titulo: string; secao_id: string }>;
  /** Colunas do quadro. */
  secoes?: Array<{ id: string; nome: string }>;
  /** Situações selecionadas no filtro do quadro. */
  statusFiltro?: DocDecisao[];
  /** Ordenação por data aplicada no quadro. */
  sort?: DocSortKey;
}


export function AprovacaoLoteDialog({
  open,
  onOpenChange,
  projetoId,
  tarefaIds,
  tarefas = [],
  secoes = [],
  statusFiltro = [],
  sort = "none",
}: Props) {
  const { data: docs = [], isLoading } = useProjetoChinaDocs(projetoId, open);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [acao, setAcao] = useState<Acao>("aprovado");
  const [parecer, setParecer] = useState("");
  const [senha, setSenha] = useState("");
  const [colunasFiltro, setColunasFiltro] = useState<string[]>([]);
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([]);
  const [tarefasFiltro, setTarefasFiltro] = useState<string[]>([]);
  const homologar = useDecisaoLoteHomologada();
  const mudarStatus = useStatusLoteDocumentos();
  const pending = homologar.isPending || mudarStatus.isPending;

  const exigeSenha = acao === "aprovado" || acao === "rejeitado";

  const tarefaSecao = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tarefas) m.set(t.id, t.secao_id);
    return m;
  }, [tarefas]);

  const secaoNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of secoes) m.set(s.id, s.nome);
    return m;
  }, [secoes]);

  const categoriaDe = (tipo: string) => TIPO_PARA_CATEGORIA[tipo] ?? SEM_CATEGORIA;
  const colunaDe = (tarefaId: string) => tarefaSecao.get(tarefaId) ?? SEM_COLUNA;

  /** Base do lote: escopo do quadro + situação alvo, antes dos filtros locais. */
  const base = useMemo(() => {
    let lista = docs;
    if (tarefaIds && tarefaIds.length > 0) {
      const set = new Set(tarefaIds);
      lista = lista.filter((d) => set.has(d.tarefa_id));
    }
    if (statusFiltro.length > 0) {
      lista = lista.filter((d) => statusFiltro.includes(normalizarDecisao(d.status)));
    }
    // Não faz sentido reaplicar a mesma situação já vigente.
    return lista.filter((d) => normalizarDecisao(d.status) !== acao);
  }, [docs, tarefaIds, statusFiltro, acao]);

  const elegiveis = useMemo(() => {
    let lista = base;
    if (colunasFiltro.length > 0) {
      lista = lista.filter((d) => colunasFiltro.includes(colunaDe(d.tarefa_id)));
    }
    if (categoriasFiltro.length > 0) {
      lista = lista.filter((d) => categoriasFiltro.includes(categoriaDe(d.tipo_documento)));
    }
    if (tarefasFiltro.length > 0) {
      lista = lista.filter((d) => tarefasFiltro.includes(d.tarefa_id));
    }
    return ordenarDocs(lista, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, colunasFiltro, categoriasFiltro, tarefasFiltro, sort, tarefaSecao]);

  /** Contagens por opção considerando os demais filtros ativos. */
  const contar = (
    keyFn: (d: (typeof base)[number]) => string,
    ignorar: "coluna" | "categoria" | "tarefa",
  ) => {
    const c = new Map<string, number>();
    for (const d of base) {
      if (ignorar !== "coluna" && colunasFiltro.length > 0 && !colunasFiltro.includes(colunaDe(d.tarefa_id)))
        continue;
      if (
        ignorar !== "categoria" &&
        categoriasFiltro.length > 0 &&
        !categoriasFiltro.includes(categoriaDe(d.tipo_documento))
      )
        continue;
      if (ignorar !== "tarefa" && tarefasFiltro.length > 0 && !tarefasFiltro.includes(d.tarefa_id))
        continue;
      const k = keyFn(d);
      c.set(k, (c.get(k) || 0) + 1);
    }
    return c;
  };

  const opcoesColuna = useMemo(() => {
    const c = contar((d) => colunaDe(d.tarefa_id), "coluna");
    const opts: OpcaoFiltro[] = secoes.map((s) => ({
      value: s.id,
      label: s.nome,
      count: c.get(s.id) || 0,
    }));
    if (c.get(SEM_COLUNA)) opts.push({ value: SEM_COLUNA, label: "Sem coluna", count: c.get(SEM_COLUNA)! });
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, secoes, colunasFiltro, categoriasFiltro, tarefasFiltro, tarefaSecao]);

  const opcoesCategoria = useMemo(() => {
    const c = contar((d) => categoriaDe(d.tipo_documento), "categoria");
    return [...c.keys()]
      .map((k) => ({ value: k, label: CATEGORIA_LABEL[k] ?? k, count: c.get(k)! }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, colunasFiltro, categoriasFiltro, tarefasFiltro, tarefaSecao]);

  const opcoesTarefa = useMemo(() => {
    const c = contar((d) => d.tarefa_id, "tarefa");
    const titulos = new Map<string, string>();
    for (const d of base) titulos.set(d.tarefa_id, d.tarefa_titulo || "Sem tarefa");
    return [...c.keys()]
      .map((k) => ({ value: k, label: titulos.get(k) || "Sem tarefa", count: c.get(k)! }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, colunasFiltro, categoriasFiltro, tarefasFiltro, tarefaSecao]);

  const filtrosAtivos =
    colunasFiltro.length > 0 || categoriasFiltro.length > 0 || tarefasFiltro.length > 0;

  const limparFiltros = () => {
    setColunasFiltro([]);
    setCategoriasFiltro([]);
    setTarefasFiltro([]);
  };

  useEffect(() => {
    if (!open) {
      setSelecionados((prev) => (prev.length === 0 ? prev : []));
      setParecer("");
      setSenha("");
      setAcao("aprovado");
      setColunasFiltro([]);
      setCategoriasFiltro([]);
      setTarefasFiltro([]);
    }
  }, [open]);



  // Remove da seleção itens que saíram da lista elegível ao trocar de ação.
  // Mantém a mesma referência quando nada muda, evitando loop de renderização.
  useEffect(() => {
    const ids = new Set(elegiveis.map((d) => d.documento_id));
    setSelecionados((prev) => {
      const proximo = prev.filter((id) => ids.has(id));
      return proximo.length === prev.length ? prev : proximo;
    });
  }, [elegiveis]);


  const toggle = (id: string) =>
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const todosSelecionados = elegiveis.length > 0 && selecionados.length === elegiveis.length;

  const parecerObrigatorio = acao === "rejeitado";
  const disabled =
    pending ||
    selecionados.length === 0 ||
    (exigeSenha && senha.trim().length < 6) ||
    (parecerObrigatorio && parecer.trim().length < 10);

  async function submit() {
    if (exigeSenha) {
      await homologar.mutateAsync({
        documentoIds: selecionados,
        decisao: acao as "aprovado" | "rejeitado",
        senha,
        parecer,
        projetoId,
        origem: "kanban_lote",
      });
    } else {
      await mudarStatus.mutateAsync({
        documentoIds: selecionados,
        status: acao as "em_analise" | "pendente",
        projetoId,
        origem: "kanban_lote",
      });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Ações em lote nos documentos
          </DialogTitle>
          <DialogDescription>
            Escolha a ação, selecione os documentos e confirme. Aprovar ou não aprovar
            exige senha e gera um registro de homologação próprio por documento, com
            autor, método, data e hora.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
          <div className="flex flex-wrap items-center gap-2">
            {ACOES.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                size="sm"
                variant={
                  acao === value ? (value === "rejeitado" ? "destructive" : "default") : "outline"
                }
                className="h-7 gap-1.5 text-xs"
                onClick={() => setAcao(value)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {selecionados.length} de {elegiveis.length} selecionado(s)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FiltroMulti
              label="Coluna do Kanban"
              opcoes={opcoesColuna}
              selecionados={colunasFiltro}
              onChange={setColunasFiltro}
            />
            <FiltroMulti
              label="Categoria"
              opcoes={opcoesCategoria}
              selecionados={categoriasFiltro}
              onChange={setCategoriasFiltro}
              busca
            />
            <FiltroMulti
              label="Tarefa"
              opcoes={opcoesTarefa}
              selecionados={tarefasFiltro}
              onChange={setTarefasFiltro}
              busca
            />
            {filtrosAtivos && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={limparFiltros}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {(tarefaIds?.length || statusFiltro.length > 0 || filtrosAtivos) && (
            <p className="text-[11px] text-muted-foreground">
              Lista restrita ao quadro filtrado atualmente exibido
              {filtrosAtivos
                ? ` · ${elegiveis.length} de ${base.length} documento(s) após os filtros desta janela`
                : ""}
              .
            </p>
          )}


          <div className="rounded-md border border-border">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Checkbox
                checked={todosSelecionados}
                onCheckedChange={(v) =>
                  setSelecionados(v ? elegiveis.map((d) => d.documento_id) : [])
                }
                aria-label="Selecionar todos"
              />
              <span className="text-[11px] font-medium">Selecionar todos os elegíveis</span>
            </div>
            <ScrollArea className="h-56">
              <div className="divide-y divide-border">
                {isLoading && (
                  <p className="px-3 py-4 text-xs text-muted-foreground">Carregando documentos…</p>
                )}
                {!isLoading && elegiveis.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground">
                    Nenhum documento elegível para esta ação no escopo atual.
                  </p>
                )}
                {elegiveis.map((d) => {
                  const visual = docStatusVisual(d.status);
                  return (
                    <label
                      key={d.documento_id}
                      className={`flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-muted/40 ${visual.border}`}
                    >
                      <Checkbox
                        checked={selecionados.includes(d.documento_id)}
                        onCheckedChange={() => toggle(d.documento_id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                          {d.nome_arquivo || d.tipo_documento}
                        </span>
                        <span className="block truncate text-[10.5px] text-muted-foreground">
                          {secaoNome.get(colunaDe(d.tarefa_id)) || "Sem coluna"} ·{" "}
                          {d.tarefa_titulo || "Sem tarefa"} ·{" "}
                          {CATEGORIA_LABEL[categoriaDe(d.tipo_documento)]} · {d.tipo_documento}
                        </span>
                      </span>
                      <Badge
                        variant="outline"
                        className={`h-4 gap-1 text-[10px] ${visual.badge}`}
                      >
                        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${visual.dot}`} />
                        {docStatusLabel(d.status)}
                      </Badge>
                    </label>
                  );
                })}

              </div>
            </ScrollArea>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Parecer {parecerObrigatorio ? "*" : "(opcional)"}
            </Label>
            <Textarea
              value={parecer}
              onChange={(e) => setParecer(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder={
                acao === "rejeitado"
                  ? "Descreva o motivo da reprovação (mínimo 10 caracteres)."
                  : "Ex.: Documentos conferidos e conformes à especificação."
              }
            />
          </div>

          {exigeSenha && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Confirme sua senha *
              </Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha do seu usuário"
              />
              <p className="text-[11px] text-muted-foreground">
                A senha é validada no servidor e autoriza apenas este lote.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={disabled}
            variant={acao === "rejeitado" ? "destructive" : "default"}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar {selecionados.length > 0 ? `a ${selecionados.length} documento(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
