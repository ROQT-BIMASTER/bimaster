import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type KpiSeverity = "default" | "success" | "warning" | "primary" | "danger";

export interface KpiDef {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  severity?: KpiSeverity;
}

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  render: (item: T) => ReactNode;
}

export interface TabDef<T> {
  key: string;
  label: string;
  icon?: LucideIcon;
  render: (item: T) => ReactNode;
}

export interface FilterDef {
  key: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width?: string;
}

export interface BatchAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  variant?: "default" | "destructive" | "outline" | "secondary";
  onClick: (ids: string[]) => void;
}

export interface DetailFooterAction<T> {
  key: string;
  label: string;
  variant?: "default" | "outline" | "secondary" | "destructive";
  icon?: LucideIcon;
  onClick: (item: T) => void;
  disabled?: boolean;
}

export interface CadastroShellProps<T> {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  primaryAction?: { label: string; onClick: () => void; icon?: LucideIcon };
  secondaryActions?: { label: string; onClick: () => void; icon?: LucideIcon }[];
  banner?: ReactNode;
  kpis: KpiDef[];
  items: T[];
  getId: (item: T) => string;
  isLoading?: boolean;
  columns: ColumnDef<T>[];
  detail: {
    getTitle: (item: T) => ReactNode;
    getSubtitle?: (item: T) => ReactNode;
    getAvatar?: (item: T) => { initials: string; color?: string };
    getBadges?: (item: T) => ReactNode;
    tabs: TabDef<T>[];
    footerActions?: DetailFooterAction<T>[];
  };
  search: { value: string; onChange: (v: string) => void; placeholder?: string };
  filters?: FilterDef[];
  batchActions?: BatchAction[];
  emptyMessage?: string;
  breadcrumb?: ReactNode;
  storageKey?: string;
}
