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
import { Check, Clock, FileWarning, Loader2, ShieldCheck, XCircle } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  docStatusLabel,
  docStatusTone,
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projetoId: string;
  /** Restringe a lista às tarefas visíveis no quadro filtrado. */
  tarefaIds?: string[];
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
  statusFiltro = [],
  sort = "none",
}: Props) {
  const { data: docs = [], isLoading } = useProjetoChinaDocs(projetoId, open);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [acao, setAcao] = useState<Acao>("aprovado");
  const [parecer, setParecer] = useState("");
  const [senha, setSenha] = useState("");
  const homologar = useDecisaoLoteHomologada();
  const mudarStatus = useStatusLoteDocumentos();
  const pending = homologar.isPending || mudarStatus.isPending;

  const exigeSenha = acao === "aprovado" || acao === "rejeitado";

  const elegiveis = useMemo(() => {
    let lista = docs;
    if (tarefaIds && tarefaIds.length > 0) {
      const set = new Set(tarefaIds);
      lista = lista.filter((d) => set.has(d.tarefa_id));
    }
    if (statusFiltro.length > 0) {
      lista = lista.filter((d) => statusFiltro.includes(normalizarDecisao(d.status)));
    }
    // Não faz sentido reaplicar a mesma situação já vigente.
    lista = lista.filter((d) => normalizarDecisao(d.status) !== acao);
    return ordenarDocs(lista, sort);
  }, [docs, tarefaIds, statusFiltro, acao, sort]);

  useEffect(() => {
    if (!open) {
      setSelecionados((prev) => (prev.length === 0 ? prev : []));
      setParecer("");
      setSenha("");
      setAcao("aprovado");
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
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

        <div className="space-y-3">
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

          {(tarefaIds?.length || statusFiltro.length > 0) && (
            <p className="text-[11px] text-muted-foreground">
              Lista restrita ao quadro filtrado atualmente exibido.
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
                {elegiveis.map((d) => (
                  <label
                    key={d.documento_id}
                    className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-muted/40"
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
                        {d.tarefa_titulo || "Sem tarefa"} · {d.tipo_documento}
                      </span>
                    </span>
                    <Badge className={`h-4 text-[10px] ${docStatusTone(d.status)}`}>
                      {docStatusLabel(d.status)}
                    </Badge>
                  </label>
                ))}
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
