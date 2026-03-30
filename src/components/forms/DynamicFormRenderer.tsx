import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, ImageIcon, Package } from "lucide-react";
import { toast } from "sonner";

interface DynamicFormRendererProps {
  formId: string;
  tokenId?: string;
  userId?: string;
  onSubmitSuccess?: (responseId: string) => void;
}

interface FieldDef {
  id: string;
  label: string;
  field_type: string;
  required: boolean;
  options: any;
  placeholder: string | null;
  validation: any;
  order_index: number;
}

export function DynamicFormRenderer({ formId, tokenId, userId, onSubmitSuccess }: DynamicFormRendererProps) {
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attachedBanners, setAttachedBanners] = useState<any[]>([]);
  const [attachedMaterials, setAttachedMaterials] = useState<any[]>([]);

  useEffect(() => {
    loadForm();
  }, [formId]);

  async function loadForm() {
    setLoading(true);
    const { data: form } = await supabase
      .from("dynamic_forms")
      .select("name, description")
      .eq("id", formId)
      .single();

    if (form) {
      setFormName(form.name);
      setFormDescription(form.description || "");
    }

    const { data: fieldData } = await supabase
      .from("dynamic_form_fields")
      .select("*")
      .eq("form_id", formId)
      .order("order_index");

    if (fieldData) {
      setFields(fieldData as any);
      const initial: Record<string, any> = {};
      fieldData.forEach((f: any) => {
        if (f.field_type === "checkbox") initial[f.id] = [];
        else initial[f.id] = "";
      });
      setValues(initial);
    }

    // Load attachments
    const { data: attData } = await supabase
      .from("dynamic_form_attachments" as any)
      .select("*")
      .eq("form_id", formId)
      .order("order_index");

    if (attData && (attData as any[]).length > 0) {
      const bannerIds = (attData as any[]).filter((a) => a.attachment_type === "banner").map((a) => a.attachment_id);
      const materialIds = (attData as any[]).filter((a) => a.attachment_type === "material").map((a) => a.attachment_id);

      if (bannerIds.length) {
        const { data: b } = await supabase.from("trade_banners").select("id, titulo, imagem_url, link_destino").in("id", bannerIds);
        setAttachedBanners(b || []);
      }
      if (materialIds.length) {
        const { data: m } = await supabase.from("trade_materiais" as any).select("id, nome, foto_url, descricao").in("id", materialIds);
        setAttachedMaterials((m || []) as any[]);
      }
    }

    setLoading(false);
  }

  function updateValue(fieldId: string, val: any) {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
  }

  function toggleCheckbox(fieldId: string, option: string) {
    setValues((prev) => {
      const current = prev[fieldId] || [];
      const next = current.includes(option)
        ? current.filter((o: string) => o !== option)
        : [...current, option];
      return { ...prev, [fieldId]: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate required fields
    for (const field of fields) {
      if (field.required) {
        const val = values[field.id];
        if (!val || (Array.isArray(val) && val.length === 0) || val === "") {
          toast.error(`O campo "${field.label}" é obrigatório`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // Create response
      const { data: response, error: respErr } = await supabase
        .from("dynamic_form_responses")
        .insert({
          form_id: formId,
          token_id: tokenId || null,
          user_id: userId || null,
          metadata: {
            submitted_at: new Date().toISOString(),
            user_agent: navigator.userAgent,
          },
        } as any)
        .select("id")
        .single();

      if (respErr) throw respErr;

      // Create answers
      const answers = fields.map((f) => ({
        response_id: response.id,
        field_id: f.id,
        value: values[f.id] ?? null,
      }));

      const { error: ansErr } = await supabase
        .from("dynamic_form_answers")
        .insert(answers as any);

      if (ansErr) throw ansErr;

      setSubmitted(true);
      toast.success("Formulário enviado com sucesso!");
      onSubmitSuccess?.(response.id);
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error("Erro ao enviar formulário");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (submitted) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
          <h2 className="text-xl font-bold">Enviado com sucesso!</h2>
          <p className="text-muted-foreground">
            Suas respostas foram registradas. Obrigado por preencher o formulário.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{formName}</CardTitle>
        {formDescription && <CardDescription>{formDescription}</CardDescription>}
      </CardHeader>
      <CardContent>
        {/* Attached Banners */}
        {attachedBanners.length > 0 && (
          <div className="mb-6">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {attachedBanners.map((b: any) => (
                <a
                  key={b.id}
                  href={b.link_destino || "#"}
                  target={b.link_destino ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <img
                    src={b.imagem_url}
                    alt={b.titulo}
                    className="h-24 rounded-lg object-cover border"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Attached Materials */}
        {attachedMaterials.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3">
            {attachedMaterials.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 border rounded-lg p-3">
                {m.foto_url ? (
                  <img src={m.foto_url} alt={m.nome} className="h-12 w-12 rounded-md object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{m.nome}</p>
                  {m.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{m.descricao}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>

              {field.field_type === "text" && (
                <Input
                  value={values[field.id] || ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                  placeholder={field.placeholder || ""}
                />
              )}

              {field.field_type === "number" && (
                <Input
                  type="number"
                  value={values[field.id] || ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                  placeholder={field.placeholder || ""}
                  min={field.validation?.min}
                  max={field.validation?.max}
                />
              )}

              {field.field_type === "price" && (
                <Input
                  type="number"
                  step="0.01"
                  value={values[field.id] || ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                  placeholder={field.placeholder || "R$ 0,00"}
                />
              )}

              {field.field_type === "date" && (
                <Input
                  type="date"
                  value={values[field.id] || ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                />
              )}

              {field.field_type === "select" && (
                <Select
                  value={values[field.id] || ""}
                  onValueChange={(v) => updateValue(field.id, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder || "Selecione"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {field.field_type === "checkbox" && (
                <div className="space-y-2">
                  {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
                    <div key={opt} className="flex items-center gap-2">
                      <Checkbox
                        checked={(values[field.id] || []).includes(opt)}
                        onCheckedChange={() => toggleCheckbox(field.id, opt)}
                      />
                      <span className="text-sm">{opt}</span>
                    </div>
                  ))}
                </div>
              )}

              {field.field_type === "file" && (
                <Input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) updateValue(field.id, file.name);
                  }}
                />
              )}

              {field.field_type === "image" && (
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) updateValue(field.id, file.name);
                  }}
                />
              )}
            </div>
          ))}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              "Enviar Formulário"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
