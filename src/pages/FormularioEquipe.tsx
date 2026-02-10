import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, ShieldCheck, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Schema for token step
const tokenSchema = z.object({
  token: z.string().min(1, "Informe o código de acesso"),
});

// Reuse validation logic
const formSchema = z.object({
  nome_completo: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(150),
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  cpf: z.string().min(1, "CPF é obrigatório").refine((val) => {
    const cleaned = val.replace(/\D/g, "");
    return cleaned.length === 11;
  }, "CPF deve ter 11 dígitos"),
  rg: z.string().trim().max(15).optional().or(z.literal("")),
  email_pessoal: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  whatsapp: z.string().min(1, "WhatsApp é obrigatório").refine((val) => {
    const cleaned = val.replace(/\D/g, "");
    return cleaned.length === 10 || cleaned.length === 11;
  }, "Formato inválido. Use (00) 00000-0000"),
  tamanho_camiseta: z.enum(["P", "M", "G", "GG", "XGG"], {
    required_error: "Selecione o tamanho",
  }),
  equipe_comercial: z.string().trim().optional().or(z.literal("")),
  supervisor_nome: z.string().trim().optional().or(z.literal("")),
  observacoes: z.string().trim().max(500).optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

// CPF mask helper
function maskCPF(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

// Phone mask helper
function maskPhone(value: string) {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 10) {
    return cleaned.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return cleaned.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export default function FormularioEquipe() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<"token" | "form" | "success">(
    searchParams.get("token") ? "form" : "token"
  );
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenInput, setTokenInput] = useState(searchParams.get("token") || "");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome_completo: "",
      data_nascimento: "",
      cpf: "",
      rg: "",
      email_pessoal: "",
      whatsapp: "",
      tamanho_camiseta: undefined,
      equipe_comercial: "",
      supervisor_nome: "",
      observacoes: "",
    },
  });

  const handleTokenSubmit = () => {
    if (!tokenInput.trim()) {
      toast({ title: "Informe o código de acesso", variant: "destructive" });
      return;
    }
    setToken(tokenInput.trim());
    setStep("form");
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/team-form-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...data }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Erro",
          description: result.error || "Erro ao enviar formulário",
          variant: "destructive",
        });
        return;
      }

      setStep("success");
    } catch {
      toast({
        title: "Erro de conexão",
        description: "Verifique sua internet e tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Cadastro da Equipe</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Preencha seus dados para completar o cadastro
          </p>
        </div>

        {/* Step: Token */}
        {step === "token" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Código de Acesso
              </CardTitle>
              <CardDescription>
                Informe o código fornecido pelo seu supervisor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="token">Código</Label>
                <Input
                  id="token"
                  placeholder="Ex: EQUIPE2026"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleTokenSubmit()}
                  className="text-center text-lg tracking-widest font-mono"
                />
              </div>
              <Button onClick={handleTokenSubmit} className="w-full">
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Form */}
        {step === "form" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seus Dados</CardTitle>
              <CardDescription>
                Campos com * são obrigatórios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="nome_completo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Seu nome completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="000.000.000-00"
                              value={field.value}
                              onChange={(e) => field.onChange(maskCPF(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RG</FormLabel>
                          <FormControl>
                            <Input placeholder="RG" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="data_nascimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="whatsapp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="(00) 00000-0000"
                              value={field.value}
                              onChange={(e) => field.onChange(maskPhone(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email_pessoal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@exemplo.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="tamanho_camiseta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tamanho Camiseta *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {["P", "M", "G", "GG", "XGG"].map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="equipe_comercial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipe Comercial</FormLabel>
                          <FormControl>
                            <Input placeholder="Sua equipe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supervisor_nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supervisor</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do supervisor" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Alguma observação?" rows={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar Cadastro
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <Card className="text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Cadastro Enviado!</h2>
              <p className="text-muted-foreground">
                Seus dados foram recebidos com sucesso. Obrigado por preencher o formulário.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
