import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Search, UserCircle2, Send } from "lucide-react";
import { useEncaminharResponsavel } from "@/hooks/useEncaminharResponsavel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissaoId: string | null;
  produtoCodigo?: string;
  produtoNome?: string;
}

export function EncaminharResponsavelDialog({
  open, onOpenChange, submissaoId, produtoCodigo, produtoNome,
}: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; nome: string } | null>(null);
  const [obs, setObs] = useState("");
  const enviar = useEncaminharResponsavel();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles-list-encaminhar"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .order("nome", { ascending: true })
        .limit(500);
      return (data || []) as Array<{ id: string; nome: string; email: string | null }>;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      `${p.nome ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const handleSubmit = async () => {
    if (!submissaoId || !selected) return;
    await enviar.mutateAsync({
      submissao_id: submissaoId,
      responsavel_id: selected.id,
      responsavel_nome: selected.nome,
      observacao: obs.trim(),
      produto_codigo: produtoCodigo,
      produto_nome: produtoNome,
    });
    setSelected(null);
    setObs("");
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Encaminhar a um responsável</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Responsável</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou e-mail"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <ScrollArea className="mt-2 h-48 rounded-md border border-border">
              {isLoading ? (
                <div className="p-3 text-xs text-muted-foreground">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">Nenhum usuário encontrado</div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {filtered.map((p) => {
                    const active = selected?.id === p.id;
                    return (
                      <li
                        key={p.id}
                        onClick={() => setSelected({ id: p.id, nome: p.nome })}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/50",
                          active && "bg-primary/10"
                        )}
                      >
                        <UserCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{p.nome || "—"}</p>
                          {p.email && (
                            <p className="truncate text-[10px] text-muted-foreground">{p.email}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          <div>
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Contexto, urgência ou instruções"
              className="mt-1 min-h-[72px] text-xs"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!selected || enviar.isPending}
            onClick={handleSubmit}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {enviar.isPending ? "Encaminhando..." : "Encaminhar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
