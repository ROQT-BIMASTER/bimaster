import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AggInsumoFornecedor } from "@/lib/fabrica/consolidado-utils";

interface Props {
  grupo: AggInsumoFornecedor | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function DialogPadronizar({ grupo, open, onOpenChange, onSuccess }: Props) {
  const [codigoModo, setCodigoModo] = useState<"existente" | "novo">("existente");
  const [codigoExistente, setCodigoExistente] = useState<string>("");
  const [codigoNovo, setCodigoNovo] = useState<string>("");
  const [nomeCanonico, setNomeCanonico] = useState<string>("");
  const [vincularMp, setVincularMp] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reset quando o grupo muda
  if (grupo && nomeCanonico === "" && codigoExistente === "") {
    setNomeCanonico(grupo.insumoNome || "");
    setCodigoExistente(grupo.codigos[0] || "");
  }

  function reset() {
    setCodigoModo("existente");
    setCodigoExistente("");
    setCodigoNovo("");
    setNomeCanonico("");
    setVincularMp(true);
  }

  async function handleConfirm() {
    if (!grupo) return;
    const codigoFinal = (codigoModo === "existente" ? codigoExistente : codigoNovo).trim();
    const nomeFinal = nomeCanonico.trim();
    if (!codigoFinal) {
      toast.error("Informe o código canônico");
      return;
    }
    if (!nomeFinal) {
      toast.error("Informe a descrição canônica");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("rpc_padronizar_insumo_duplicado", {
        _codigos_origem: grupo.codigos,
        _fornecedor_origem: grupo.fornecedor,
        _codigo_canonico: codigoFinal,
        _nome_canonico: nomeFinal,
        _vincular_mp: vincularMp,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      toast.success(`Padronização concluída — ${row?.linhas_atualizadas ?? 0} linha(s) atualizadas`);
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao padronizar");
    } finally {
      setSaving(false);
    }
  }

  if (!grupo) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Padronizar insumo</DialogTitle>
          <DialogDescription>
            Unifica os {grupo.codigos.length} códigos diferentes para o mesmo insumo no fornecedor{" "}
            <strong>{grupo.fornecedor}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <Alert variant="default" className="border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">
              Esta ação reescreve <strong>todas</strong> as fichas de custo afetadas. O código original
              de cada linha é preservado em <code>codigo_fornecedor</code> para auditoria.
            </AlertDescription>
          </Alert>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Códigos atuais</Label>
            <div className="mt-1 flex flex-wrap gap-1 font-mono text-xs">
              {grupo.codigos.map((c) => (
                <span key={c} className="px-1.5 py-0.5 rounded bg-muted">{c || "—"}</span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Código canônico</Label>
            <RadioGroup value={codigoModo} onValueChange={(v) => setCodigoModo(v as "existente" | "novo")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="existente" id="r-exist" />
                <Label htmlFor="r-exist" className="font-normal cursor-pointer">Usar um dos existentes</Label>
              </div>
              {codigoModo === "existente" && (
                <select
                  className="ml-6 w-full max-w-xs border rounded px-2 py-1 text-sm font-mono"
                  value={codigoExistente}
                  onChange={(e) => setCodigoExistente(e.target.value)}
                >
                  {grupo.codigos.map((c) => (
                    <option key={c} value={c}>{c || "—"}</option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="novo" id="r-novo" />
                <Label htmlFor="r-novo" className="font-normal cursor-pointer">Criar novo código</Label>
              </div>
              {codigoModo === "novo" && (
                <Input
                  className="ml-6 max-w-xs font-mono"
                  value={codigoNovo}
                  onChange={(e) => setCodigoNovo(e.target.value)}
                  placeholder="Ex.: MP-001"
                />
              )}
            </RadioGroup>
          </div>

          <div className="space-y-1">
            <Label htmlFor="nome-canon" className="text-xs uppercase tracking-wider text-muted-foreground">
              Descrição canônica
            </Label>
            <Input
              id="nome-canon"
              value={nomeCanonico}
              onChange={(e) => setNomeCanonico(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded border p-2.5">
            <div>
              <div className="text-sm font-medium">Vincular ao cadastro de matérias-primas</div>
              <div className="text-xs text-muted-foreground">
                Cria/atualiza o registro mestre e linka todas as fichas via <code>mp_id</code>.
              </div>
            </div>
            <Switch checked={vincularMp} onCheckedChange={setVincularMp} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Padronizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
