import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Mail } from "lucide-react";
import { DEV_PAPEIS } from "@/lib/productDocAudit";
import { projetoConviteSchema, PAPEIS_CONVITE } from "@/lib/validations/projetoConvite";
import { useProjetoConvites } from "@/hooks/useProjetoConvites";

interface Props {
  projetoId: string;
  isDevProduto: boolean;
}

interface Secao {
  id: string;
  nome: string;
  ordem: number | null;
}

export function ConvidarMembroPanel({ projetoId, isDevProduto }: Props) {
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<string>("membro");
  const [mensagem, setMensagem] = useState("");
  const [secoesSelecionadas, setSecoesSelecionadas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { create } = useProjetoConvites(projetoId);

  const { data: secoes = [] } = useQuery({
    queryKey: ["projeto_secoes_list", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_secoes")
        .select("id, nome, ordem")
        .eq("projeto_id", projetoId)
        .order("ordem");
      if (error) throw error;
      return data as Secao[];
    },
    enabled: !!projetoId,
  });

  const papelOptions = useMemo(
    () =>
      isDevProduto
        ? DEV_PAPEIS.filter((p) => PAPEIS_CONVITE.includes(p.value as any))
        : DEV_PAPEIS.filter((p) => ["coordenador", "membro"].includes(p.value)),
    [isDevProduto]
  );

  const isManagerRole = ["coordenador", "gestor_produto"].includes(papel);

  const handleSubmit = async () => {
    setError(null);
    const parsed = projetoConviteSchema.safeParse({
      projeto_id: projetoId,
      email,
      papel,
      secoes_ids: isManagerRole ? [] : secoesSelecionadas,
      mensagem: mensagem || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message || "Dados inválidos");
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      setEmail("");
      setMensagem("");
      setSecoesSelecionadas([]);
      setPapel("membro");
    } catch {
      // toast já exibido pelo hook
    }
  };

  const toggleSecao = (id: string) =>
    setSecoesSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  return (
    <div className="space-y-3 p-3 border rounded-md bg-muted/20">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Mail className="h-4 w-4 text-primary" />
        Convidar pessoa
      </div>

      <div className="space-y-2">
        <Label htmlFor="convite-email" className="text-xs">
          E-mail (interno ou externo)
        </Label>
        <Input
          id="convite-email"
          type="email"
          placeholder="usuario@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Papel</Label>
          <Select value={papel} onValueChange={setPapel}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {papelOptions.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isManagerRole && secoes.length > 0 && (
        <div>
          <Label className="text-xs">
            Seções visíveis ({secoesSelecionadas.length}/{secoes.length})
          </Label>
          <ScrollArea className="max-h-32 mt-1 border rounded p-2">
            <div className="grid grid-cols-2 gap-1.5">
              {secoes.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-background p-1 rounded"
                >
                  <Checkbox
                    checked={secoesSelecionadas.includes(s.id)}
                    onCheckedChange={() => toggleSecao(s.id)}
                  />
                  <span className="truncate">{s.nome}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-1 mt-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 text-[10px]"
              onClick={() => setSecoesSelecionadas(secoes.map((s) => s.id))}
            >
              Todas
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 text-[10px]"
              onClick={() => setSecoesSelecionadas([])}
            >
              Nenhuma
            </Button>
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs">Mensagem (opcional)</Label>
        <Textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Olá! Gostaria que você participasse deste projeto…"
          rows={2}
          maxLength={500}
          className="text-xs resize-none"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={create.isPending || !email}
        size="sm"
        className="w-full gap-2"
      >
        {create.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Enviar convite
      </Button>
    </div>
  );
}
