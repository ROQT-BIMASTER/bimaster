import { useForm } from "react-hook-form";
import { useState, useRef, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User, Camera, Trash2, Upload } from "lucide-react";
import { formatCPF, formatPhone } from "@/lib/formatters";
import {
  teamMemberFormSchema,
  type TeamMemberFormData,
} from "@/lib/validations/teamMember";
import type { TeamMemberWithProfile } from "@/hooks/useTeamMemberDetails";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TeamMemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMemberWithProfile | null;
  onSave: (userId: string, data: TeamMemberFormData) => void;
  isSaving: boolean;
}

const TAMANHOS = ["P", "M", "G", "GG", "XGG"] as const;

export function TeamMemberFormDialog({
  open,
  onOpenChange,
  member,
  onSave,
  isSaving,
}: TeamMemberFormDialogProps) {
  const details = member?.details;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const form = useForm<TeamMemberFormData>({
    resolver: zodResolver(teamMemberFormSchema),
    defaultValues: {
      equipe_comercial: details?.equipe_comercial || "",
      supervisor_nome: details?.supervisor_nome || "",
      nome_completo: details?.nome_completo || member?.profile_nome || "",
      data_nascimento: details?.data_nascimento || "",
      cpf: details?.cpf_masked ? formatCPF(details.cpf_masked) : "",
      rg: details?.rg_masked || "",
      email_pessoal: details?.email_pessoal || member?.profile_email || "",
      whatsapp: details?.whatsapp ? formatPhone(details.whatsapp) : "",
      tamanho_camiseta: (details?.tamanho_camiseta as TeamMemberFormData["tamanho_camiseta"]) || undefined,
      observacoes: details?.observacoes || "",
    },
  });

  // Reset form when member changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && member) {
      const d = member.details;
      form.reset({
        equipe_comercial: d?.equipe_comercial || "",
        supervisor_nome: d?.supervisor_nome || "",
        nome_completo: d?.nome_completo || member.profile_nome || "",
        data_nascimento: d?.data_nascimento || "",
        cpf: d?.cpf_masked ? formatCPF(d.cpf_masked) : "",
        rg: d?.rg_masked || "",
        email_pessoal: d?.email_pessoal || member.profile_email || "",
        whatsapp: d?.whatsapp ? formatPhone(d.whatsapp) : "",
        tamanho_camiseta: (d?.tamanho_camiseta as TeamMemberFormData["tamanho_camiseta"]) || undefined,
        observacoes: d?.observacoes || "",
      });
      setAvatarUrl(member.profile_avatar_url);
      setAvatarPreview(null);
    }
    if (!isOpen) {
      setAvatarPreview(null);
    }
    onOpenChange(isOpen);
  };

  const resolveAvatarDisplay = () => {
    if (avatarPreview) return avatarPreview;
    if (avatarUrl) return avatarUrl;
    return null;
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !member) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas arquivos de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB.");
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to storage
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${member.user_id}/avatar.${ext}`;

      // Remove old avatar if exists
      await supabase.storage.from("avatars").remove([path]);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Update profile avatar_url
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", member.user_id);

      if (updateError) throw updateError;

      setAvatarUrl(path);
      toast.success("Foto atualizada com sucesso!");
    } catch (err: any) {
      console.error("Erro ao enviar foto:", err);
      toast.error("Erro ao enviar foto: " + err.message);
      setAvatarPreview(null);
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!member) return;

    setUploading(true);
    try {
      // List and remove all files in the user's avatar folder
      const { data: files } = await supabase.storage
        .from("avatars")
        .list(member.user_id);

      if (files && files.length > 0) {
        const paths = files.map(f => `${member.user_id}/${f.name}`);
        await supabase.storage.from("avatars").remove(paths);
      }

      // Clear avatar_url in profile
      await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", member.user_id);

      setAvatarUrl(null);
      setAvatarPreview(null);
      toast.success("Foto removida.");
    } catch (err: any) {
      console.error("Erro ao remover foto:", err);
      toast.error("Erro ao remover foto.");
    } finally {
      setUploading(false);
    }
  };

  // Resolve signed URL for display
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const displayUrl = avatarPreview || signedUrl;

  // Generate signed URL when avatarUrl changes
  useEffect(() => {
    if (avatarUrl && !avatarUrl.startsWith("http") && !avatarUrl.startsWith("data:")) {
      supabase.storage.from("avatars").createSignedUrl(avatarUrl, 3600).then(({ data }) => {
        if (data?.signedUrl) setSignedUrl(data.signedUrl);
      });
    } else if (avatarUrl?.startsWith("http")) {
      setSignedUrl(avatarUrl);
    } else {
      setSignedUrl(null);
    }
  }, [avatarUrl]);

  const handleSubmit = (data: TeamMemberFormData) => {
    if (!member) return;
    onSave(member.user_id, data);
  };

  // Máscara de CPF enquanto digita
  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (value.length > 9) {
      value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    } else if (value.length > 6) {
      value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    } else if (value.length > 3) {
      value = value.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    }
    form.setValue("cpf", value, { shouldValidate: false });
  };

  // Máscara de WhatsApp
  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (value.length > 6) {
      value = value.replace(/(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
    } else if (value.length > 2) {
      value = value.replace(/(\d{2})(\d{1,5})/, "($1) $2");
    } else if (value.length > 0) {
      value = value.replace(/(\d{1,2})/, "($1");
    }
    form.setValue("whatsapp", value, { shouldValidate: false });
  };

  const initials = (member?.details?.nome_completo || member?.profile_nome || "?")
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {details ? "Editar Cadastro" : "Cadastrar Membro"}
          </DialogTitle>
          <DialogDescription>
            {member?.profile_nome} — Preencha os dados pessoais do membro da equipe comercial.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          {/* ── Photo Upload Section ── */}
          <div className="flex items-center gap-5 p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="relative group">
              <Avatar className="h-20 w-20 ring-2 ring-border">
                <AvatarImage src={displayUrl || undefined} />
                <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {/* Overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "absolute inset-0 rounded-full flex items-center justify-center transition-all",
                  "bg-black/0 group-hover:bg-black/50 cursor-pointer",
                  uploading && "bg-black/50"
                )}
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm">Foto do Colaborador</h4>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                JPG, PNG ou WEBP • Máximo 5MB
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {displayUrl ? "Trocar foto" : "Enviar foto"}
                </Button>
                {displayUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleRemovePhoto}
                    disabled={uploading}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Equipe + Supervisor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="equipe_comercial">Equipe Comercial *</Label>
              <Input
                id="equipe_comercial"
                placeholder="Ex: Equipe 01"
                {...form.register("equipe_comercial")}
              />
              {form.formState.errors.equipe_comercial && (
                <p className="text-xs text-destructive">{form.formState.errors.equipe_comercial.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supervisor_nome">Supervisor(a) Responsável *</Label>
              <Input
                id="supervisor_nome"
                placeholder="Nome do supervisor"
                {...form.register("supervisor_nome")}
              />
              {form.formState.errors.supervisor_nome && (
                <p className="text-xs text-destructive">{form.formState.errors.supervisor_nome.message}</p>
              )}
            </div>
          </div>

          {/* Nome Completo */}
          <div className="space-y-2">
            <Label htmlFor="nome_completo">Nome Completo *</Label>
            <Input
              id="nome_completo"
              placeholder="Nome completo do membro"
              {...form.register("nome_completo")}
            />
            {form.formState.errors.nome_completo && (
              <p className="text-xs text-destructive">{form.formState.errors.nome_completo.message}</p>
            )}
          </div>

          {/* Data Nascimento + CPF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de Nascimento *</Label>
              <Input
                id="data_nascimento"
                type="date"
                {...form.register("data_nascimento")}
              />
              {form.formState.errors.data_nascimento && (
                <p className="text-xs text-destructive">{form.formState.errors.data_nascimento.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={form.watch("cpf")}
                onChange={handleCPFChange}
              />
              {form.formState.errors.cpf && (
                <p className="text-xs text-destructive">{form.formState.errors.cpf.message}</p>
              )}
            </div>
          </div>

          {/* RG + Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rg">RG</Label>
              <Input
                id="rg"
                placeholder="Número do RG"
                {...form.register("rg")}
              />
              {form.formState.errors.rg && (
                <p className="text-xs text-destructive">{form.formState.errors.rg.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_pessoal">E-mail</Label>
              <Input
                id="email_pessoal"
                type="email"
                placeholder="email@exemplo.com"
                {...form.register("email_pessoal")}
              />
              {form.formState.errors.email_pessoal && (
                <p className="text-xs text-destructive">{form.formState.errors.email_pessoal.message}</p>
              )}
            </div>
          </div>

          {/* WhatsApp + Tamanho Camiseta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">Contato WhatsApp *</Label>
              <Input
                id="whatsapp"
                placeholder="(00) 00000-0000"
                value={form.watch("whatsapp")}
                onChange={handleWhatsAppChange}
              />
              {form.formState.errors.whatsapp && (
                <p className="text-xs text-destructive">{form.formState.errors.whatsapp.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tamanho_camiseta">Tamanho Camiseta *</Label>
              <Select
                value={form.watch("tamanho_camiseta")}
                onValueChange={(val) =>
                  form.setValue("tamanho_camiseta", val as TeamMemberFormData["tamanho_camiseta"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="tamanho_camiseta">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TAMANHOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.tamanho_camiseta && (
                <p className="text-xs text-destructive">{form.formState.errors.tamanho_camiseta.message}</p>
              )}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Anotações adicionais..."
              rows={3}
              {...form.register("observacoes")}
            />
            {form.formState.errors.observacoes && (
              <p className="text-xs text-destructive">{form.formState.errors.observacoes.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || uploading}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {details ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}