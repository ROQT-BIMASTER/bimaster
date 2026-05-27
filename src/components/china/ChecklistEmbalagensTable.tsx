import { useState, useRef } from "react";
import { Plus, X, Pencil, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { uploadAndGetSignedUrl, getSignedUrl } from "@/lib/utils/storage-helper";
import { toast } from "sonner";
import { useChinaI18n } from "@/hooks/useChinaI18n";
import { cn } from "@/lib/utils";
import type { ChecklistColuna, ChecklistCelula } from "@/hooks/useChinaProdutoChecklist";
import { useConfirm } from "@/hooks/useConfirm";

interface CorRow {
  id: string;
  cor_nome: string;
  cor_hex: string | null;
  codigo_produto: string | null;
}

interface Props {
  submissaoId: string;
  checklistId: string;
  cores: CorRow[];
  colunas: ChecklistColuna[];
  celulas: ChecklistCelula[];
  readOnly?: boolean;
  onAddColuna: (col: ChecklistColuna) => void;
  onRemoveColuna: (key: string) => void;
  onRenameColuna: (key: string, label_pt: string, label_cn: string) => void;
  onToggleCelula: (corId: string, colunaKey: string, marcado: boolean) => void;
  onSetMockup: (corId: string, path: string | null) => void;
}

const MOCKUP_KEY = "__mockup__";

export function ChecklistEmbalagensTable({
  submissaoId,
  checklistId,
  cores,
  colunas,
  celulas,
  readOnly,
  onAddColuna,
  onRemoveColuna,
  onRenameColuna,
  onToggleCelula,
  onSetMockup,
}: Props) {
  const { t } = useChinaI18n();
  const [addOpen, setAddOpen] = useState(false);
  const [newCol, setNewCol] = useState({ pt: "", cn: "" });
  const [editing, setEditing] = useState<ChecklistColuna | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [mockupUrls, setMockupUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadCor, setActiveUploadCor] = useState<string | null>(null);

  const celulaMap = new Map<string, ChecklistCelula>();
  celulas.forEach((c) => celulaMap.set(`${c.cor_id}::${c.coluna_key}`, c));

  const mockupByCor = new Map<string, string | null>();
  celulas.forEach((c) => {
    if (c.coluna_key === MOCKUP_KEY && c.mockup_path) {
      mockupByCor.set(c.cor_id, c.mockup_path);
    }
  });

  const handleAdd = () => {
    if (!newCol.pt.trim()) {
      toast.error(t("embalagensTable.errInformeNome"));
      return;
    }
    const key = newCol.pt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 32) + "_" + Math.random().toString(36).slice(2, 6);
    onAddColuna({
      key,
      label_pt: newCol.pt.trim(),
      label_cn: newCol.cn.trim(),
      ordem: colunas.length,
    });
    setAddOpen(false);
    setNewCol({ pt: "", cn: "" });
  };

  const handleSaveRename = () => {
    if (!editing) return;
    onRenameColuna(editing.key, editing.label_pt.trim(), editing.label_cn.trim());
    setEditing(null);
  };

  const triggerUpload = (corId: string) => {
    setActiveUploadCor(corId);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file || !activeUploadCor) return;
    setUploadingFor(activeUploadCor);
    try {
      const path = `${submissaoId}/checklist/mockup/${activeUploadCor}_${Date.now()}_${file.name}`;
      const { signedUrl, error } = await uploadAndGetSignedUrl("china-documentos", path, file);
      if (error) throw error;
      onSetMockup(activeUploadCor, path);
      if (signedUrl) setMockupUrls((p) => ({ ...p, [activeUploadCor]: signedUrl }));
      toast.success(t("embalagensTable.okMockupEnviado"));
    } catch (e: any) {
      toast.error(e?.message || t("embalagensTable.errUpload"));
    } finally {
      setUploadingFor(null);
      setActiveUploadCor(null);
    }
  };

  const loadMockup = async (corId: string, path: string) => {
    if (mockupUrls[corId]) return;
    const { signedUrl } = await getSignedUrl("china-documentos", path);
    if (signedUrl) setMockupUrls((p) => ({ ...p, [corId]: signedUrl }));
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          handleFileSelected(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-destructive/10 text-foreground">
            <tr>
              <th className="px-3 py-3 text-left font-semibold border-b border-r min-w-[180px] sticky left-0 bg-destructive/10 z-10">
                Produto<br /><span className="text-muted-foreground text-[10px]">产品</span>
              </th>
              <th className="px-3 py-3 text-center font-semibold border-b border-r w-[110px]">
                Mockup<br /><span className="text-muted-foreground text-[10px]">样品图</span>
              </th>
              {
              {const confirm = useConfirm();colunas.sort((a, b) => a.ordem - b.ordem).map((col) => (
                <th key={col.key} className="px-2 py-3 text-center font-semibold border-b border-r min-w-[136px]">
                  <div className="flex min-h-[70px] flex-col items-center justify-between gap-2">
                    <div className="leading-tight">
                      <div className="text-[11px] break-words">{col.label_pt}</div>
                      {col.label_cn && <div className="text-[10px] text-muted-foreground break-words">{col.label_cn}</div>}
                    </div>
                    {!readOnly && (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(col)}
                          className="h-7 px-2 gap-1 text-[10px] font-medium"
                          title={t("embalagensTable.tooltipEditarColuna")}
                          aria-label={`Editar coluna ${col.label_pt}`}
                        >
                          <Pencil className="h-3 w-3" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if ((await confirm({ title: `Remover coluna "${col.label_pt}"?`, description: `As marcações desta coluna serão apagadas.`, destructive: true }))) {
                              onRemoveColuna(col.key);
                            }
                          }}
                          className="h-7 px-2 gap-1 text-[10px] font-medium text-destructive hover:text-destructive"
                          title={t("embalagensTable.tooltipExcluirColuna")}
                          aria-label={`Excluir coluna ${col.label_pt}`}
                        >
                          <X className="h-3 w-3" />
                          Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                </th>
              ))}
              {!readOnly && (
                <th className="px-2 py-3 text-center border-b w-[60px]">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAddOpen(true)} title={t("embalagensTable.tooltipAdicionarColuna")}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {cores.length === 0 && (
              <tr>
                <td colSpan={colunas.length + 3} className="text-center py-12 text-muted-foreground">
                  Sem cores cadastradas. Adicione cores na grade do produto primeiro.
                </td>
              </tr>
            )}
            {cores.map((cor) => {
              const mockupPath = mockupByCor.get(cor.id);
              if (mockupPath) loadMockup(cor.id, mockupPath);
              return (
                <tr key={cor.id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2 border-r sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                      {cor.cor_hex && (
                        <span
                          className="h-4 w-4 rounded-full border shrink-0"
                          style={{ backgroundColor: cor.cor_hex }}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{cor.cor_nome}</div>
                        {cor.codigo_produto && (
                          <div className="text-[10px] text-muted-foreground truncate">{cor.codigo_produto}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 border-r text-center">
                    <button
                      onClick={() => !readOnly && triggerUpload(cor.id)}
                      disabled={readOnly}
                      className={cn(
                        "h-14 w-14 rounded-md border-2 border-dashed flex items-center justify-center mx-auto overflow-hidden",
                        mockupPath ? "border-success/40" : "border-muted",
                        !readOnly && "hover:border-primary cursor-pointer"
                      )}
                    >
                      {uploadingFor === cor.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : mockupUrls[cor.id] ? (
                        <img src={mockupUrls[cor.id]} alt="mockup" className="h-full w-full object-cover" />
                      ) : mockupPath ? (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  {colunas.sort((a, b) => a.ordem - b.ordem).map((col) => {
                    const cell = celulaMap.get(`${cor.id}::${col.key}`);
                    return (
                      <td key={col.key} className="px-2 py-2 border-r text-center">
                        <Checkbox
                          checked={!!cell?.marcado}
                          disabled={readOnly}
                          onCheckedChange={(v) => onToggleCelula(cor.id, col.key, !!v)}
                        />
                      </td>
                    );
                  })}
                  {!readOnly && <td className="border-r" />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add column dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("embalagensTable.dialogNovaColuna")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("embalagensTable.labelNomePt")}</Label>
              <Input value={newCol.pt} onChange={(e) => setNewCol((p) => ({ ...p, pt: e.target.value }))} placeholder={t("embalagensTable.phNomePt")} />
            </div>
            <div>
              <Label>{t("embalagensTable.labelNomeCn")}</Label>
              <Input value={newCol.cn} onChange={(e) => setNewCol((p) => ({ ...p, cn: e.target.value }))} placeholder="例如：主箱" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("embalagensTable.dialogRenomear")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>{t("embalagensTable.labelNomePtRen")}</Label>
                <Input value={editing.label_pt} onChange={(e) => setEditing({ ...editing, label_pt: e.target.value })} />
              </div>
              <div>
                <Label>Nome (CN)</Label>
                <Input value={editing.label_cn} onChange={(e) => setEditing({ ...editing, label_cn: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSaveRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
