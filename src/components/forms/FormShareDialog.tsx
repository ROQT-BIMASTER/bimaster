import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, UserPlus, X, Loader2 } from "lucide-react";

interface FormShareDialogProps {
  formId: string;
  onClose: () => void;
}

interface ShareEntry {
  id: string;
  shared_with: string;
  permission: string;
  profile_name?: string;
  profile_email?: string;
}

export function FormShareDialog({ formId, onClose }: FormShareDialogProps) {
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState("view");

  useEffect(() => {
    loadShares();
  }, [formId]);

  async function loadShares() {
    const { data } = await supabase
      .from("dynamic_form_shares" as any)
      .select("*")
      .eq("form_id", formId);

    if (data && data.length > 0) {
      const userIds = (data as any[]).map((s) => s.shared_with);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);

      const profMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      setShares(
        (data as any[]).map((s) => ({
          id: s.id,
          shared_with: s.shared_with,
          permission: s.permission,
          profile_name: profMap[s.shared_with]?.nome,
          profile_email: profMap[s.shared_with]?.email,
        }))
      );
    } else {
      setShares([]);
    }
  }

  async function searchProfiles() {
    if (search.length < 2) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .or(`nome.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(10);
    setProfiles(data || []);
    setLoading(false);
  }

  async function addShare(userId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (shares.some((s) => s.shared_with === userId)) {
      toast.info("Usuário já possui acesso");
      return;
    }

    const { error } = await supabase.from("dynamic_form_shares" as any).insert({
      form_id: formId,
      shared_by: user.id,
      shared_with: userId,
      permission,
    } as any);

    if (error) {
      toast.error("Erro ao compartilhar");
      return;
    }

    toast.success("Acesso compartilhado!");
    setSearch("");
    setProfiles([]);
    loadShares();
  }

  async function removeShare(shareId: string) {
    const { error } = await supabase
      .from("dynamic_form_shares" as any)
      .delete()
      .eq("id", shareId);

    if (error) {
      toast.error("Erro ao remover acesso");
      return;
    }
    toast.success("Acesso removido");
    loadShares();
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar Formulário</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search + Permission */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchProfiles()}
                placeholder="Buscar por nome ou email..."
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Select value={permission} onValueChange={setPermission}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Ver</SelectItem>
                <SelectItem value="edit">Editar</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" onClick={searchProfiles} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Search Results */}
          {profiles.length > 0 && (
            <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => addShare(p.id)}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Current Shares */}
          <div>
            <p className="text-sm font-medium mb-2">Pessoas com acesso ({shares.length})</p>
            {shares.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum compartilhamento</p>
            ) : (
              <div className="space-y-2">
                {shares.map((s) => (
                  <div key={s.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <div className="text-sm">
                      <p className="font-medium">{s.profile_name || "Usuário"}</p>
                      <p className="text-xs text-muted-foreground">{s.profile_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {s.permission === "edit" ? "Editar" : "Ver"}
                      </Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeShare(s.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
