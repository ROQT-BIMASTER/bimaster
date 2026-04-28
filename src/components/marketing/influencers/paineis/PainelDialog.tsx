import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { InfluencerPainel } from "./usePaineisInfluencers";
import type { PainelFiltros } from "./painelFilters";
import { REGIOES, REGIOES_UFS } from "@/lib/constants/regioes";

const CORES = ["#E91E78", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4", "#64748B"];
const PLATAFORMAS = ["instagram", "tiktok", "youtube", "twitter", "facebook", "linkedin"];

interface PainelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  painel?: InfluencerPainel | null;
  filtrosIniciais?: PainelFiltros;
  onSave: (input: {
    nome: string;
    descricao?: string;
    cor: string;
    compartilhado: boolean;
    filtros: PainelFiltros;
  }) => void;
  saving?: boolean;
}

export function PainelDialog({ open, onOpenChange, painel, filtrosIniciais, onSave, saving }: PainelDialogProps) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [compartilhado, setCompartilhado] = useState(true);
  const [filtros, setFiltros] = useState<PainelFiltros>({});
  const [tagInput, setTagInput] = useState("");
  const [nichoInput, setNichoInput] = useState("");

  useEffect(() => {
    if (open) {
      setNome(painel?.nome || "");
      setDescricao(painel?.descricao || "");
      setCor(painel?.cor || CORES[0]);
      setCompartilhado(painel ? painel.compartilhado : true);
      setFiltros(painel?.filtros || filtrosIniciais || {});
      setTagInput("");
      setNichoInput("");
    }
  }, [open, painel, filtrosIniciais]);

  const updateFiltro = <K extends keyof PainelFiltros>(k: K, v: PainelFiltros[K]) =>
    setFiltros((prev) => ({ ...prev, [k]: v }));

  const togglePlataforma = (p: string) => {
    const arr = filtros.plataformas || [];
    updateFiltro("plataformas", arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]);
  };
  const toggleRegiao = (r: string) => {
    const arr = filtros.regioes || [];
    updateFiltro("regioes", arr.includes(r) ? arr.filter((x) => x !== r) : [...arr, r]);
  };

  const addMarca = () => {
    const v = tagInput.trim();
    if (!v) return;
    const arr = filtros.marcas || [];
    if (!arr.includes(v)) updateFiltro("marcas", [...arr, v]);
    setTagInput("");
  };
  const addNicho = () => {
    const v = nichoInput.trim();
    if (!v) return;
    const arr = filtros.nichos || [];
    if (!arr.includes(v)) updateFiltro("nichos", [...arr, v]);
    setNichoInput("");
  };

  const handleSave = () => {
    if (!nome.trim()) return;
    onSave({ nome: nome.trim(), descricao: descricao.trim() || undefined, cor, compartilhado, filtros });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{painel ? "Editar painel" : "Novo painel"}</DialogTitle>
          <DialogDescription>
            Configure um conjunto de filtros nomeado para monitorar um recorte específico de influenciadores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="nome">Nome do painel *</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Skincare SP" />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-1.5">
                {CORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => setCor(c)}
                    className="h-7 w-7 rounded-full border-2 transition-all"
                    style={{ background: c, borderColor: cor === c ? "#000" : "transparent" }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição</Label>
            <Textarea id="desc" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Para que serve este painel?" />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Compartilhar com a equipe</p>
              <p className="text-xs text-muted-foreground">Recomendado. Painéis compartilhados aparecem para toda a equipe Marketing. Desligue para mantê-lo pessoal.</p>
            </div>
            <Switch checked={compartilhado} onCheckedChange={setCompartilhado} />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-semibold">Filtros do painel</p>

            <div className="space-y-1.5">
              <Label>Busca textual (separe por espaço)</Label>
              <Input
                value={filtros.busca || ""}
                onChange={(e) => updateFiltro("busca", e.target.value)}
                placeholder="Ex.: skincare verão"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Marcas</Label>
                <div className="flex gap-1.5">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMarca(); } }}
                    placeholder="Digite e pressione Enter"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addMarca}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(filtros.marcas || []).map((m) => (
                    <Badge key={m} variant="secondary" className="gap-1">
                      {m}
                      <button type="button" onClick={() => updateFiltro("marcas", (filtros.marcas || []).filter((x) => x !== m))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Nichos</Label>
                <div className="flex gap-1.5">
                  <Input
                    value={nichoInput}
                    onChange={(e) => setNichoInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNicho(); } }}
                    placeholder="Ex.: beleza, fitness"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addNicho}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(filtros.nichos || []).map((n) => (
                    <Badge key={n} variant="secondary" className="gap-1">
                      {n}
                      <button type="button" onClick={() => updateFiltro("nichos", (filtros.nichos || []).filter((x) => x !== n))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Plataformas</Label>
              <div className="flex flex-wrap gap-1.5">
                {PLATAFORMAS.map((p) => {
                  const ativo = (filtros.plataformas || []).includes(p);
                  return (
                    <Badge
                      key={p}
                      variant={ativo ? "default" : "outline"}
                      className="cursor-pointer capitalize"
                      onClick={() => togglePlataforma(p)}
                    >
                      {p}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Regiões</Label>
              <div className="flex flex-wrap gap-1.5">
                {REGIOES.map((r) => {
                  const ativo = (filtros.regioes || []).includes(r);
                  return (
                    <Badge
                      key={r}
                      variant={ativo ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleRegiao(r)}
                    >
                      {r}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Seguidores mín.</Label>
                <Input type="number" value={filtros.followersMin ?? ""} onChange={(e) => updateFiltro("followersMin", e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Seguidores máx.</Label>
                <Input type="number" value={filtros.followersMax ?? ""} onChange={(e) => updateFiltro("followersMax", e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Engaj. mín. (%)</Label>
                <Input type="number" step="0.1" value={filtros.engajamentoMin ?? ""} onChange={(e) => updateFiltro("engajamentoMin", e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Score mín.</Label>
                <Input type="number" value={filtros.scoreMin ?? ""} onChange={(e) => updateFiltro("scoreMin", e.target.value ? Number(e.target.value) : undefined)} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !nome.trim()}>
            {painel ? "Salvar" : "Criar painel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
