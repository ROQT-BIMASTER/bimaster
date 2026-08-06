import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNovidadesAdmin, type Novidade } from "@/hooks/useNovidades";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AccessDenied } from "@/components/common/AccessDenied";
import { NovidadeMidia } from "@/components/novidades/NovidadeMidia";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { APP_VERSION } from "@/lib/version";

type Rascunho = Partial<Novidade> & { id?: string };

const VAZIO: Rascunho = {
  titulo: "",
  descricao: "",
  versao: APP_VERSION,
  link_destino: "",
  publicado: false,
  ordem: 0,
};

const MAX_MB = 20;

export default function NovidadesAdmin() {
  const { isAdmin, loading } = usePermissions();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: itens = [], isLoading } = useNovidadesAdmin(isAdmin);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <AccessDenied />;

  const invalidar = () => qc.invalidateQueries({ queryKey: ["novidades"] });

  const salvar = async () => {
    if (!rascunho?.titulo?.trim()) {
      toast.error("Informe um título para a novidade.");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        titulo: rascunho.titulo.trim(),
        descricao: rascunho.descricao ?? "",
        midia_url: rascunho.midia_url || null,
        midia_tipo: rascunho.midia_tipo || null,
        link_destino: rascunho.link_destino?.trim() || null,
        versao: rascunho.versao?.trim() || null,
        publicado: !!rascunho.publicado,
        publicado_em: rascunho.publicado ? (rascunho.publicado_em ?? new Date().toISOString()) : null,
        ordem: Number(rascunho.ordem ?? 0),
      };
      const q = rascunho.id
        ? (supabase as any).from("novidades").update(payload).eq("id", rascunho.id)
        : (supabase as any).from("novidades").insert({ ...payload, created_by: user?.id ?? null });
      const { error } = await q;
      if (error) throw error;
      toast.success("Novidade salva");
      setRascunho(null);
      invalidar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar a novidade.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string) => {
    const { error } = await (supabase as any).from("novidades").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Novidade removida");
    invalidar();
  };

  const alternarPublicacao = async (n: Novidade) => {
    const { error } = await (supabase as any)
      .from("novidades")
      .update({
        publicado: !n.publicado,
        publicado_em: !n.publicado ? new Date().toISOString() : null,
      })
      .eq("id", n.id);
    if (error) return toast.error(error.message);
    invalidar();
  };

  const enviarMidia = async (file: File) => {
    if (!user?.id) return;
    const ehVideo = file.type.startsWith("video/");
    const ehImagem = file.type.startsWith("image/");
    if (!ehVideo && !ehImagem) {
      toast.error("Envie apenas imagem ou vídeo.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo acima de ${MAX_MB} MB.`);
      return;
    }
    setEnviando(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("novidades-midia").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      setRascunho((r) => ({ ...(r ?? VAZIO), midia_url: path, midia_tipo: ehVideo ? "video" : "imagem" }));
      toast.success("Mídia enviada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no envio da mídia.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novidades</h1>
            <p className="text-sm text-muted-foreground">
              Comunique mudanças e instruções de uso. Itens publicados aparecem para todos os usuários ao entrar no sistema.
            </p>
          </div>
          <Button onClick={() => setRascunho({ ...VAZIO })}>
            <Plus className="mr-2 h-4 w-4" />
            Nova novidade
          </Button>
        </header>

        {rascunho && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {rascunho.id ? "Editar novidade" : "Nova novidade"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nov-titulo">Título</Label>
                  <Input
                    id="nov-titulo"
                    value={rascunho.titulo ?? ""}
                    onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nov-versao">Versão</Label>
                  <Input
                    id="nov-versao"
                    value={rascunho.versao ?? ""}
                    onChange={(e) => setRascunho({ ...rascunho, versao: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nov-descricao">Descrição e instruções</Label>
                <Textarea
                  id="nov-descricao"
                  rows={6}
                  placeholder="Aceita formatação Markdown: listas, negrito e links."
                  value={rascunho.descricao ?? ""}
                  onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nov-link">Link de destino (opcional)</Label>
                  <Input
                    id="nov-link"
                    placeholder="/dashboard/projetos"
                    value={rascunho.link_destino ?? ""}
                    onChange={(e) => setRascunho({ ...rascunho, link_destino: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nov-ordem">Ordem de exibição</Label>
                  <Input
                    id="nov-ordem"
                    type="number"
                    value={rascunho.ordem ?? 0}
                    onChange={(e) => setRascunho({ ...rascunho, ordem: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Imagem ou vídeo (opcional)</Label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" asChild disabled={enviando}>
                    <label className="cursor-pointer">
                      {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Enviar arquivo
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) enviarMidia(f);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </Button>
                  {rascunho.midia_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRascunho({ ...rascunho, midia_url: null, midia_tipo: null })}
                    >
                      Remover mídia
                    </Button>
                  )}
                </div>
                {rascunho.midia_url && rascunho.midia_tipo && (
                  <div className="max-w-sm">
                    <NovidadeMidia
                      path={rascunho.midia_url}
                      tipo={rascunho.midia_tipo}
                      titulo={rascunho.titulo ?? "Pré-visualização"}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="nov-publicado"
                  checked={!!rascunho.publicado}
                  onCheckedChange={(v) => setRascunho({ ...rascunho, publicado: v })}
                />
                <Label htmlFor="nov-publicado">Publicado</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setRascunho(null)}>Cancelar</Button>
                <Button onClick={salvar} disabled={salvando}>
                  {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publicações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!isLoading && itens.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma novidade cadastrada.</p>
            )}
            {itens.map((n) => (
              <div
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">{n.titulo}</span>
                    {n.versao && <Badge variant="secondary">v{n.versao}</Badge>}
                    <Badge variant={n.publicado ? "default" : "outline"}>
                      {n.publicado ? "Publicado" : "Rascunho"}
                    </Badge>
                  </div>
                  {n.link_destino && (
                    <p className="text-xs text-muted-foreground truncate">{n.link_destino}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => alternarPublicacao(n)}>
                    {n.publicado ? "Despublicar" : "Publicar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRascunho(n)}>Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => excluir(n.id)} aria-label="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
    </div>
  );
}
