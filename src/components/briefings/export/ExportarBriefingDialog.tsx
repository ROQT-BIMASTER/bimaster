// src/components/briefings/export/ExportarBriefingDialog.tsx
import { useEffect, useRef, useState } from "react";
import { Download, FileText, Sheet, Loader2, BookOpen, ExternalLink, Plug, Unplug } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBriefingExport } from "@/hooks/useBriefingExport";
import { useNotionConnection, sendBriefingToNotion } from "@/hooks/useNotionConnection";
import type { Briefing, TemplateSection } from "@/hooks/useBriefingChat";
import type { BriefingExportFormato } from "@/lib/briefings/exportTypes";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  briefing: Briefing;
  sections: TemplateSection[];
  projetoNome?: string | null;
  autorNome?: string | null;
}

type Tab = "pdf" | "xlsx" | "notion";

export function ExportarBriefingDialog({
  open,
  onOpenChange,
  briefing,
  sections,
  projetoNome,
  autorNome,
}: Props) {
  const { config, setConfig, exportar, exporting, carregarPreset } = useBriefingExport({
    briefing,
    sections,
    projetoNome,
    autorNome,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("pdf");
  const { connection, connect, disconnect } = useNotionConnection();
  const [sendingNotion, setSendingNotion] = useState(false);

  useEffect(() => {
    if (open) carregarPreset();
  }, [open, carregarPreset]);

  const handleLogo = (file: File) => {
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () =>
      setConfig((c) => ({ ...c, logoDataUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const handleExport = (formato: BriefingExportFormato) => exportar(formato, config);

  const handleSendNotion = async () => {
    setSendingNotion(true);
    const tid = toast.loading("Sincronizando com o Notion...");
    try {
      const { page_url, action } = await sendBriefingToNotion(briefing.id);
      toast.success(
        action === "update" ? "Página atualizada no Notion" : "Briefing enviado para o Notion",
        {
          id: tid,
          action: page_url
            ? { label: "Abrir", onClick: () => window.open(page_url, "_blank") }
            : undefined,
        },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao enviar";
      toast.error(msg, { id: tid });
    } finally {
      setSendingNotion(false);
    }
  };

  const conn = connection.data;
  const isCanvasTab = tab !== "notion";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar briefing
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pdf">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
            </TabsTrigger>
            <TabsTrigger value="xlsx">
              <Sheet className="h-3.5 w-3.5 mr-1.5" /> Planilha
            </TabsTrigger>
            <TabsTrigger value="notion">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Notion
            </TabsTrigger>
          </TabsList>

          {isCanvasTab && (
            <div className="space-y-5 mt-5">
              <section className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                  Identidade
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="titulo" className="text-xs">Título</Label>
                    <Input
                      id="titulo"
                      value={config.titulo}
                      onChange={(e) => setConfig({ ...config, titulo: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subtitulo" className="text-xs">Subtítulo</Label>
                    <Input
                      id="subtitulo"
                      value={config.subtitulo}
                      placeholder="Opcional"
                      onChange={(e) =>
                        setConfig({ ...config, subtitulo: e.target.value })
                      }
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cor" className="text-xs">Cor primária</Label>
                    <div className="flex gap-2">
                      <Input
                        id="cor"
                        type="color"
                        value={config.corPrimaria}
                        onChange={(e) =>
                          setConfig({ ...config, corPrimaria: e.target.value })
                        }
                        className="h-9 w-14 p-1"
                      />
                      <Input
                        value={config.corPrimaria}
                        onChange={(e) =>
                          setConfig({ ...config, corPrimaria: e.target.value })
                        }
                        className="h-9 flex-1 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Tipografia</Label>
                    <Select
                      value={config.tipografia}
                      onValueChange={(v: "sans" | "serif" | "mono") =>
                        setConfig({ ...config, tipografia: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sans">Sans-serif (padrão)</SelectItem>
                        <SelectItem value="serif">Serifa</SelectItem>
                        <SelectItem value="mono">Monoespaçada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Logo (PNG, até 2 MB)</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                      >
                        {config.logoDataUrl ? "Trocar logo" : "Enviar logo"}
                      </Button>
                      {config.logoDataUrl && (
                        <>
                          <img
                            src={config.logoDataUrl}
                            alt=""
                            className="h-8 object-contain rounded border"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfig({ ...config, logoDataUrl: null })}
                          >
                            Remover
                          </Button>
                        </>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleLogo(f);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                  Conteúdo
                </h4>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  {([
                    ["resumoExecutivo", "Resumo executivo (gerado por IA)"],
                    ["camposCanvas", "Campos do canvas"],
                    ["mensagemChave", "Mensagem-chave em destaque"],
                    ["aprovacoes", "Fluxo de aprovações"],
                    ["projeto", "Projeto vinculado"],
                  ] as const).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={config.incluir[k]}
                        onCheckedChange={(c) =>
                          setConfig({
                            ...config,
                            incluir: { ...config.incluir, [k]: !!c },
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                  Saída
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Idioma</Label>
                    <Select
                      value={config.idioma}
                      onValueChange={(v: "pt" | "en" | "zh") =>
                        setConfig({ ...config, idioma: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt">Português</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh">中文</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Nível de detalhe</Label>
                    <Select
                      value={config.nivel}
                      onValueChange={(v: "executivo" | "completo" | "tecnico") =>
                        setConfig({ ...config, nivel: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="executivo">Executivo (curto)</SelectItem>
                        <SelectItem value="completo">Completo</SelectItem>
                        <SelectItem value="tecnico">Técnico (detalhado)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-2.5">
                    <Label htmlFor="pag" className="text-xs cursor-pointer">
                      Paginação
                    </Label>
                    <Switch
                      id="pag"
                      checked={config.paginacao}
                      onCheckedChange={(c) => setConfig({ ...config, paginacao: c })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-2.5">
                    <Label htmlFor="wm" className="text-xs cursor-pointer">
                      Marca d'água "Confidencial"
                    </Label>
                    <Switch
                      id="wm"
                      checked={config.marcaDagua}
                      onCheckedChange={(c) => setConfig({ ...config, marcaDagua: c })}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === "notion" && (
            <div className="space-y-4 mt-5">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <BookOpen className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <h4 className="text-sm font-semibold">Enviar para o Notion</h4>
                    <p className="text-xs text-muted-foreground">
                      Cria uma página no database <strong>Briefings bimaster</strong> do seu
                      workspace, com todos os campos do canvas, criador, datas e SLA.
                    </p>
                  </div>
                </div>

                {connection.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando conexão...
                  </div>
                ) : conn ? (
                  <div className="rounded-md border bg-background p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {conn.workspace_icon && (
                          <img
                            src={conn.workspace_icon}
                            alt=""
                            className="h-5 w-5 rounded"
                          />
                        )}
                        <div>
                          <div className="font-medium text-foreground">
                            {conn.workspace_name || "Workspace Notion"}
                          </div>
                          {conn.notion_user_name && (
                            <div className="text-muted-foreground">
                              {conn.notion_user_name}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => disconnect.mutate()}
                        disabled={disconnect.isPending}
                      >
                        <Unplug className="h-3.5 w-3.5 mr-1.5" /> Desconectar
                      </Button>
                    </div>
                    {conn.briefings_database_url && (
                      <a
                        href={conn.briefings_database_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Abrir database no Notion
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Nenhuma conta Notion conectada. Conecte para começar a enviar briefings.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => connect.mutate()}
                      disabled={connect.isPending}
                    >
                      {connect.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Plug className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Conectar Notion
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3 text-xs space-y-1.5">
                <div className="font-medium text-foreground">Será enviado:</div>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Todos os campos do briefing (espelho do canvas)</li>
                  <li>Resumo executivo + mensagem-chave (IA)</li>
                  <li>Criador, datas de criação/atualização e SLA</li>
                  <li>Status do SLA (no prazo, em risco, vencido)</li>
                  <li>Link de volta para o briefing no bimaster</li>
                </ul>
              </div>
            </div>
          )}
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {tab === "pdf" && (
            <Button onClick={() => handleExport("pdf")} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5 mr-1.5" />
              )}
              Baixar PDF
            </Button>
          )}
          {tab === "xlsx" && (
            <Button onClick={() => handleExport("xlsx")} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sheet className="h-3.5 w-3.5 mr-1.5" />
              )}
              Baixar planilha
            </Button>
          )}
          {tab === "notion" && (
            <Button onClick={handleSendNotion} disabled={!conn || sendingNotion}>
              {sendingNotion ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              )}
              Enviar para Notion
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
