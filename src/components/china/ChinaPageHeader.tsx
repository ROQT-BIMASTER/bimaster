import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { ImpersonationSelector } from "@/components/admin/ImpersonationSelector";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ChinaPageHeaderProps {
  /** Título em português */
  titlePt: string;
  /** Título em chinês */
  titleCn: string;
  /** Título em inglês (opcional). Quando informado, ativa o modo i18n do header. */
  titleEn?: string;
  /** Subtítulo opcional bilíngue (ex.: "Portal de Submissão 提交门户") */
  subtitle?: string;
  /** Ícone do header. Padrão: Factory */
  icon?: LucideIcon;
  /** Cor de destaque do ícone (token semântico). Padrão: destructive */
  iconTone?: "destructive" | "primary" | "warning" | "success" | "accent";
  /** Mostrar botão voltar */
  showBack?: boolean;
  /** Caminho customizado de "voltar". Padrão: navigate(-1) */
  backTo?: string;
  /** Rótulo customizado do botão voltar (ex.: "Voltar à Mesa de Vínculo") */
  backLabel?: string;
  /** Slot direito (ações como "Nova Submissão", manual, etc.) */
  actions?: ReactNode;
}

const TONE_BG: Record<NonNullable<ChinaPageHeaderProps["iconTone"]>, string> = {
  destructive: "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  accent: "bg-accent/10 text-accent-foreground",
};

/**
 * Header padrão do módulo Fábrica China — alinhado ao padrão visual de Projetos
 * (CentralHeader). Inclui SidebarTrigger sempre visível, color picker de fundo
 * (compartilha o mesmo storage global do módulo Projetos para identidade
 * visual unificada), botão de voltar opcional e slot livre para ações.
 */
export function ChinaPageHeader({
  titlePt,
  titleCn,
  subtitle,
  icon: Icon = Factory,
  iconTone = "destructive",
  showBack = false,
  backTo,
  backLabel,
  actions,
}: ChinaPageHeaderProps) {
  const navigate = useNavigate();
  const { bgColor, setBgColor } = usePageBgColor();

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger />
        <ProjetoBgColorPicker value={bgColor} onChange={setBgColor} />
        {showBack && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2"
            onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
            aria-label={backLabel || "Voltar"}
            title={backLabel || "Voltar"}
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel && <span className="text-xs font-medium hidden sm:inline">{backLabel}</span>}
          </Button>
        )}
        <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center shrink-0", TONE_BG[iconTone])}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <BilingualLabel pt={titlePt} cn={titleCn} size="lg" />
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden sm:inline-flex"><ImpersonationSelector /></span>
        {actions}
      </div>
    </div>
  );
}
