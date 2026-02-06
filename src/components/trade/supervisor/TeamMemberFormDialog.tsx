import { useForm } from "react-hook-form";
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
import { Loader2, User } from "lucide-react";
import { formatCPF, formatPhone } from "@/lib/formatters";
import {
  teamMemberFormSchema,
  type TeamMemberFormData,
} from "@/lib/validations/teamMember";
import type { TeamMemberWithProfile } from "@/hooks/useTeamMemberDetails";

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

  const form = useForm<TeamMemberFormData>({
    resolver: zodResolver(teamMemberFormSchema),
    defaultValues: {
      equipe_comercial: details?.equipe_comercial || "",
      supervisor_nome: details?.supervisor_nome || "",
      nome_completo: details?.nome_completo || member?.profile_nome || "",
      data_nascimento: details?.data_nascimento || "",
      cpf: details?.cpf ? formatCPF(details.cpf) : "",
      rg: details?.rg || "",
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
        cpf: d?.cpf ? formatCPF(d.cpf) : "",
        rg: d?.rg || "",
        email_pessoal: d?.email_pessoal || member.profile_email || "",
        whatsapp: d?.whatsapp ? formatPhone(d.whatsapp) : "",
        tamanho_camiseta: (d?.tamanho_camiseta as TeamMemberFormData["tamanho_camiseta"]) || undefined,
        observacoes: d?.observacoes || "",
      });
    }
    onOpenChange(isOpen);
  };

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

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {details ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
