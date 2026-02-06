import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MessageCircle, Calendar, DollarSign, User, Building2, ExternalLink } from "lucide-react";
import type { MapCliente, MapProspect } from "@/hooks/useCommercialMapData";

interface ClientePopupProps {
  cliente: MapCliente;
  onClose: () => void;
}

interface ProspectPopupProps {
  prospect: MapProspect;
  onClose: () => void;
}

const RISCO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ativo: { label: "Ativo", color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
  atencao: { label: "Atenção", color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  alerta: { label: "Alerta", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
  critico: { label: "Crítico", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  inativo: { label: "Inativo", color: "text-gray-700 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-900/30" },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatPhone = (phone: string) => phone.replace(/\D/g, "");

export const ClientePopup = ({ cliente, onClose }: ClientePopupProps) => {
  const risco = RISCO_CONFIG[cliente.risco] || RISCO_CONFIG.inativo;

  return (
    <div className="p-3 min-w-[280px] max-w-[320px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-bold text-sm leading-tight truncate">{cliente.nome}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground font-mono">#{cliente.codigo}</span>
            {cliente.cnpj && (
              <span className="text-xs text-muted-foreground">{cliente.cnpj}</span>
            )}
          </div>
        </div>
        <Badge className={`${risco.bg} ${risco.color} border-0 text-xs shrink-0`}>
          {risco.label}
        </Badge>
      </div>

      {/* Location */}
      <p className="text-xs text-muted-foreground mb-2">
        {[cliente.cidade, cliente.uf].filter(Boolean).join(" - ")}
      </p>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2 bg-muted/50 rounded text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Calendar className="h-3 w-3 text-muted-foreground" />
          </div>
          <p className="text-sm font-bold">{cliente.dias_sem_compra}</p>
          <p className="text-[10px] text-muted-foreground">dias sem compra</p>
        </div>
        <div className="p-2 bg-muted/50 rounded text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <DollarSign className="h-3 w-3 text-green-500" />
          </div>
          <p className="text-sm font-bold text-green-600">
            {formatCurrency(cliente.valor_ultima_compra || 0)}
          </p>
          <p className="text-[10px] text-muted-foreground">última compra</p>
        </div>
      </div>

      {cliente.valor_maior_compra && (
        <p className="text-xs text-muted-foreground mb-2">
          Maior compra: <span className="font-medium text-foreground">{formatCurrency(cliente.valor_maior_compra)}</span>
        </p>
      )}

      {cliente.comprador && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <User className="h-3 w-3" />
          <span>{cliente.comprador}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5">
        {(cliente.celular || cliente.telefone) && (
          <a
            href={`https://wa.me/55${formatPhone(cliente.celular || cliente.telefone || "")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600">
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </Button>
          </a>
        )}
        {cliente.telefone && (
          <a href={`tel:${cliente.telefone}`}>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <Phone className="h-3 w-3" /> Ligar
            </Button>
          </a>
        )}
        {cliente.email && (
          <a href={`mailto:${cliente.email}`}>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <Mail className="h-3 w-3" /> Email
            </Button>
          </a>
        )}
      </div>
    </div>
  );
};

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  em_contato: "Em Contato",
  proposta_enviada: "Proposta",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const ProspectPopup = ({ prospect, onClose }: ProspectPopupProps) => {
  return (
    <div className="p-3 min-w-[250px] max-w-[300px]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-bold text-sm leading-tight">{prospect.nome_empresa}</h3>
        <Badge variant="secondary" className="text-xs shrink-0">
          {STATUS_LABELS[prospect.status] || prospect.status}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground mb-2">
        {[prospect.municipio, prospect.uf].filter(Boolean).join(" - ")}
      </p>

      {prospect.vendedor_nome && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <User className="h-3 w-3" />
          <span>{prospect.vendedor_nome}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {prospect.telefone && (
          <a
            href={`https://wa.me/55${formatPhone(prospect.telefone)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600">
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </Button>
          </a>
        )}
        {prospect.email && (
          <a href={`mailto:${prospect.email}`}>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <Mail className="h-3 w-3" /> Email
            </Button>
          </a>
        )}
      </div>
    </div>
  );
};
