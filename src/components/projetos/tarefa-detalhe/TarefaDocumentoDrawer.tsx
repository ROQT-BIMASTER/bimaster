/**
 * TarefaDocumentoDrawer — painel administrativo do documento dentro da tarefa
 * do projeto (Kanban / detalhe da tarefa).
 *
 * Replica a experiência do módulo China:
 *  - Documento    : pré-visualização, download e controle de status
 *                   (pendente / em análise / aprovado / não aprovado)
 *  - Pareceres    : histórico de rodadas + ações com parecer técnico
 *  - Comentários  : conversa administrativa com menções
 *  - Homologação  : trilha de quem aprovou, por qual método, data e hora
 *
 * Toda aprovação exige confirmação de senha e é gravada em
 * `china_doc_aprovacoes_audit`; o status atualizado reflete no módulo China,
 * no Vincular China e em qualquer tela que leia o fluxo do checklist.
 */
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Download, Eye, FileText, Loader2, RotateCcw, Search, ShieldCheck, XCircle, Clock } from "lucide-react";
import { exportHomologacaoPdf } from "@/lib/china/exportHomologacaoPdf";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChinaDocPreviewDialog } from "@/components/china/ChinaDocPreviewDialog";
import { ChecklistItemAdminPanel } from "@/components/china/checklist/ChecklistItemAdminPanel";
import { ConfirmarAprovacaoDialog } from "@/components/security/ConfirmarAprovacaoDialog";
import { ReabrirDocumentoDialog } from "@/components/security/ReabrirDocumentoDialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DECISAO_LABEL,
  TRILHA_SORT_OPTIONS,
  filtrarOrdenarTrilha,
  type TrilhaSortKey,
} from "@/lib/china/homologacaoFilter";
import { bucketForDoc } from "@/lib/china/flowTones";
import { docStatusLabel, docStatusTone } from "@/lib/china/docStatus";
import {
  useDefinirStatusDocumento,
  useDocAprovacoesAudit,
} from "@/hooks/useDecisaoDocumentoChina";
import type { ChinaDocDaTarefa } from "@/hooks/useChinaDocsDaTarefa";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doc: ChinaDocDaTarefa;
}

