import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  FlaskConical, ShieldCheck, CheckCircle2, Palette, Package, Tag,
  ClipboardList, Truck, FileText, Beaker, Scissors, Camera, Barcode,
  Sticker, Settings, Box, Globe, Calculator, Users, Briefcase,
  Heart, Zap, Target, Flag, Star, Award, BookOpen, Layers,
  type LucideIcon,
} from "lucide-react";

// Map of icon names to Lucide components for dynamic resolution
export const ICON_MAP: Record<string, LucideIcon> = {
  "flask-conical": FlaskConical,
  "shield-check": ShieldCheck,
  "check-circle-2": CheckCircle2,
  "palette": Palette,
  "package": Package,
  "tag": Tag,
  "clipboard-list": ClipboardList,
  "truck": Truck,
  "file-text": FileText,
  "beaker": Beaker,
  "scissors": Scissors,
  "camera": Camera,
  "barcode": Barcode,
  "sticker": Sticker,
  "settings": Settings,
  "box": Box,
  "globe": Globe,
  "calculator": Calculator,
  "users": Users,
  "briefcase": Briefcase,
  "heart": Heart,
  "zap": Zap,
  "target": Target,
  "flag": Flag,
  "star": Star,
  "award": Award,
  "book-open": BookOpen,
  "layers": Layers,
};

export const AVAILABLE_ICONS = Object.entries(ICON_MAP).map(([name, component]) => ({
  name,
  component,
}));

export const AVAILABLE_COLORS = [
  { value: "text-primary", label: "Primário" },
  { value: "text-success", label: "Sucesso" },
  { value: "text-destructive", label: "Alerta" },
  { value: "text-accent-foreground", label: "Acento" },
  { value: "text-muted-foreground", label: "Neutro" },
];

export interface ModuloDespacho {
  id: string;
  key: string;
  label: string;
  icon_name: string;
  color: string;
  ativo: boolean;
  ordem: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  ambiente_habilitado: boolean;
  pode_ciencia: boolean;
  pode_aprovar: boolean;
  pode_rejeitar: boolean;
  pode_juntada: boolean;
  pode_submeter: boolean;
  pode_contestar: boolean;
  pode_replicar: boolean;
}

export interface ModuloCapabilities {
  ambiente_habilitado: boolean;
  pode_ciencia: boolean;
  pode_aprovar: boolean;
  pode_rejeitar: boolean;
  pode_juntada: boolean;
  pode_submeter: boolean;
  pode_contestar: boolean;
  pode_replicar: boolean;
}

const DEFAULT_CAPABILITIES: ModuloCapabilities = {
  ambiente_habilitado: true,
  pode_ciencia: true,
  pode_aprovar: true,
  pode_rejeitar: true,
  pode_juntada: true,
  pode_submeter: true,
  pode_contestar: true,
  pode_replicar: true,
};

/** Returns capabilities for a specific module key */
export function useModuloCapabilities(moduleKey: string | undefined): ModuloCapabilities {
  const { data: modulos = [] } = useModulosDespacho();
  if (!moduleKey) return DEFAULT_CAPABILITIES;
  const found = modulos.find(m => m.key === moduleKey);
  if (!found) return DEFAULT_CAPABILITIES;
  return {
    ambiente_habilitado: found.ambiente_habilitado,
    pode_ciencia: found.pode_ciencia,
    pode_aprovar: found.pode_aprovar,
    pode_rejeitar: found.pode_rejeitar,
    pode_juntada: found.pode_juntada,
    pode_submeter: found.pode_submeter,
    pode_contestar: found.pode_contestar,
    pode_replicar: found.pode_replicar,
  };
}

export interface ModuloDespachoResolved {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

export function useModulosDespacho() {
  return useQuery({
    queryKey: ["modulos-despacho"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_modulos_despacho" as any)
        .select("*")
        .eq("ativo", true)
        .order("ordem") as any);
      if (error) throw error;
      return (data || []) as ModuloDespacho[];
    },
  });
}

export function useAllModulosDespacho() {
  return useQuery({
    queryKey: ["modulos-despacho-all"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_modulos_despacho" as any)
        .select("*")
        .order("ordem") as any);
      if (error) throw error;
      return (data || []) as ModuloDespacho[];
    },
  });
}

/** Returns resolved modules with LucideIcon components ready for rendering */
export function useModulosDespachoResolved(): ModuloDespachoResolved[] {
  const { data: modulos = [] } = useModulosDespacho();

  return modulos.map((m) => ({
    key: m.key,
    label: m.label,
    icon: ICON_MAP[m.icon_name] || FileText,
    color: m.color,
  }));
}

export function useManageModulosDespacho() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const addModulo = useMutation({
    mutationFn: async (input: { key: string; label: string; icon_name: string; color: string; ordem?: number }) => {
      const { error } = await (supabase
        .from("process_modulos_despacho" as any)
        .insert({ ...input, created_by: user?.id }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modulos-despacho"] });
      queryClient.invalidateQueries({ queryKey: ["modulos-despacho-all"] });
      toast.success("Módulo criado");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar módulo"),
  });

  const updateModulo = useMutation({
    mutationFn: async (input: { id: string; label?: string; icon_name?: string; color?: string; ativo?: boolean; ordem?: number; ambiente_habilitado?: boolean; pode_ciencia?: boolean; pode_aprovar?: boolean; pode_rejeitar?: boolean; pode_juntada?: boolean; pode_submeter?: boolean; pode_contestar?: boolean; pode_replicar?: boolean }) => {
      const { id, ...update } = input;
      const { error } = await (supabase
        .from("process_modulos_despacho" as any)
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modulos-despacho"] });
      queryClient.invalidateQueries({ queryKey: ["modulos-despacho-all"] });
      toast.success("Módulo atualizado");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar módulo"),
  });

  const deleteModulo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("process_modulos_despacho" as any)
        .delete()
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modulos-despacho"] });
      queryClient.invalidateQueries({ queryKey: ["modulos-despacho-all"] });
      toast.success("Módulo removido");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao remover módulo"),
  });

  return { addModulo, updateModulo, deleteModulo };
}
