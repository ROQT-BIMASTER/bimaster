import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, UserPlus, Camera, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

// -----------------------------------------------------------------------------
// Máscaras e validações locais (sem nova dependência)
// -----------------------------------------------------------------------------
const onlyDigits = (s: string) => s.replace(/\D+/g, "");

const maskCPF = (s: string) => {
  const d = onlyDigits(s).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};

const maskTelefone = (s: string) => {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

const isValidCPF = (raw: string) => {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let dv1 = 11 - (sum % 11);
  if (dv1 >= 10) dv1 = 0;
  if (dv1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let dv2 = 11 - (sum % 11);
  if (dv2 >= 10) dv2 = 0;
  return dv2 === parseInt(cpf[10], 10);
};

// -----------------------------------------------------------------------------

const signupSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome completo").max(120),
  cargo: z.string().trim().min(2, "Informe seu cargo ou função").max(100),
  email: z.string().trim().email("Email inválido").max(255).toLowerCase(),
  telefone: z
    .string()
    .trim()
    .refine((v) => onlyDigits(v).length >= 10 && onlyDigits(v).length <= 11, {
      message: "Telefone inválido (use DDD + número)",
    }),
  cpf: z
    .string()
    .trim()
    .refine((v) => isValidCPF(v), { message: "CPF inválido" }),
  rg: z.string().trim().min(4, "Informe um RG válido").max(20),
  password: z
    .string()
    .min(10, "A senha deve ter no mínimo 10 caracteres")
    .max(100)
    .refine((v) => /[A-Z]/.test(v), { message: "Inclua pelo menos uma letra maiúscula" })
    .refine((v) => /[a-z]/.test(v), { message: "Inclua pelo menos uma letra minúscula" })
    .refine((v) => /\d/.test(v), { message: "Inclua pelo menos um número" })
    .refine((v) => /[^A-Za-z0-9]/.test(v), { message: "Inclua pelo menos um símbolo (ex.: !@#$%)" }),
  confirmPassword: z.string(),
}).strict().refine((d) => d.password === d.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export const SignupForm = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Formato inválido", { description: "Use PNG, JPG ou WebP." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Imagem muito grande", { description: "O limite é 2 MB." });
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const clearAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadAvatar = async (userId: string) => {
    if (!avatarFile) return;
    try {
      const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
      if (upErr) {
        logger.error("[SignupForm] avatar upload:", upErr.message);
        toast.warning("Foto não enviada", { description: "Você poderá enviar a foto depois pelo seu perfil." });
        return;
      }
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", userId);
      if (updErr) logger.error("[SignupForm] avatar profile update:", updErr.message);
    } catch (e) {
      logger.error("[SignupForm] avatar exception:", e);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (honeypot) {
      await new Promise((r) => setTimeout(r, 1200));
      toast.error("Erro ao criar conta", { description: "Tente novamente em instantes." });
      return;
    }

    try {
      const validated = signupSchema.parse({
        nome, cargo, email, telefone, cpf, rg, password, confirmPassword,
      });
      setLoading(true);

      const cpfDigits = onlyDigits(validated.cpf);
      const telefoneDigits = onlyDigits(validated.telefone);

      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: {
            nome: validated.nome,
            cargo: validated.cargo,
            telefone: telefoneDigits,
            cpf: cpfDigits,
            rg: validated.rg,
          },
          emailRedirectTo: `${window.location.origin}/aguardando-aprovacao`,
        },
      });

      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        const code = (error as { code?: string }).code ?? "";
        if (code === "weak_password" || msg.includes("weak") || msg.includes("pwned") || msg.includes("known to be")) {
          toast.error("Senha vulnerável", {
            description:
              "Essa senha aparece em vazamentos públicos e foi bloqueada por segurança. Escolha uma senha longa (12+ caracteres) misturando maiúsculas, minúsculas, números e símbolos — evite datas, nomes e sequências.",
          });
        } else if (
          code === "user_already_exists" ||
          code === "email_exists" ||
          msg.includes("already") ||
          msg.includes("registered") ||
          msg.includes("exists")
        ) {
          toast.error("Email já cadastrado", { description: "Use o link 'Entrar' ou recupere sua senha." });
        } else if (msg.includes("password")) {
          toast.error("Senha não atende aos requisitos", { description: error.message });
        } else {
          toast.error("Erro ao criar conta", { description: error.message || "Tente novamente em instantes." });
        }
        return;
      }

      const userId = data.user?.id ?? null;

      // Faz upload do avatar (se houver) — não bloqueia o fluxo em caso de erro.
      if (userId) await uploadAvatar(userId);

      if (data.session) {
        toast.success("Cadastro realizado", {
          description: "Sua conta está aguardando aprovação do administrador.",
        });
        navigate("/aguardando-aprovacao", { replace: true });
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (loginError) {
        toast.success("Cadastro recebido", {
          description: "Verifique seu e-mail para concluir o cadastro e aguardar a aprovação.",
        });
        navigate("/auth/login", { replace: true });
        return;
      }

      if (avatarFile) {
        // Re-tenta upload caso o primeiro tenha falhado por ausência de sessão.
        const { data: sessData } = await supabase.auth.getUser();
        if (sessData.user?.id) await uploadAvatar(sessData.user.id);
      }

      toast.success("Cadastro realizado", {
        description: "Sua conta está aguardando aprovação do administrador.",
      });
      navigate("/aguardando-aprovacao", { replace: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error("Erro de validação", { description: err.errors[0].message });
        return;
      }
      logger.error("[SignupForm] erro");
      const description =
        err instanceof Error && err.message ? err.message : "Tente novamente em instantes.";
      toast.error("Erro ao criar conta", { description });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Criar conta
        </CardTitle>
        <CardDescription>
          Cadastre-se para solicitar acesso ao sistema. Seu acesso ficará pendente de aprovação por um administrador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 rounded-full border border-border bg-muted overflow-hidden flex items-center justify-center">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Pré-visualização da foto" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <Label htmlFor="avatar" className="block mb-1">Foto de perfil</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  id="avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  className="text-xs file:mr-2 file:rounded file:border-0 file:bg-secondary file:text-secondary-foreground file:px-3 file:py-1"
                />
                {avatarFile && (
                  <Button type="button" variant="ghost" size="icon" onClick={clearAvatar} aria-label="Remover foto">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Opcional. PNG, JPG ou WebP até 2 MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} autoComplete="name" placeholder="Seu nome" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo / Função</Label>
              <Input id="cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} required maxLength={100} placeholder="Ex.: Analista Comercial" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email corporativo</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} autoComplete="email" placeholder="seu@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" inputMode="tel" value={telefone} onChange={(e) => setTelefone(maskTelefone(e.target.value))} required placeholder="(11) 99999-9999" autoComplete="tel" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} required placeholder="000.000.000-00" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rg">RG</Label>
              <Input id="rg" value={rg} onChange={(e) => setRg(e.target.value)} required maxLength={20} placeholder="Documento de identidade" autoComplete="off" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength={100}
                  autoComplete="new-password"
                  className="pr-10"
                  placeholder="Mín. 10 caracteres com maiúscula, número e símbolo"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Use 10+ caracteres com maiúscula, minúscula, número e símbolo. Evite senhas comuns e sequências — senhas em vazamentos públicos são bloqueadas automaticamente.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input id="confirmPassword" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required maxLength={100} autoComplete="new-password" placeholder="Repita a senha" />
            </div>
          </div>

          {/* Honeypot */}
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, overflow: "hidden" }}
          >
            <label htmlFor="company-website">Website</label>
            <input
              id="company-website"
              name="company-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando solicitação..." : "Criar conta e solicitar acesso"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Ao criar a conta você concorda com a Política de Privacidade. Seu acesso só será liberado após aprovação do administrador.
          </p>

          <p className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/auth/login" className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
};
