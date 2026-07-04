import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LifeBuoy, Headphones, MessageSquare, Wrench, ShieldCheck, Truck,
  Building2, DollarSign, ShoppingCart, Users, Cpu, HeartPulse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONES: { key: string; icon: LucideIcon }[] = [
  { key: "life-buoy", icon: LifeBuoy },
  { key: "headphones", icon: Headphones },
  { key: "message-square", icon: MessageSquare },
  { key: "wrench", icon: Wrench },
  { key: "shield-check", icon: ShieldCheck },
  { key: "truck", icon: Truck },
  { key: "building-2", icon: Building2 },
  { key: "dollar-sign", icon: DollarSign },
  { key: "shopping-cart", icon: ShoppingCart },
  { key: "users", icon: Users },
  { key: "cpu", icon: Cpu },
  { key: "heart-pulse", icon: HeartPulse },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function slugify(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function NovoDepartamentoDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState("#185FA5");
  const [icone, setIcone] = useState<string>("life-buoy");
  const [salvando, setSalvando] = useState(false);

  const reset = () => {
    setNome("");
    setSlug("");
    setSlugTouched(false);
    setDescricao("");
    setCor("#185FA5");
    setIcone("life-buoy");
  };

  const salvar = async () => {
    if (!nome.trim() || !slug.trim()) {
      toast.error("Nome e slug são obrigatórios.");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("rpc_suporte_fila_criar" as any, {
        p_nome: nome.trim(),
        p_slug: slug.trim(),
        p_descricao: descricao.trim() || null,
        p_cor: cor || null,
        p_icone: icone || null,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["suporte", "filas"] });
      qc.invalidateQueries({ queryKey: ["suporte", "minhas-filas"] });
      toast.success("Departamento criado. Adicione membros e configure o fluxo.");
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar departamento.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo departamento</DialogTitle>
          <DialogDescription>
            Cria uma nova fila de suporte com política de SLA padrão. Depois, adicione
            membros e configure o fluxo pelo botão "Fluxo".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dep-nome">Nome</Label>
            <Input
              id="dep-nome"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="Ex.: Fiscal, Transporte 2, Comercial"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-slug">Slug</Label>
            <Input
              id="dep-slug"
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugTouched(true);
              }}
              placeholder="ex.: fiscal"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-desc">Descrição (opcional)</Label>
            <Textarea
              id="dep-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-cor">Cor</Label>
            <div className="flex items-center gap-2">
              <input
                id="dep-cor"
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-9 w-14 rounded border border-input bg-transparent p-0"
              />
              <Input
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="font-mono text-sm w-32"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Criando..." : "Criar departamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
