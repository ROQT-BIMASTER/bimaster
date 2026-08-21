import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, Trash2, Beaker, Package, ImagePlus, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { validateFileForUpload } from "@/lib/utils/file-security";
import { logger } from "@/lib/logger";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { useProdutosCatalogoSimulador, useLinhasProdutos } from "@/hooks/useCatalogoSimulador";
import type { ProdutoHipotetico, TabelaNode } from "@/lib/fabrica/perfilSimulacao";

interface Props {
  produtos: ProdutoHipotetico[];
  tabelas: TabelaNode[];
  onChange: (produtos: ProdutoHipotetico[]) => void;
}

const RAIZ = "__raiz__";
const BUCKET = "fabrica-produto-fotos";

function LinhaCombobox({
  value,
  linhas,
  onChange,
}: {
  value: string | null | undefined;
  linhas: string[];
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const novaLinha = busca.trim();
  const jaExiste = linhas.some((l) => l.toLowerCase() === novaLinha.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 w-full justify-start font-normal text-xs truncate">
          {value || <span className="text-muted-foreground">Sem linha</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Buscar ou criar linha..."
            className="h-9"
            value={busca}
            onValueChange={setBusca}
          />
          <CommandList className="max-h-[260px]">
            <CommandEmpty className="py-2 px-3 text-xs text-muted-foreground">
              Nenhuma linha encontrada.
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__sem_linha__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-muted-foreground"
              >
                Sem linha
              </CommandItem>
              {novaLinha && !jaExiste && (
                <CommandItem
                  value={`criar-${novaLinha}`}
                  onSelect={() => {
                    onChange(novaLinha);
                    setBusca("");
                    setOpen(false);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  Criar "{novaLinha}"
                </CommandItem>
              )}
              {linhas.map((l) => (
                <CommandItem
                  key={l}
                  value={l}
                  onSelect={() => {
                    onChange(l);
                    setOpen(false);
                  }}
                >
                  {l}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FotoCell({
  produto,
  onChange,
}: {
  produto: ProdutoHipotetico;
  onChange: (patch: Partial<ProdutoHipotetico>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (file: File | null) => {
    if (!file) return;
    const check = await validateFileForUpload(file);
    if (!check.valid) {
      toast.error(check.error || "Arquivo inválido");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem (JPG, PNG ou WEBP).");
      return;
    }
    setEnviando(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/simulador/${produto.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 86400);
      onChange({ foto_url: signed?.signedUrl ?? null });
      toast.success("Foto adicionada à simulação");
    } catch (e: any) {
      logger.error("Erro ao enviar foto da simulação", e);
      toast.error(e?.message || "Não foi possível enviar a foto");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => enviar(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        title={produto.foto_url ? "Trocar foto" : "Enviar foto"}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {enviando ? (
          <div className="h-10 w-10 rounded-lg border border-border/50 flex items-center justify-center bg-muted">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : produto.foto_url ? (
          <ProductThumbnail src={produto.foto_url} alt={produto.descricao} size="sm" />
        ) : (
          <div className="h-10 w-10 rounded-lg border border-border/50 bg-muted/50 flex items-center justify-center hover:border-primary transition-colors group">
            <Package className="h-4 w-4 text-muted-foreground group-hover:hidden" />
            <ImagePlus className="h-4 w-4 text-primary hidden group-hover:block" />
          </div>
        )}
      </button>
    </div>
  );
}

export function ProdutosHipoteticosGrid({ produtos, tabelas, onChange }: Props) {
  const { data: catalogo = [] } = useProdutosCatalogoSimulador();
  const { linhas } = useLinhasProdutos();
  const [importOpen, setImportOpen] = useState(false);

  const update = (id: string, patch: Partial<ProdutoHipotetico>) =>
    onChange(produtos.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const add = () =>
    onChange([
      ...produtos,
      {
        id: crypto.randomUUID(),
        descricao: "",
        valor: 0,
        nivel_id: produtos[0]?.nivel_id ?? null,
        linha: null,
        foto_url: null,
      },
    ]);

  const importar = (id: string) => {
    const p = catalogo.find((c) => c.id === id);
    if (!p) return;
    onChange([
      ...produtos,
      {
        id: crypto.randomUUID(),
        descricao: p.nome,
        valor: p.custo_unitario ?? 0,
        nivel_id: null, // custo de fábrica
        linha: p.linha,
        foto_url: p.foto_url,
      },
    ]);
    setImportOpen(false);
    toast.success(`${p.nome} importado como produto hipotético`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Beaker className="h-4 w-4 text-primary" />
          Produtos hipotéticos
        </CardTitle>
        <CardDescription>
          Nada é gravado no catálogo. Informe o valor e em qual nível ele já está — o simulador
          reverte até o custo de fábrica e projeta as demais linhas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground">
          <div className="col-span-1">Foto</div>
          <div className="col-span-3">Descrição</div>
          <div className="col-span-3">Linha</div>
          <div className="col-span-2">Valor (R$)</div>
          <div className="col-span-2">Valor está em</div>
          <div className="col-span-1" />
        </div>

        {produtos.map((p) => (
          <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-1">
              <FotoCell produto={p} onChange={(patch) => update(p.id, patch)} />
            </div>
            <Input
              className="col-span-3 h-9"
              placeholder="Ex.: Corretivo"
              value={p.descricao}
              onChange={(e) => update(p.id, { descricao: e.target.value })}
            />
            <div className="col-span-3">
              <LinhaCombobox
                value={p.linha}
                linhas={linhas}
                onChange={(v) => update(p.id, { linha: v })}
              />
            </div>
            <Input
              className="col-span-2 h-9 font-mono text-right"
              type="number"
              step="0.01"
              value={p.valor || ""}
              onChange={(e) => update(p.id, { valor: parseFloat(e.target.value) || 0 })}
            />
            <div className="col-span-2">
              <Select
                value={p.nivel_id ?? RAIZ}
                onValueChange={(v) => update(p.id, { nivel_id: v === RAIZ ? null : v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={RAIZ}>Custo de fábrica</SelectItem>
                  {tabelas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="col-span-1"
              onClick={() => onChange(produtos.filter((x) => x.id !== p.id))}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar produto
          </Button>

          <Popover open={importOpen} onOpenChange={setImportOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                Importar do catálogo
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar produto..." className="h-9" />
                <CommandList className="max-h-[320px]">
                  <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                  <CommandGroup>
                    {catalogo.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`${c.codigo ?? ""} ${c.nome} ${c.linha ?? ""}`}
                        onSelect={() => importar(c.id)}
                        className="gap-2"
                      >
                        <ProductThumbnail src={c.foto_url} alt={c.nome} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm truncate">{c.nome}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {[c.codigo, c.linha].filter(Boolean).join(" · ") || "Sem linha"}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}
