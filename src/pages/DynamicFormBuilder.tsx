import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { FormFieldCard, type FormField } from "@/components/forms/FormFieldCard";
import { FieldConfigPanel } from "@/components/forms/FieldConfigPanel";
import { DynamicFormRenderer } from "@/components/forms/DynamicFormRenderer";
import { FormAttachmentsPanel } from "@/components/forms/FormAttachmentsPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Save, Eye, EyeOff, ArrowLeft, Loader2, Sparkles, ImagePlus, X, MessageSquare } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";


const CATEGORIES = [
  { value: "equipe", label: "Equipe" },
  { value: "pdv", label: "PDV" },
  { value: "auditoria", label: "Auditoria" },
  { value: "campanha", label: "Campanha" },
  { value: "outro", label: "Outro" },
];

function generateId() {
  return crypto.randomUUID();
}

export default function DynamicFormBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [category, setCategory] = useState("equipe");
  const [fields, setFields] = useState<FormField[]>([]);
  const [configFieldId, setConfigFieldId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFormId, setSavedFormId] = useState<string | null>(editId);
  const [suggestingAI, setSuggestingAI] = useState(false);
  const [aiImageBase64, setAiImageBase64] = useState<string | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load existing form if editing
  useState(() => {
    if (editId) {
      loadForm(editId);
    }
  });

  async function loadForm(id: string) {
    const { data: form } = await supabase
      .from("dynamic_forms")
      .select("*")
      .eq("id", id)
      .single();

    if (form) {
      setFormName(form.name);
      setFormDescription(form.description || "");
      setCategory((form as any).category || "equipe");
    }

    const { data: fieldData } = await supabase
      .from("dynamic_form_fields")
      .select("*")
      .eq("form_id", id)
      .order("order_index");

    if (fieldData) {
      setFields(
        fieldData.map((f: any) => ({
          id: f.id,
          label: f.label,
          field_type: f.field_type,
          required: f.required,
          options: Array.isArray(f.options) ? f.options : [],
          placeholder: f.placeholder || "",
          validation: f.validation || {},
          order_index: f.order_index,
        }))
      );
    }

    // Load attachments
    const { data: attData } = await supabase
      .from("dynamic_form_attachments" as any)
      .select("*")
      .eq("form_id", id)
      .order("order_index");

    if (attData) {
      // Enrich with names
      const bannerIds = (attData as any[]).filter((a) => a.attachment_type === "banner").map((a) => a.attachment_id);
      const materialIds = (attData as any[]).filter((a) => a.attachment_type === "material").map((a) => a.attachment_id);

      let bannerMap: Record<string, string> = {};
      let materialMap: Record<string, string> = {};

      if (bannerIds.length) {
        const { data: b } = await supabase.from("trade_banners").select("id, titulo").in("id", bannerIds);
        (b || []).forEach((x: any) => { bannerMap[x.id] = x.titulo; });
      }
      if (materialIds.length) {
        const { data: m } = await supabase.from("trade_materiais" as any).select("id, nome").in("id", materialIds);
        ((m || []) as any[]).forEach((x: any) => { materialMap[x.id] = x.nome; });
      }

      setAttachments(
        (attData as any[]).map((a) => ({
          ...a,
          name: a.attachment_type === "banner" ? bannerMap[a.attachment_id] : materialMap[a.attachment_id],
        }))
      );
    }
  }

  function addField() {
    const newField: FormField = {
      id: generateId(),
      label: "",
      field_type: "text",
      required: false,
      options: [],
      placeholder: "",
      validation: {},
      order_index: fields.length,
    };
    setFields((prev) => [...prev, newField]);
  }

  function updateField(id: string, updates: Partial<FormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (configFieldId === id) setConfigFieldId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((prev) => {
        const oldIndex = prev.findIndex((f) => f.id === active.id);
        const newIndex = prev.findIndex((f) => f.id === over.id);
        return arrayMove(prev, oldIndex, newIndex).map((f, i) => ({
          ...f,
          order_index: i,
        }));
      });
    }
  }

  function handleAiImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAiImageBase64(base64);
      setAiImagePreview(base64);
    };
    reader.readAsDataURL(file);
  }

  function clearAiImage() {
    setAiImageBase64(null);
    setAiImagePreview(null);
  }

  async function handleSuggestAI() {
    const description = aiCustomPrompt.trim() || `${formName}. ${formDescription}`.trim();
    if (!description && !aiImageBase64) {
      toast.error("Informe uma descrição, prompt ou envie uma imagem para sugestão IA");
      return;
    }
    setSuggestingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-form-fields", {
        body: {
          description: description || undefined,
          category,
          imageBase64: aiImageBase64 || undefined,
        },
      });

      if (error) throw error;

      if (data?.fields && Array.isArray(data.fields)) {
        const newFields: FormField[] = data.fields.map((f: any, i: number) => ({
          id: generateId(),
          label: f.label || f.name || "",
          field_type: f.field_type || f.type || "text",
          required: f.required ?? false,
          options: Array.isArray(f.options) ? f.options : [],
          placeholder: f.placeholder || "",
          validation: f.validation || {},
          order_index: fields.length + i,
        }));
        setFields((prev) => [...prev, ...newFields]);
        toast.success(`${newFields.length} campos sugeridos pela IA adicionados!`);
        // Clear AI inputs after success
        setAiCustomPrompt("");
        clearAiImage();
      }
    } catch (err: any) {
      console.error("AI suggestion error:", err);
      toast.error("Erro ao sugerir campos com IA");
    } finally {
      setSuggestingAI(false);
    }
  }

  async function handleSave(status: "draft" | "active" = "draft") {
    if (!formName.trim()) {
      toast.error("Informe o nome do formulário");
      return;
    }
    if (fields.length === 0) {
      toast.error("Adicione pelo menos um campo");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let formId = savedFormId;

      if (formId) {
        // Update existing form
        const { error } = await supabase
          .from("dynamic_forms")
          .update({
            name: formName,
            description: formDescription,
            category,
            status,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", formId);
        if (error) throw error;

        // Delete existing fields and re-insert
        await supabase.from("dynamic_form_fields").delete().eq("form_id", formId);
      } else {
        // Create new form
        const { data: newForm, error } = await supabase
          .from("dynamic_forms")
          .insert({
            name: formName,
            description: formDescription,
            category,
            status,
            created_by: user.id,
          } as any)
          .select("id")
          .single();

        if (error) throw error;
        formId = newForm.id;
        setSavedFormId(formId);
      }

      // Insert fields
      const fieldInserts = fields.map((f, i) => ({
        form_id: formId,
        label: f.label,
        field_type: f.field_type,
        required: f.required,
        options: f.options,
        placeholder: f.placeholder || null,
        validation: f.validation,
        order_index: i,
      }));

      const { error: fieldErr } = await supabase
        .from("dynamic_form_fields")
        .insert(fieldInserts as any);

      if (fieldErr) throw fieldErr;

      toast.success(
        status === "active"
          ? "Formulário publicado com sucesso!"
          : "Formulário salvo como rascunho"
      );
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Erro ao salvar formulário");
    } finally {
      setSaving(false);
    }
  }

  const configField = configFieldId ? fields.find((f) => f.id === configFieldId) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div>
          <ModuleBreadcrumb
            moduleName="Trade Marketing"
            moduleHref="/dashboard/trade"
            currentPage="Criar Formulário"
          />
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold">
                {editId ? "Editar Formulário" : "Novo Formulário Dinâmico"}
              </h1>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                disabled={fields.length === 0}
              >
                {showPreview ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showPreview ? "Editor" : "Preview"}
              </Button>
              <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Rascunho
              </Button>
              <Button onClick={() => handleSave("active")} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publicar
              </Button>
            </div>
          </div>
        </div>

        {showPreview && savedFormId ? (
          <DynamicFormRenderer formId={savedFormId} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Editor */}
            <div className="lg:col-span-2 space-y-4">
              {/* Form Metadata */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <Label>Nome do Formulário</Label>
                    <Input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ex: Pesquisa de Preço no PDV"
                      className="text-lg font-semibold"
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Instruções para o preenchimento..."
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label>Categoria</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* AI Suggestion Panel */}
                  <div className="border border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Sparkles className="h-4 w-4" />
                      Sugestão IA — Descreva ou envie uma imagem
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <Input
                          value={aiCustomPrompt}
                          onChange={(e) => setAiCustomPrompt(e.target.value)}
                          placeholder="Ex: Formulário de pesquisa de preço com foto da gôndola e preço concorrente..."
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Image upload */}
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAiImageUpload}
                          />
                          <div className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-accent transition-colors">
                            <ImagePlus className="h-4 w-4" />
                            {aiImagePreview ? "Trocar imagem" : "Enviar imagem de referência"}
                          </div>
                        </label>

                        {aiImagePreview && (
                          <div className="relative">
                            <img
                              src={aiImagePreview}
                              alt="Referência"
                              className="h-12 w-12 rounded-md object-cover border"
                            />
                            <button
                              type="button"
                              onClick={clearAiImage}
                              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="default"
                        onClick={handleSuggestAI}
                        disabled={suggestingAI}
                        className="ml-auto"
                      >
                        {suggestingAI ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Gerar campos com IA
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Descreva o formulário desejado ou envie uma imagem de um formulário existente para a IA extrair os campos automaticamente.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Fields List */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {fields.map((field) => (
                      <FormFieldCard
                        key={field.id}
                        field={field}
                        onUpdate={updateField}
                        onRemove={removeField}
                        onOpenConfig={setConfigFieldId}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <Button variant="outline" className="w-full" onClick={addField}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Campo
              </Button>
            </div>

            {/* Config Panel */}
            <div className="space-y-4">
              {configField ? (
                <FieldConfigPanel
                  field={configField}
                  onUpdate={updateField}
                  onClose={() => setConfigFieldId(null)}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Configuração</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Clique no ícone ⚙️ de um campo para configurar validações e opções avançadas.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Stats */}
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Campos: <span className="font-medium text-foreground">{fields.length}</span></p>
                    <p>
                      Obrigatórios:{" "}
                      <span className="font-medium text-foreground">
                        {fields.filter((f) => f.required).length}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
