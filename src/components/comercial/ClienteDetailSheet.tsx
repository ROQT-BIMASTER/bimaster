import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Phone, Smartphone, Mail, MessageCircle, MapPin, TrendingDown, TrendingUp, Minus, Copy, CreditCard, Clock, ShieldAlert, ShieldCheck, FileText } from "lucide-react";
import type { ClienteReativacao, RiskLevel } from "@/hooks/useClienteReativacao";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const riskBadgeConfig: Record<RiskLevel, { label: string; className: string }> = {
  atencao: { label: "Atenção", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300" },
  alerta: { label: "Alerta", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-orange-300" },
  critico: { label: "Crítico", className: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300" },
  inativo: { label: "Inativo", className: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300 border-gray-300" },
};

interface Props {
  cliente: ClienteReativacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClienteDetailSheet({ cliente, open, onOpenChange }: Props) {
  if (!cliente) return null;

  const formatCurrency = (v: number | null) =>
    v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
  };

  const badge = riskBadgeConfig[cliente.nivel_risco];

  const cleanPhone = (phone: string | null) => phone?.replace(/\D/g, "") || "";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const momentum = (cliente.valor_maior_compra && cliente.valor_maior_compra > 0 && cliente.valor_ultima_compra)
    ? Math.round((cliente.valor_ultima_compra / cliente.valor_maior_compra) * 100)
    : null;

  const potencialRecuperacao = (cliente.valor_maior_compra && cliente.valor_ultima_compra)
    ? cliente.valor_maior_compra - cliente.valor_ultima_compra
    : null;

  const isBloqueado = cliente.status_bloqueio && cliente.status_bloqueio.toLowerCase() !== "ativo" && cliente.status_bloqueio.toLowerCase() !== "normal" && cliente.status_bloqueio !== "";

  const hasCobrancaDiferente = cliente.endereco_cobranca && cliente.endereco_cobranca !== cliente.endereco;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg leading-tight">{cliente.nome}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-xs text-muted-foreground font-mono">Cód: {cliente.codigo}</span>
                {cliente.cnpj && (
                  <span className="text-xs text-muted-foreground font-mono">CNPJ: {cliente.cnpj}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className={badge.className}>{badge.label} — {cliente.dias_sem_compra}d</Badge>
            {isBloqueado ? (
              <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" />Bloqueado</Badge>
            ) : (
              <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"><ShieldCheck className="h-3 w-3" />Ativo</Badge>
            )}
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        {/* Contato Rápido */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Contato Rápido
          </h3>
          <div className="space-y-2">
            {cliente.telefone && (
              <div className="flex items-center justify-between">
                <a href={`tel:${cleanPhone(cliente.telefone)}`} className="text-sm text-primary hover:underline flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />{cliente.telefone}
                </a>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(cliente.telefone!, "Telefone")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {cliente.celular && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <a href={`tel:${cleanPhone(cliente.celular)}`} className="text-sm text-primary hover:underline flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5" />{cliente.celular}
                  </a>
                  <a
                    href={`https://wa.me/55${cleanPhone(cliente.celular)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full hover:bg-green-200 transition-colors"
                  >
                    <MessageCircle className="h-3 w-3" />WhatsApp
                  </a>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(cliente.celular!, "Celular")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {cliente.email && (
              <div className="flex items-center justify-between">
                <a href={`mailto:${cliente.email}`} className="text-sm text-primary hover:underline flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5" />{cliente.email}
                </a>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(cliente.email!, "Email")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {cliente.comprador && (
              <p className="text-sm text-muted-foreground">
                Comprador: <span className="text-foreground font-medium">{cliente.comprador}</span>
              </p>
            )}
            {!cliente.telefone && !cliente.celular && !cliente.email && (
              <p className="text-sm text-muted-foreground italic">Nenhum contato cadastrado</p>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Dados Comerciais */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Dados Comerciais
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Dias sem compra</p>
              <p className="text-sm font-bold">{cliente.dias_sem_compra} dias</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Última compra</p>
              <p className="text-sm font-medium">{formatDate(cliente.data_ultima_compra)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Valor última</p>
              <p className="text-sm font-bold">{formatCurrency(cliente.valor_ultima_compra)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Maior compra</p>
              <p className="text-sm font-bold">{formatCurrency(cliente.valor_maior_compra)}</p>
            </div>
          </div>

          {/* Momentum visual */}
          {momentum !== null && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Momentum de Gasto</span>
                <div className="flex items-center gap-1">
                  {momentum >= 80 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                  ) : momentum >= 40 ? (
                    <Minus className="h-3.5 w-3.5 text-amber-600" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                  )}
                  <span className={`text-sm font-bold ${momentum >= 80 ? "text-green-600" : momentum >= 40 ? "text-amber-600" : "text-red-600"}`}>
                    {momentum}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${momentum >= 80 ? "bg-green-500" : momentum >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(momentum, 100)}%` }}
                />
              </div>
              {potencialRecuperacao && potencialRecuperacao > 0 && (
                <p className="text-xs text-muted-foreground">
                  Potencial de recuperação: <span className="font-semibold text-foreground">{formatCurrency(potencialRecuperacao)}</span>
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Limite de crédito</p>
              <p className="text-sm font-medium">{formatCurrency(cliente.limite_credito)}</p>
            </div>
            {cliente.conceito && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Conceito</p>
                <p className="text-sm font-medium">{cliente.conceito}</p>
              </div>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Localização */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Localização
          </h3>
          <div className="text-sm space-y-1">
            {cliente.endereco && <p>{cliente.endereco}</p>}
            {cliente.bairro && <p>{cliente.bairro}</p>}
            <p className="text-muted-foreground">
              {[cliente.cidade, cliente.uf].filter(Boolean).join(" — ")}
              {cliente.cep && ` • CEP: ${cliente.cep}`}
            </p>
          </div>

          {hasCobrancaDiferente && (
            <div className="mt-2 pt-2 border-t border-dashed">
              <p className="text-xs font-medium text-muted-foreground mb-1">Endereço de Cobrança</p>
              <div className="text-sm space-y-1">
                {cliente.endereco_cobranca && <p>{cliente.endereco_cobranca}</p>}
                {cliente.bairro_cobranca && <p>{cliente.bairro_cobranca}</p>}
                <p className="text-muted-foreground">
                  {[cliente.cidade_cobranca, cliente.uf_cobranca].filter(Boolean).join(" — ")}
                  {cliente.cep_cobranca && ` • CEP: ${cliente.cep_cobranca}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Observações */}
        {cliente.observacoes && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Observações
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{cliente.observacoes}</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