export function TarefaDocumentoDrawer({ open, onOpenChange, doc }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [decisao, setDecisao] = useState<"aprovado" | "rejeitado">("aprovado");
  const [reabrirOpen, setReabrirOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [trilhaSort, setTrilhaSort] = useState<TrilhaSortKey>("data_desc");

  const definirStatus = useDefinirStatusDocumento();
  const { data: trilha = [], isLoading: trilhaLoading } = useDocAprovacoesAudit(
    open ? doc.documento_id : undefined,
  );

  const status = doc.status || "rascunho";
  const aprovado = status === "aprovado";
  const homologado = status === "aprovado" || status === "rejeitado";
  const trilhaVisivel = useMemo(
    () => filtrarOrdenarTrilha(trilha, busca, trilhaSort),
    [trilha, busca, trilhaSort],
  );
  const label = doc.nome_arquivo || doc.tipo_documento;

  const abrirDecisao = (d: "aprovado" | "rejeitado") => {
    setDecisao(d);
    setConfirmOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="space-y-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              <span className="truncate">{label}</span>
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] h-4">
                {doc.tipo_documento}
              </Badge>
              <Badge className={`text-[10px] h-4 ${docStatusTone(status)}`}>
                {docStatusLabel(status)}
              </Badge>
              {(doc.produto_codigo || doc.produto_nome) && (
                <span className="text-[11px] text-muted-foreground">
                  {doc.produto_codigo} · {doc.produto_nome}
                </span>
              )}
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="documento" className="mt-4">
            <TabsList className="grid h-8 w-full grid-cols-3">
              <TabsTrigger value="documento" className="h-7 text-[11px]">
                Documento
              </TabsTrigger>
              <TabsTrigger value="admin" className="h-7 text-[11px]">
                Pareceres
              </TabsTrigger>
              <TabsTrigger value="homologacao" className="h-7 text-[11px]">
                Homologação
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documento" className="mt-3 space-y-3">
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setPreviewOpen(true)}
                disabled={!doc.arquivo_path && !doc.arquivo_url}
              >
                <Eye className="h-3.5 w-3.5" />
                Visualizar documento
              </Button>

              <Separator />

              <div className="space-y-2 rounded-md border border-border bg-card/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Status administrativo
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    disabled={definirStatus.isPending || aprovado || status === "em_analise"}
                    onClick={() =>
                      definirStatus.mutate({
                        documentoId: doc.documento_id,
                        status: "em_analise",
                        tarefaId: doc.tarefa_id,
                        projetoId: doc.projeto_id,
                        origem: "tarefa",
                      })
                    }
                  >
                    {definirStatus.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                    Em análise
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    disabled={definirStatus.isPending || aprovado || status === "pendente"}
                    onClick={() =>
                      definirStatus.mutate({
                        documentoId: doc.documento_id,
                        status: "pendente",
                        tarefaId: doc.tarefa_id,
                        projetoId: doc.projeto_id,
                        origem: "tarefa",
                      })
                    }
                  >
                    Pendente de aprovação
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    disabled={aprovado}
                    onClick={() => abrirDecisao("aprovado")}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => abrirDecisao("rejeitado")}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Não aprovar
                  </Button>
                  {homologado && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => setReabrirOpen(true)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reabrir para nova análise
                    </Button>
                  )}
                </div>
                <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  Aprovar, reprovar ou reabrir exige confirmação de senha e gera
                  registro homologado com usuário, data e hora. A reabertura mantém
                  a decisão anterior na trilha.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="admin" className="mt-3">
              <ChecklistItemAdminPanel
                documentoId={doc.documento_id}
                submissaoId={doc.submissao_id}
                tipoDocumento={doc.tipo_documento}
                tipoDocumentoLabel={label}
                bucket={bucketForDoc({ doc_status: status })}
                lado="brasil"
                isReceiver
                isSender={false}
              />
            </TabsContent>

            <TabsContent value="homologacao" className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative min-w-[150px] flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por documento, autor ou data"
                    className="h-7 pl-7 text-xs"
                  />
                </div>
                <Select
                  value={trilhaSort}
                  onValueChange={(v) => setTrilhaSort(v as TrilhaSortKey)}
                >
                  <SelectTrigger className="h-7 w-[168px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRILHA_SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {trilhaVisivel.length} de {trilha.length} registro(s) de homologação
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  disabled={trilhaVisivel.length === 0}
                  onClick={() =>
                    exportHomologacaoPdf(trilhaVisivel, {
                      documentoLabel: label,
                      tipoDocumento: doc.tipo_documento,
                      produto: [doc.produto_codigo, doc.produto_nome].filter(Boolean).join(" · "),
                      statusAtual: status,
                      busca: busca.trim() || null,
                      ordenacao:
                        TRILHA_SORT_OPTIONS.find((o) => o.value === trilhaSort)?.label || null,
                    })
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar PDF
                </Button>
              </div>
              {trilhaLoading && (
                <p className="text-xs text-muted-foreground">Carregando trilha…</p>
              )}
              {!trilhaLoading && trilha.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma decisão homologada registrada para este documento.
                </p>
              )}
              {!trilhaLoading && trilha.length > 0 && trilhaVisivel.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum registro encontrado para esta busca.
                </p>
              )}

              {trilhaVisivel.map((t) => (
                <div key={t.id} className="rounded-md border border-border bg-card/40 p-2.5">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] h-4 ${docStatusTone(t.decisao)}`}>
                      {DECISAO_LABEL[t.decisao] || t.decisao}
                    </Badge>
                    <span className="text-[11px] font-medium">
                      {t.decidido_por_nome || t.decidido_por_email || "Usuário"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    {format(new Date(t.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })} ·
                    confirmação por {t.metodo_confirmacao === "senha" ? "senha" : "sessão"}
                    {t.origem ? ` · origem ${t.origem}` : ""}
                  </p>
                  {t.parecer && (
                    <p className="mt-1 whitespace-pre-wrap text-[11px]">{t.parecer}</p>
                  )}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <ChinaDocPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        arquivoPath={doc.arquivo_path}
        arquivoUrl={doc.arquivo_url}
        nomeArquivo={doc.nome_arquivo}
        tipoDocumento={doc.tipo_documento}
      />

      <ConfirmarAprovacaoDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        documentoId={doc.documento_id}
        decisao={decisao}
        documentoLabel={label}
        tarefaId={doc.tarefa_id}
        projetoId={doc.projeto_id}
        origem="tarefa"
      />

      <ReabrirDocumentoDialog
        open={reabrirOpen}
        onOpenChange={setReabrirOpen}
        documentoId={doc.documento_id}
        documentoLabel={label}
        statusAtual={status}
        tarefaId={doc.tarefa_id}
        projetoId={doc.projeto_id}
        origem="tarefa"
      />
    </>
  );
}
