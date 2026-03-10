import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BilingualLabel } from "./BilingualLabel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Camera } from "lucide-react";

interface ChinaApontamentoFormProps {
  ordemId: string;
  cores: string[];
  onSuccess: () => void;
}

export function ChinaApontamentoForm({ ordemId, cores, onSuccess }: ChinaApontamentoFormProps) {
  const [corNome, setCorNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [lote, setLote] = useState("");
  const [observacao, setObservacao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!corNome || !quantidade || parseInt(quantidade) <= 0) {
      toast.error("Preencha cor e quantidade 请填写颜色和数量");
      return;
    }

    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      let fotoUrl = null;
      let fotoPath = null;

      if (foto) {
        const ext = foto.name.split(".").pop();
        const path = `producao/${ordemId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("china-documentos")
          .upload(path, foto);
        if (!upErr) {
          fotoPath = path;
        }
      }

      const { error } = await supabase
        .from("china_producao_apontamentos" as any)
        .insert({
          ordem_compra_id: ordemId,
          cor_nome: corNome,
          quantidade: parseInt(quantidade),
          lote: lote || null,
          observacao: observacao || null,
          foto_url: fotoUrl,
          foto_path: fotoPath,
          created_by: user?.id,
        } as any);

      if (error) throw error;

      // Update qty_produzida on the order
      const { data: apts } = await supabase
        .from("china_producao_apontamentos" as any)
        .select("quantidade")
        .eq("ordem_compra_id", ordemId);
      const totalProd = (apts || []).reduce((sum: number, a: any) => sum + (a.quantidade || 0), 0);
      
      await supabase
        .from("china_ordens_compra" as any)
        .update({
          qty_produzida: totalProd,
          status: totalProd > 0 ? "em_producao" : "emitida",
        } as any)
        .eq("id", ordemId);

      toast.success("Produção registrada! 生产已登记！");
      setCorNome("");
      setQuantidade("");
      setLote("");
      setObservacao("");
      setFoto(null);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 space-y-4">
      <BilingualLabel pt="Registrar Produção" cn="登记生产" size="lg" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <BilingualLabel pt="Cor" cn="颜色" size="sm" />
          <Select value={corNome} onValueChange={setCorNome}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Selecione 选择" />
            </SelectTrigger>
            <SelectContent>
              {cores.map((c) => (
                <SelectItem key={c} value={c} className="text-base">{c}</SelectItem>
              ))}
              <SelectItem value="__other" className="text-base">Outra 其他</SelectItem>
            </SelectContent>
          </Select>
          {corNome === "__other" && (
            <Input
              placeholder="Nome da cor 颜色名称"
              className="h-12 text-base"
              onChange={(e) => setCorNome(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <BilingualLabel pt="Quantidade" cn="数量" size="sm" />
          <Input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="0"
            className="h-12 text-xl font-bold text-center"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <BilingualLabel pt="Lote (opcional)" cn="批号（可选）" size="sm" />
          <Input
            value={lote}
            onChange={(e) => setLote(e.target.value)}
            placeholder="LOT-001"
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-1.5">
          <BilingualLabel pt="Foto (opcional)" cn="照片（可选）" size="sm" />
          <label className="flex items-center gap-2 h-12 px-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground truncate">
              {foto ? foto.name : "Tirar foto 拍照"}
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setFoto(e.target.files?.[0] || null)}
            />
          </label>
        </div>
      </div>

      <div className="space-y-1.5">
        <BilingualLabel pt="Observação (opcional)" cn="备注（可选）" size="sm" />
        <Textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Observações... 备注..."
          rows={2}
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full h-14 text-lg"
        size="lg"
      >
        <Plus className="h-5 w-5 mr-2" />
        {loading ? "Registrando... 登记中..." : "Registrar Produção 登记生产"}
      </Button>
    </div>
  );
}
