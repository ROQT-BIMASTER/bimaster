import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageIcon, Package, Plus, X, Link2 } from "lucide-react";

interface Attachment {
  id?: string;
  attachment_type: "banner" | "material";
  attachment_id: string;
  order_index: number;
  name?: string;
}

interface FormAttachmentsPanelProps {
  formId: string | null;
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
}

export function FormAttachmentsPanel({ formId, attachments, onChange }: FormAttachmentsPanelProps) {
  const [banners, setBanners] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<"banner" | "material">("banner");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    loadOptions();
  }, []);

  async function loadOptions() {
    const [{ data: b }, { data: m }] = await Promise.all([
      supabase.from("trade_banners").select("id, titulo").eq("ativo", true),
      supabase.from("trade_materiais" as any).select("id, nome").eq("ativo", true),
    ]);
    setBanners(b || []);
    setMaterials((m || []) as any[]);
  }

  function addAttachment() {
    if (!selectedId) return;
    if (attachments.some((a) => a.attachment_id === selectedId && a.attachment_type === selectedType)) {
      toast.info("Item já vinculado");
      return;
    }
    const options = selectedType === "banner" ? banners : materials;
    const item = options.find((o) => o.id === selectedId);
    const newAtt: Attachment = {
      attachment_type: selectedType,
      attachment_id: selectedId,
      order_index: attachments.length,
      name: selectedType === "banner" ? item?.titulo : item?.nome,
    };
    onChange([...attachments, newAtt]);
    setSelectedId("");
  }

  function removeAttachment(idx: number) {
    onChange(attachments.filter((_, i) => i !== idx));
  }

  const options = selectedType === "banner" ? banners : materials;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Vínculos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={selectedType} onValueChange={(v) => { setSelectedType(v as any); setSelectedId(""); }}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="banner">Banner</SelectItem>
              <SelectItem value="material">Material</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {selectedType === "banner" ? o.titulo : o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" variant="outline" onClick={addAttachment} disabled={!selectedId}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {att.attachment_type === "banner" ? (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="truncate max-w-[140px]">{att.name || att.attachment_id}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {att.attachment_type === "banner" ? "Banner" : "Material"}
                  </Badge>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeAttachment(idx)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {attachments.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Vincule banners ou materiais que serão exibidos junto ao formulário.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
