import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Camera, Loader2, Save, ShieldCheck, UserCircle, Lock, X, Eye, EyeOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { resolveAvatarUrl } from "@/lib/utils/avatarUrl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------- helpers ----------
const onlyDigits = (s: string) => (s || "").replace(/\D+/g, "");

const maskTelefone = (s: string) => {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

const maskCpfPartial = (cpfRaw: string | null | undefined) => {
  const d = onlyDigits(cpfRaw || "");
  if (d.length !== 11) return d || "Não informado";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
};

const formatCpfFull = (cpfRaw: string | null | undefined) => {
  const d = onlyDigits(cpfRaw || "");
  if (d.length !== 11) return d || "Não informado";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
};

const maskRgPartial = (rg: string | null | undefined) => {
  const v = (rg || "").trim();
  if (!v) return "Não informado";
  if (v.length <= 3) return "*".repeat(v.length);
  // Mostra só os 2 últimos caracteres
  return `${"*".repeat(Math.max(v.length - 2, 3))}${v.slice(-2)}`;
};

const maskEmailPartial = (email: string | null | undefined) => {
  const v = (email || "").trim();
  if (!v || !v.includes("@")) return v || "Não informado";
  const [local, domain] = v.split("@");
  const head = local.slice(0, Math.min(2, local.length));
  const maskedLocal = `${head}${"*".repeat(Math.max(local.length - head.length, 3))}`;
  const [domName, ...rest] = domain.split(".");
  const domHead = domName.slice(0, 1);
  const maskedDom = `${domHead}${"*".repeat(Math.max(domName.length - 1, 2))}`;
  return `${maskedLocal}@${maskedDom}${rest.length ? "." + rest.join(".") : ""}`;
};

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

// Versões correntes dos documentos legais (idem useTermsAcceptance)
const CURRENT_VERSIONS = {
  privacy_policy: "1.0",
  terms_of_use: "1.0",
} as const;

const profileSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome completo").max(120),
  cargo: z.string().trim().min(2, "Informe seu cargo ou função").max(100),
  telefone: z
    .string()
    .trim()
    .refine((v) => onlyDigits(v).length >= 10 && onlyDigits(v).length <= 11, {
      message: "Telefone inválido (use DDD + número)",
    }),
}).strict();

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Informe sua senha atual"),
  newPassword: z
    .string()
    .min(8, "Mínimo de 8 caracteres")
    .max(100)
    .refine((v) => /[A-Z]/.test(v), { message: "Inclua ao menos 1 letra maiúscula" })
    .refine((v) => /[0-9]/.test(v), { message: "Inclua ao menos 1 número" }),
  confirmPassword: z.string(),
}).strict().refine((d) => d.newPassword === d.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type ProfileRow = {
  id: string;
  nome: string | null;
  cargo: string | null;
  telefone: string | null;
  cpf: string | null;
  rg: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string | null;
};

export default function MeuPerfil() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const senhaCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location.hash === "#senha" && senhaCardRef.current) {
      senhaCardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Step-up por campo: cada campo (cpf/rg/email) tem sua própria janela TTL.
  type RevealField = "cpf" | "rg" | "email";
  type RevealState = {
    grantId: string;
    value: string | null;
    expiresAt: number;
  };
  const [reveals, setReveals] = useState<Record<RevealField, RevealState | null>>({
    cpf: null,
    rg: null,
    email: null,
  });
  const [revealOpen, setRevealOpen] = useState<RevealField | null>(null);
  const [revealPassword, setRevealPassword] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [tick, setTick] = useState(0); // força re-render do contador
  const revealTimersRef = useRef<Record<RevealField, number | null>>({
    cpf: null,
    rg: null,
    email: null,
  });

  // Tick a cada 1s enquanto houver algum campo revelado (para countdown)
  useEffect(() => {
    const anyActive = Object.values(reveals).some((r) => r !== null);
    if (!anyActive) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [reveals]);

  useEffect(() => {
    return () => {
      for (const k of ["cpf", "rg", "email"] as RevealField[]) {
        const t = revealTimersRef.current[k];
        if (t) window.clearTimeout(t);
      }
    };
  }, []);

  const clearReveal = async (field: RevealField, opts?: { skipRpc?: boolean }) => {
    const current = reveals[field];
    setReveals((prev) => ({ ...prev, [field]: null }));
    const t = revealTimersRef.current[field];
    if (t) {
      window.clearTimeout(t);
      revealTimersRef.current[field] = null;
    }
    if (current && !opts?.skipRpc) {
      try {
        await supabase.rpc("mark_profile_reveal_hidden", { _grant_id: current.grantId });
      } catch {
        // best-effort
      }
      // recarrega auditoria
      loadAudit();
    }
  };

  const handleRevealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revealOpen || !user?.id) return;
    if (!revealPassword) {
      toast.error("Informe sua senha para confirmar");
      return;
    }
    setRevealing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meu-perfil-reveal", {
        body: { field: revealOpen, password: revealPassword },
      });

      if (error) {
        // Tenta extrair mensagem amigável do contexto
        const ctx = (error as any)?.context;
        let serverMsg: string | null = null;
        let status: number | null = null;
        try {
          if (ctx instanceof Response) {
            status = ctx.status;
            const j = await ctx.clone().json().catch(() => null);
            serverMsg = j?.message || j?.error || null;
          }
        } catch {}
        if (status === 429) {
          toast.error("Muitas tentativas", {
            description: serverMsg || "Aguarde alguns minutos antes de tentar novamente.",
          });
        } else if (status === 401) {
          toast.error("Senha incorreta");
        } else {
          toast.error(serverMsg || "Não foi possível confirmar sua identidade");
        }
        return;
      }

      if (!data || typeof data !== "object" || !("value" in data)) {
        toast.error("Resposta inválida do servidor");
        return;
      }

      const field = revealOpen;
      const expiresAt = new Date(data.expires_at as string).getTime();
      setReveals((prev) => ({
        ...prev,
        [field]: {
          grantId: String(data.grant_id),
          value: (data.value as string) ?? null,
          expiresAt,
        },
      }));

      const prevTimer = revealTimersRef.current[field];
      if (prevTimer) window.clearTimeout(prevTimer);
      revealTimersRef.current[field] = window.setTimeout(() => {
        clearReveal(field, { skipRpc: true });
        loadAudit();
      }, Math.max(expiresAt - Date.now(), 500));

      setRevealOpen(null);
      setRevealPassword("");
      toast.success("Dado revelado", {
        description: `Visível por ${data.ttl_seconds ?? 30} segundos.`,
      });
      loadAudit();
    } catch (err) {
      logger.error("[MeuPerfil] reveal error");
      toast.error("Não foi possível confirmar sua identidade");
    } finally {
      setRevealing(false);
    }
  };

  // Auditoria (apenas próprias concessões, mais recentes primeiro)
  type AuditRow = {
    id: string;
    field: string;
    granted_at: string;
    expires_at: string;
    hidden_at: string | null;
    ip: string | null;
  };
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadAudit = async () => {
    if (!user?.id) return;
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from("profile_reveal_grants")
        .select("id, field, granted_at, expires_at, hidden_at, ip")
        .eq("user_id", user.id)
        .order("granted_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setAuditRows((data || []) as AuditRow[]);
    } catch {
      // silent
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, nome, cargo, telefone, cpf, rg, avatar_url, email, created_at")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        const p = data as ProfileRow | null;
        setProfile(p);
        setNome(p?.nome ?? "");
        setCargo(p?.cargo ?? "");
        setTelefone(maskTelefone(p?.telefone ?? ""));
        const resolvedAvatar = await resolveAvatarUrl(p?.avatar_url ?? null, {
          profileId: user.id,
          persist: true,
        });
        if (!active) return;
        setAvatarPreview(resolvedAvatar);
      } catch (err) {
        logger.error("[MeuPerfil] load profile error");
        toast.error("Não foi possível carregar seu perfil");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  // ---------- salvar dados pessoais ----------
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    const parsed = profileSchema.safeParse({
      nome,
      cargo,
      telefone,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? "Dados inválidos");
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          nome: parsed.data.nome,
          cargo: parsed.data.cargo,
          telefone: onlyDigits(parsed.data.telefone),
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Dados atualizados", {
        description: "Suas informações foram salvas com sucesso.",
      });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              nome: parsed.data.nome,
              cargo: parsed.data.cargo,
              telefone: onlyDigits(parsed.data.telefone),
            }
          : prev,
      );
    } catch (err) {
      logger.error("[MeuPerfil] update profile error");
      toast.error("Não foi possível salvar suas informações");
    } finally {
      setSavingProfile(false);
    }
  };

  // ---------- avatar ----------
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.id) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Formato inválido", { description: "Use PNG, JPG ou WebP." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Arquivo muito grande", { description: "Máximo de 2 MB." });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      // Bucket privado: usar URL assinada de longa duração (1 ano).
      // getPublicUrl não autentica em bucket privado e a imagem "some"
      // assim que o cache do navegador expira.
      const { data: signedData, error: signedErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signedErr || !signedData?.signedUrl) {
        throw signedErr || new Error("Falha ao gerar URL da foto");
      }
      const publicUrl = signedData.signedUrl;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);
      if (dbErr) throw dbErr;
      setAvatarPreview(publicUrl);
      toast.success("Foto atualizada");
    } catch (err) {
      logger.error("[MeuPerfil] avatar upload error");
      toast.error("Não foi possível atualizar sua foto");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ---------- redefinir senha + aceite de termos ----------
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !profile?.email) return;
    const parsed = passwordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? "Dados inválidos");
      return;
    }
    if (!acceptedTerms) {
      toast.error("É necessário aceitar o Termo de Privacidade para redefinir a senha");
      return;
    }
    setSavingPassword(true);
    try {
      // 1) Reautenticação
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: parsed.data.currentPassword,
      });
      if (reauthErr) {
        toast.error("Senha atual incorreta");
        setSavingPassword(false);
        return;
      }
      // 2) Atualizar senha
      const { error: updErr } = await supabase.auth.updateUser({
        password: parsed.data.newPassword,
      });
      if (updErr) throw updErr;
      // 3) Registrar aceite versionado dos termos
      const records = Object.entries(CURRENT_VERSIONS).map(([type, version]) => ({
        user_id: user.id,
        document_type: type,
        document_version: version,
      }));
      const { error: termsErr } = await supabase
        .from("terms_acceptance")
        .upsert(records, { onConflict: "user_id,document_type,document_version" });
      if (termsErr) {
        logger.error("[MeuPerfil] terms upsert error");
      }
      toast.success("Senha redefinida", {
        description: "Sua nova senha está ativa e o aceite dos termos foi registrado.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setAcceptedTerms(false);
    } catch (err) {
      logger.error("[MeuPerfil] reset password error");
      toast.error("Não foi possível redefinir sua senha");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                <UserCircle className="h-6 w-6 text-primary" />
                Meu Perfil
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Visualize e atualize suas informações de conta.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate(-1)}>
              Voltar
            </Button>
          </div>

          {/* Card: Foto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Foto de perfil</CardTitle>
              <CardDescription>
                PNG, JPG ou WebP — até 2 MB.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full overflow-hidden bg-muted flex items-center justify-center border border-border">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircle className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  {uploadingAvatar && (
                    <div className="absolute inset-0 rounded-full bg-background/70 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_AVATAR_TYPES.join(",")}
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Alterar foto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Dados pessoais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados pessoais</CardTitle>
              <CardDescription>Edite suas informações de contato e função.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSaveProfile}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="nome">Nome completo</Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      maxLength={120}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cargo">Cargo / Função</Label>
                    <Input
                      id="cargo"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      maxLength={100}
                      placeholder="Ex.: Gerente de Marketing"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={telefone}
                      onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      inputMode="tel"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar alterações
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Card: Dados de cadastro (somente leitura) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados de cadastro</CardTitle>
              <CardDescription>
                Exibidos de forma parcial por proteção de dados (LGPD). Cada campo pode ser revelado
                individualmente após confirmação de senha; a liberação dura 30 segundos e fica registrada
                em auditoria. Para alterar estes campos, entre em contato com o administrador do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SensitiveField
                  label="E-mail corporativo"
                  reveal={reveals.email}
                  maskedValue={maskEmailPartial(profile?.email)}
                  fullValue={profile?.email ?? "Não informado"}
                  onReveal={() => setRevealOpen("email")}
                  onHide={() => clearReveal("email")}
                />
                <SensitiveField
                  label="CPF"
                  reveal={reveals.cpf}
                  maskedValue={maskCpfPartial(profile?.cpf)}
                  fullValue={formatCpfFull(profile?.cpf)}
                  onReveal={() => setRevealOpen("cpf")}
                  onHide={() => clearReveal("cpf")}
                />
                <SensitiveField
                  label="RG"
                  reveal={reveals.rg}
                  maskedValue={maskRgPartial(profile?.rg)}
                  fullValue={profile?.rg || "Não informado"}
                  onReveal={() => setRevealOpen("rg")}
                  onHide={() => clearReveal("rg")}
                />
                <ReadOnlyField
                  label="Data de cadastro"
                  value={
                    profile?.created_at
                      ? format(new Date(profile.created_at), "dd/MM/yyyy", { locale: ptBR })
                      : "—"
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Diálogo de step-up para revelar um campo específico */}
          <Dialog
            open={revealOpen !== null}
            onOpenChange={(open) => {
              if (!open) {
                setRevealOpen(null);
                setRevealPassword("");
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Confirme sua identidade
                </DialogTitle>
                <DialogDescription>
                  Para exibir{" "}
                  <strong>
                    {revealOpen === "cpf" && "o CPF completo"}
                    {revealOpen === "rg" && "o RG completo"}
                    {revealOpen === "email" && "o e-mail completo"}
                  </strong>
                  , informe sua senha de acesso. O dado ficará visível por 30 segundos e o acesso será
                  registrado em auditoria.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRevealSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="revealPassword">Senha atual</Label>
                  <Input
                    id="revealPassword"
                    type="password"
                    value={revealPassword}
                    onChange={(e) => setRevealPassword(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Após 5 senhas incorretas em 10 minutos, novas tentativas ficam bloqueadas por 15 minutos.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRevealOpen(null)}
                    disabled={revealing}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={revealing || !revealPassword}>
                    {revealing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    Confirmar e mostrar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>



          {/* Card: Segurança / Senha */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Segurança — Redefinir senha
              </CardTitle>
              <CardDescription>
                Para redefinir sua senha você precisa informar a senha atual e aceitar o Termo
                de Privacidade vigente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleResetPassword}>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha atual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova senha</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Mínimo 8 caracteres, 1 letra maiúscula e 1 número.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
                  <Checkbox
                    id="acceptTerms"
                    checked={acceptedTerms}
                    onCheckedChange={(v) => setAcceptedTerms(v === true)}
                  />
                  <Label
                    htmlFor="acceptTerms"
                    className="text-sm font-normal leading-relaxed cursor-pointer"
                  >
                    Li e aceito a{" "}
                    <a
                      href="/privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Política de Privacidade
                    </a>{" "}
                    (versão {CURRENT_VERSIONS.privacy_policy}) e os{" "}
                    <a
                      href="/termos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Termos de Uso
                    </a>{" "}
                    (versão {CURRENT_VERSIONS.terms_of_use}). O aceite ficará registrado em auditoria.
                  </Label>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={savingPassword || !acceptedTerms}
                  >
                    {savingPassword ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4 mr-2" />
                    )}
                    Redefinir senha
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Card: Auditoria de acessos a dados sensíveis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Auditoria — Revelações de dados sensíveis
              </CardTitle>
              <CardDescription>
                Registro completo de quando, qual dado e por quanto tempo seus dados sensíveis foram exibidos
                no perfil. Administradores enxergam o registro de todos os usuários.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : auditRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Nenhuma revelação registrada nos últimos acessos.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3 font-medium">Data / hora</th>
                        <th className="py-2 pr-3 font-medium">Campo</th>
                        <th className="py-2 pr-3 font-medium">Duração</th>
                        <th className="py-2 pr-3 font-medium">Encerrado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map((row) => {
                        const granted = new Date(row.granted_at);
                        const expires = new Date(row.expires_at);
                        const ended = row.hidden_at ? new Date(row.hidden_at) : expires;
                        const durationMs = Math.max(ended.getTime() - granted.getTime(), 0);
                        const durationSec = Math.round(durationMs / 1000);
                        const endedReason = row.hidden_at ? "ocultado pelo usuário" : "expirou";
                        return (
                          <tr key={row.id} className="border-b border-border/50">
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {format(granted, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </td>
                            <td className="py-2 pr-3 uppercase font-medium">
                              {row.field}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {durationSec}s
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                              {format(ended, "HH:mm:ss", { locale: ptBR })} ({endedReason})
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SensitiveField({
  label,
  reveal,
  maskedValue,
  fullValue,
  onReveal,
  onHide,
}: {
  label: string;
  reveal: { grantId: string; value: string | null; expiresAt: number } | null;
  maskedValue: string;
  fullValue: string;
  onReveal: () => void;
  onHide: () => void;
}) {
  const isRevealed = reveal !== null;
  const secondsLeft = isRevealed
    ? Math.max(Math.ceil((reveal!.expiresAt - Date.now()) / 1000), 0)
    : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {isRevealed ? (
          <button
            type="button"
            onClick={onHide}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <EyeOff className="h-3 w-3" />
            Ocultar ({secondsLeft}s)
          </button>
        ) : (
          <button
            type="button"
            onClick={onReveal}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <Eye className="h-3 w-3" />
            Mostrar
          </button>
        )}
      </div>
      <div className="px-3 py-2 rounded-md border border-border bg-muted/40 text-sm text-foreground font-mono">
        {isRevealed ? reveal!.value || "—" : maskedValue}
      </div>
    </div>
  );
}


function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const content = (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="px-3 py-2 rounded-md border border-border bg-muted/40 text-sm text-foreground">
        {value}
      </div>
    </div>
  );
  if (!hint) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>{content}</div>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
