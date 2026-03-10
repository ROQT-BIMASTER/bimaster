import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BilingualLabel } from "./BilingualLabel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Ship, Camera, Send } from "lucide-react";

interface ChinaEmbarqueFormProps {
  ordemId: string;
  existingEmbarque?: any;
  onSuccess: () => void;
}

const PORTOS_ORIGEM = [
  "Shanghai 上海", "Shenzhen 深圳", "Ningbo 宁波", "Guangzhou 广州",
  "Qingdao 青岛", "Xiamen 厦门", "Tianjin 天津", "Dalian 大连",
];

const PORTOS_DESTINO = [
  "Santos", "Paranaguá", "Itajaí", "Rio de Janeiro", "Vitória", "Suape",
];

export function ChinaEmbarqueForm({ ordemId, existingEmbarque, onSuccess }: ChinaEmbarqueFormProps) {
  const [form, setForm] = useState({
    numero_container: existingEmbarque?.numero_container || "",
    numero_bl: existingEmbarque?.numero_bl || "",
    booking_number: existingEmbarque?.booking_number || "",
    navio: existingEmbarque?.navio || "",
    porto_origem: existingEmbarque?.porto_origem || "",
    porto_destino: existingEmbarque?.porto_destino || "",
    data_embarque: existingEmbarque?.data_embarque || "",
    data_eta: existingEmbarque?.data_eta || "",
    peso_total_kg: existingEmbarque?.peso_total_kg?.toString() || "",
    volume_cbm: existingEmbarque?.volume_cbm?.toString() || "",
    qtd_volumes: existingEmbarque?.qtd_volumes?.toString() || "",
    valor_frete_usd: existingEmbarque?.valor_frete_usd?.toString() || "",
    modalidade: existingEmbarque?.modalidade || "FCL",
    observacoes: existingEmbarque?.observacoes || "",
  });
  const [fotos, setFotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (asDraft = false) => {
    if (!asDraft && (!form.numero_container || !form.numero_bl)) {
      toast.error("Container e BL são obrigatórios 集装箱号和提单号必填");
      return;
    }

    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;

      const payload = {
        ordem_compra_id: ordemId,
        numero_container: form.numero_container || null,
        numero_bl: form.numero_bl || null,
        booking_number: form.booking_number || null,
        navio: form.navio || null,
        porto_origem: form.porto_origem || null,
        porto_destino: form.porto_destino || null,
        data_embarque: form.data_embarque || null,
        data_eta: form.data_eta || null,
        peso_total_kg: form.peso_total_kg ? parseFloat(form.peso_total_kg) : null,
        volume_cbm: form.volume_cbm ? parseFloat(form.volume_cbm) : null,
        qtd_volumes: form.qtd_volumes ? parseInt(form.qtd_volumes) : null,
        valor_frete_usd: form.valor_frete_usd ? parseFloat(form.valor_frete_usd) : null,
        modalidade: form.modalidade,
        observacoes: form.observacoes || null,
        status: asDraft ? "rascunho" : "enviado",
        created_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      let embarqueId = existingEmbarque?.id;

      if (existingEmbarque) {
        const { error } = await supabase
          .from("china_embarques" as any)
          .update(payload as any)
          .eq("id", existingEmbarque.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("china_embarques" as any)
          .insert(payload as any)
          .select("id")
          .single();
        if (error) throw error;
        embarqueId = (data as any)?.id;
      }

      // Upload fotos
      if (fotos.length > 0 && embarqueId) {
        for (const foto of fotos) {
          const ext = foto.name.split(".").pop();
          const path = `embarques/${embarqueId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("china-documentos")
            .upload(path, foto);
          if (!upErr) {
            await supabase.from("china_embarque_documentos" as any).insert({
              embarque_id: embarqueId,
              tipo: "foto",
              nome_arquivo: foto.name,
              arquivo_path: path,
            } as any);
          }
        }
      }

      // Update order status
      if (!asDraft) {
        await supabase
          .from("china_ordens_compra" as any)
          .update({ status: "embarque_enviado" } as any)
          .eq("id", ordemId);
      }

      toast.success(
        asDraft
          ? "Rascunho salvo! 草稿已保存！"
          : "Embarque enviado! 装运信息已发送！"
      );
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao registrar embarque");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 border-2 border-dashed border-blue-400/40 rounded-xl bg-blue-50/30 dark:bg-blue-950/10 space-y-5">
      <div className="flex items-center gap-3">
        <Ship className="h-6 w-6 text-blue-600" />
        <BilingualLabel pt="Dados de Embarque" cn="装运信息" size="lg" />
      </div>

      {/* Container & BL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <BilingualLabel pt="Nº Container" cn="集装箱号" size="sm" />
          <Input
            value={form.numero_container}
            onChange={(e) => updateField("numero_container", e.target.value)}
            placeholder="MSKU1234567"
            className="h-12 text-base font-mono uppercase"
          />
        </div>
        <div className="space-y-1.5">
          <BilingualLabel pt="Nº BL (Bill of Lading)" cn="提单号" size="sm" />
          <Input
            value={form.numero_bl}
            onChange={(e) => updateField("numero_bl", e.target.value)}
            placeholder="COSU6123456789"
            className="h-12 text-base font-mono uppercase"
          />
        </div>
      </div>

      {/* Booking & Navio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <BilingualLabel pt="Booking Number" cn="订舱号" size="sm" />
          <Input
            value={form.booking_number}
            onChange={(e) => updateField("booking_number", e.target.value)}
            placeholder="BK-2026-001"
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <BilingualLabel pt="Navio" cn="船名" size="sm" />
          <Input
            value={form.navio}
            onChange={(e) => updateField("navio", e.target.value)}
            placeholder="MSC OSCAR"
            className="h-12 text-base"
          />
        </div>
      </div>

      {/* Portos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <BilingualLabel pt="Porto Origem" cn="起运港" size="sm" />
          <Select value={form.porto_origem} onValueChange={(v) => updateField("porto_origem", v)}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Selecione 选择" />
            </SelectTrigger>
            <SelectContent>
              {PORTOS_ORIGEM.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <BilingualLabel pt="Porto Destino" cn="目的港" size="sm" />
          <Select value={form.porto_destino} onValueChange={(v) => updateField("porto_destino", v)}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Selecione 选择" />
            </SelectTrigger>
            <SelectContent>
              {PORTOS_DESTINO.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Datas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <BilingualLabel pt="Data Embarque" cn="装船日期" size="sm" />
          <Input
            type="date"
            value={form.data_embarque}
            onChange={(e) => updateField("data_embarque", e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <BilingualLabel pt="ETA (Previsão Chegada)" cn="预计到达日期" size="sm" />
          <Input
            type="date"
            value={form.data_eta}
            onChange={(e) => updateField("data_eta", e.target.value)}
            className="h-12 text-base"
          />
        </div>
      </div>

      {/* Peso, Volume, Qtd volumes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <BilingualLabel pt="Peso Total (kg)" cn="总重量(公斤)" size="sm" />
          <Input
            type="number"
            step="0.01"
            value={form.peso_total_kg}
            onChange={(e) => updateField("peso_total_kg", e.target.value)}
            placeholder="0.00"
            className="h-12 text-base text-center"
          />
        </div>
        <div className="space-y-1.5">
          <BilingualLabel pt="Volume (CBM)" cn="体积(立方米)" size="sm" />
          <Input
            type="number"
            step="0.001"
            value={form.volume_cbm}
            onChange={(e) => updateField("volume_cbm", e.target.value)}
            placeholder="0.000"
            className="h-12 text-base text-center"
          />
        </div>
        <div className="space-y-1.5">
          <BilingualLabel pt="Qtd Volumes" cn="件数" size="sm" />
          <Input
            type="number"
            value={form.qtd_volumes}
            onChange={(e) => updateField("qtd_volumes", e.target.value)}
            placeholder="0"
            className="h-12 text-base text-center"
          />
        </div>
      </div>

      {/* Modalidade & Frete */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <BilingualLabel pt="Modalidade" cn="运输方式" size="sm" />
          <Select value={form.modalidade} onValueChange={(v) => updateField("modalidade", v)}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FCL">FCL (Full Container)</SelectItem>
              <SelectItem value="LCL">LCL (Less Container)</SelectItem>
              <SelectItem value="aereo">Aéreo 空运</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <BilingualLabel pt="Frete (USD)" cn="运费(美元)" size="sm" />
          <Input
            type="number"
            step="0.01"
            value={form.valor_frete_usd}
            onChange={(e) => updateField("valor_frete_usd", e.target.value)}
            placeholder="0.00"
            className="h-12 text-base text-center"
          />
        </div>
      </div>

      {/* Fotos */}
      <div className="space-y-1.5">
        <BilingualLabel pt="Fotos do Container / Documentos" cn="集装箱照片/文件" size="sm" />
        <label className="flex items-center gap-2 h-12 px-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
          <Camera className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground truncate">
            {fotos.length > 0 ? `${fotos.length} arquivo(s) selecionado(s)` : "Adicionar fotos/docs 添加照片/文件"}
          </span>
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={(e) => setFotos(Array.from(e.target.files || []))}
          />
        </label>
        {fotos.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {fotos.map((f, i) => (
              <span key={i} className="text-xs bg-secondary px-2 py-0.5 rounded">{f.name}</span>
            ))}
          </div>
        )}
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <BilingualLabel pt="Observações" cn="备注" size="sm" />
        <Textarea
          value={form.observacoes}
          onChange={(e) => updateField("observacoes", e.target.value)}
          placeholder="Observações sobre o embarque... 装运备注..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={loading}
          className="flex-1 h-12"
        >
          {loading ? "Salvando..." : "Salvar Rascunho 保存草稿"}
        </Button>
        <Button
          onClick={() => handleSubmit(false)}
          disabled={loading}
          className="flex-1 h-14 text-lg bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          <Send className="h-5 w-5 mr-2" />
          {loading ? "Enviando... 发送中..." : "Enviar Embarque 发送装运"}
        </Button>
      </div>
    </div>
  );
}
