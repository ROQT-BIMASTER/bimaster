import { useState } from "react";
import { UPLOAD_MAX_BYTES } from "@/lib/upload/limits";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Send, FileText, Plus, AlertCircle, Loader2, CheckCircle2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useChecklistB2C, useUploadArquivoB2C, useEnviarDocB2C, useCriarItemB2C,
  type ChecklistB2CItem,
} from "@/hooks/useChecklistB2C";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissaoId: string | null;
}

const STATUS_LABEL: Record<ChecklistB2CItem["status"], string> = {
  pendente: "Pendente",
  em_preparacao: "Em preparação",
  enviado_china: "Enviado à China",
  recebido_china: "Recebido pela China",
  aprovado_china: "Aprovado pela China",
  devolvido_china: "Devolvido pela China",
  arquivado: "Arquivado",
};

const STATUS_TONE: Record<ChecklistB2CItem["status"], string> = {
  pendente: "bg-muted text-muted-foreground",
  em_preparacao: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  enviado_china: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  recebido_china: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  aprovado_china: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  devolvido_china: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200",
  arquivado: "bg-muted text-muted-foreground",
};

/**
 * Painel lateral do projeto-espelho: lista os itens do checklist Brasil → China,
 * permite anexar arquivo, enviar à China e adicionar itens manualmente.
 * O retorno da China (aprovado/devolvido) chega via realtime do hook.
 */
export function ChecklistB2CSheet({ open, onOpenChange, submissaoId }: Props) {
  const { data: itens = [], isLoading } = useChecklistB2C(submissaoId);
  const upload = useUploadArquivoB2C();
  const enviar = useEnviarDocB2C();
  const criar = useCriarItemB2C();
  const [addOpen, setAddOpen] = useState(false);

  const grouped = itens.reduce<Record<string, ChecklistB2CItem[]>>((acc, it) => {
    (acc[it.categoria] ||= []).push(it);
    return acc;
  }, {});

  const handlePickFile = async (item: ChecklistB2CItem) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.size > UPLOAD_MAX_BYTES) {
        alert("Arquivo acima de 20MB");
        return;
      }
      await upload.mutateAsync({ item, file: f });
    };
    input.click();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Checklist Brasil → China
          </SheetTitle>
          <SheetDescription className="text-xs">
            Documentos que o Brasil precisa enviar à China dentro desta submissão.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <p className="text-xs text-muted-foreground">
            {itens.length} {itens.length === 1 ? "item" : "itens"}
          </p>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-3 w-3" /> Adicionar item
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
            </div>
          ) : itens.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Nenhum item ainda. Use "Adicionar item" para começar, ou crie o projeto-espelho
              com um template para popular automaticamente.
            </div>
          ) : (
            <div className="p-3 space-y-4">
              {Object.entries(grouped).map(([cat, list]) => (
                <div key={cat}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {cat}
                  </p>
                  <div className="space-y-1.5">
                    {list.map((it) => (
                      <ItemRow
                        key={it.id}
                        item={it}
                        onPickFile={() => handlePickFile(it)}
                        onEnviar={() => enviar.mutate(it.id)}
                        sending={enviar.isPending}
                        uploading={upload.isPending}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>

      {addOpen && submissaoId && (
        <AdicionarItemDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onCreate={(args) => criar.mutateAsync({ submissaoId, ...args }).then(() => setAddOpen(false))}
        />
      )}
    </Sheet>
  );
}

function ItemRow({
  item, onPickFile, onEnviar, sending, uploading,
}: {
  item: ChecklistB2CItem;
  onPickFile: () => void;
  onEnviar: () => void;
  sending: boolean;
  uploading: boolean;
}) {
  const podeEnviar =
    !!item.arquivo_path &&
    ["em_preparacao", "pendente", "devolvido_china"].includes(item.status);

  return (
    <div className={cn("rounded-md border bg-card px-3 py-2", item.status === "devolvido_china" && "border-red-300")}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-medium text-foreground truncate">{item.nome_documento}</p>
            {item.obrigatorio && (
              <Badge variant="outline" className="h-4 px-1 text-[9px]">obrig.</Badge>
            )}
            <Badge className={cn("h-4 px-1.5 text-[9px] font-normal", STATUS_TONE[item.status])}>
              {STATUS_LABEL[item.status]}
            </Badge>
          </div>
          {item.descricao && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{item.descricao}</p>
          )}
          {item.arquivo_nome && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              <FileText className="inline h-3 w-3 mr-1 -mt-0.5" />
              {item.arquivo_nome}
            </p>
          )}
          {item.motivo_devolucao && item.status === "devolvido_china" && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-sm bg-red-50 dark:bg-red-950/40 p-1.5">
              <AlertCircle className="h-3 w-3 text-red-700 dark:text-red-300 mt-0.5" />
              <p className="text-[10px] text-red-900 dark:text-red-200">
                <span className="font-semibold">Devolvido:</span> {item.motivo_devolucao}
              </p>
            </div>
          )}
          {item.status === "aprovado_china" && (
            <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Aprovado pela China
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={onPickFile} disabled={uploading}>
          <Upload className="h-3 w-3" />
          {item.arquivo_path
            ? item.status === "devolvido_china"
              ? "Substituir"
              : "Trocar"
            : "Anexar"}
        </Button>
        <Button
          size="sm"
          className="h-6 text-[10px] gap-1"
          onClick={onEnviar}
          disabled={!podeEnviar || sending}
        >
          {item.status === "devolvido_china" ? <RotateCw className="h-3 w-3" /> : <Send className="h-3 w-3" />}
          {item.status === "devolvido_china" ? "Reenviar" : "Enviar à China"}
        </Button>
      </div>
    </div>
  );
}

function AdicionarItemDialog({
  open, onOpenChange, onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (args: {
    categoria: string;
    nomeDocumento: string;
    descricao?: string;
    obrigatorio?: boolean;
  }) => Promise<unknown>;
}) {
  const [categoria, setCategoria] = useState("Geral");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">Novo item Brasil → China</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Categoria</Label>
            <Input className="mt-1 h-8 text-xs" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Nome do documento</Label>
            <Input className="mt-1 h-8 text-xs" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Layout aprovado, Faca técnica" />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea className="mt-1 min-h-[60px] text-xs" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            size="sm"
            disabled={!nome.trim() || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onCreate({
                  categoria: categoria.trim() || "Geral",
                  nomeDocumento: nome.trim(),
                  descricao: descricao.trim() || undefined,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
