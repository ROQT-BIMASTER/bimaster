/**
 * AprovacaoLoteDialog — homologação em lote de documentos da submissão China
 * dentro do quadro do projeto.
 *
 * Um único step-up de senha autoriza o lote; o servidor grava uma trilha
 * homologada separada para cada documento aprovado ou reprovado.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, ShieldCheck, XCircle } from "lucide-react";
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
import { docStatusLabel, docStatusTone, normalizarDecisao } from "@/lib/china/docStatus";
import {
  useDecisaoLoteHomologada,
  useProjetoChinaDocs,
} from "@/hooks/useDecisaoDocumentoChina";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projetoId: string;
}

export function AprovacaoLoteDialog({ open, onOpenChange, projetoId }: Props) {
  const { data: docs = [], isLoading } = useProjetoChinaDocs(projetoId, open);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [decisao, setDecisao] = useState<"aprovado" | "rejeitado">("aprovado");
  const [parecer, setParecer] = useState("");
  const [senha, setSenha] = useState("");
  const mutation = useDecisaoLoteHomologada();

  const pendentes = useMemo(
    () => docs.filter((d) => normalizarDecisao(d.status) !== "aprovado"),
    [docs],
  );

  useEffect(() => {
    if (!open) {
      setSelecionados([]);
      setParecer("");
      setSenha("");
      setDecisao("aprovado");
    }
  }, [open]);

  const toggle = (id: string) =>
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const todosSelecionados = pendentes.length > 0 && selecionados.length === pendentes.length;

  const parecerObrigatorio = decisao === "rejeitado";
  const disabled =
    mutation.isPending ||
    selecionados.length === 0 ||
    senha.trim().length < 6 ||
    (parecerObrigatorio && parecer.trim().length < 10);

  async function submit() {
    await mutation.mutateAsync({
      documentoIds: selecionados,
      decisao,
      senha,
      parecer,
      projetoId,
      origem: "kanban_lote",
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Homologação em lote de documentos
          </DialogTitle>
          <DialogDescription>
            Selecione os documentos, informe o parecer e confirme sua senha. Cada
            documento recebe um registro de homologação próprio, com autor, método,
            data e hora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={decisao === "aprovado" ? "default" : "outline"}
              className="h-7 gap-1.5 text-xs"
              onClick={() => setDecisao("aprovado")}
            >
              <Check className="h-3.5 w-3.5" />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant={decisao === "rejeitado" ? "destructive" : "outline"}
              className="h-7 gap-1.5 text-xs"
              onClick={() => setDecisao("rejeitado")}
            >
              <XCircle className="h-3.5 w-3.5" />
              Não aprovar
            </Button>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {selecionados.length} de {pendentes.length} selecionado(s)
            </span>
          </div>

          <div className="rounded-md border border-border">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Checkbox
                checked={todosSelecionados}
                onCheckedChange={(v) =>
                  setSelecionados(v ? pendentes.map((d) => d.documento_id) : [])
                }
                aria-label="Selecionar todos"
              />
              <span className="text-[11px] font-medium">Selecionar todos os pendentes</span>
            </div>
            <ScrollArea className="h-56">
              <div className="divide-y divide-border">
                {isLoading && (
                  <p className="px-3 py-4 text-xs text-muted-foreground">Carregando documentos…</p>
                )}
                {!isLoading && pendentes.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground">
                    Nenhum documento pendente de decisão neste projeto.
                  </p>
                )}
                {pendentes.map((d) => (
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
                decisao === "aprovado"
                  ? "Ex.: Documentos conferidos e conformes à especificação."
                  : "Descreva o motivo da reprovação (mínimo 10 caracteres)."
              }
            />
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={disabled}
            variant={decisao === "aprovado" ? "default" : "destructive"}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Homologar {selecionados.length > 0 ? `${selecionados.length} documento(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
