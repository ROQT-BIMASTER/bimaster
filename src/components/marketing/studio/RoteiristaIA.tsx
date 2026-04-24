import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Plus, Trash2, FileText, Link as LinkIcon, Type, Upload,
  Clapperboard, Sparkles, Video, History, Camera, Music, Eye, Send, CheckCircle2,
  Mic, Play, Square, Download, Volume2
} from "lucide-react";
import { useRoteiristaIA, type Fonte, type Briefing, type Cena } from "@/hooks/useRoteiristaIA";
import { useNarracao, VOZES_NARRACAO } from "@/hooks/useNarracao";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// PDF extraction (lazy)
async function extrairTextoPDF(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // @ts-ignore - worker via CDN
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let texto = "";
  const maxPages = Math.min(pdf.numPages, 30);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((it: any) => it.str).join(" ") + "\n\n";
  }
  return texto;
}

async function extrairTextoURL(url: string): Promise<string> {
  // Usa um proxy CORS-friendly. Em produção, criar edge function própria.
  try {
    const proxyUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error("Falha ao buscar URL");
    return await res.text();
  } catch (e) {
    throw new Error("Não foi possível extrair texto da URL");
  }
}

const TONS = [
  { value: "cinematográfico", label: "Cinematográfico" },
  { value: "documental", label: "Documental" },
  { value: "comercial", label: "Comercial" },
  { value: "ugc autêntico", label: "UGC Autêntico" },
  { value: "energético", label: "Energético" },
  { value: "minimalista", label: "Minimalista" },
  { value: "épico", label: "Épico" },
];

const TIPOS_PLANO_LABEL: Record<string, string> = {
  wide: "Plano Aberto",
  medium: "Plano Médio",
  "close-up": "Close-up",
  macro: "Macro",
  drone: "Drone",
  pov: "POV",
  "over-the-shoulder": "Sobre o ombro",
};

export const RoteiristaIA = () => {
  const navigate = useNavigate();
  const {
    generating, roteiroAtual, roteiroId, historico, loadingHistorico,
    gerarRoteiro, carregarRoteiro, novoRoteiro, excluirRoteiro,
    atualizarStatus, atualizarCena,
  } = useRoteiristaIA();
  const narracao = useNarracao();
  const [vozSelecionada, setVozSelecionada] = useState(VOZES_NARRACAO[0].id);
  const [gerandoLote, setGerandoLote] = useState(false);
  const [progressoLote, setProgressoLote] = useState({ done: 0, total: 0 });

  // Briefing state
  const [tema, setTema] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");
  const [tom, setTom] = useState("cinematográfico");
  const [duracaoTotal, setDuracaoTotal] = useState(30);
  const [numeroCenas, setNumeroCenas] = useState(5);
  const [formato, setFormato] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [paletaCores, setPaletaCores] = useState<string[]>([]);
  const [novaCor, setNovaCor] = useState("#1a1a1a");

  // Fontes state
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [novoTexto, setNovoTexto] = useState("");
  const [novaUrl, setNovaUrl] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adicionarFonteTexto = () => {
    if (!novoTexto.trim()) return;
    setFontes(prev => [...prev, {
      id: crypto.randomUUID(),
      tipo: "texto",
      titulo: `Texto ${prev.filter(f => f.tipo === "texto").length + 1}`,
      conteudo: novoTexto.trim(),
    }]);
    setNovoTexto("");
    toast.success("Texto adicionado");
  };

  const adicionarFonteURL = async () => {
    if (!novaUrl.trim()) return;
    setExtraindo(true);
    try {
      const conteudo = await extrairTextoURL(novaUrl.trim());
      setFontes(prev => [...prev, {
        id: crypto.randomUUID(),
        tipo: "url",
        titulo: novaUrl.trim().slice(0, 60),
        conteudo: conteudo.slice(0, 8000),
      }]);
      setNovaUrl("");
      toast.success("Conteúdo da URL extraído");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao extrair URL");
    } finally {
      setExtraindo(false);
    }
  };

  const adicionarFontePDF = async (file: File) => {
    setExtraindo(true);
    try {
      const texto = await extrairTextoPDF(file);
      setFontes(prev => [...prev, {
        id: crypto.randomUUID(),
        tipo: "pdf",
        titulo: file.name,
        conteudo: texto,
      }]);
      toast.success(`PDF "${file.name}" extraído (${texto.length} chars)`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao extrair PDF");
    } finally {
      setExtraindo(false);
    }
  };

  const removerFonte = (id: string) => {
    setFontes(prev => prev.filter(f => f.id !== id));
  };

  const adicionarCor = () => {
    if (!paletaCores.includes(novaCor)) {
      setPaletaCores(prev => [...prev, novaCor]);
    }
  };

  const handleGerar = async () => {
    const briefing: Briefing = {
      tema,
      objetivo: objetivo || undefined,
      publico_alvo: publicoAlvo || undefined,
      tom,
      duracao_total: duracaoTotal,
      numero_cenas: numeroCenas,
      formato,
      paleta_cores: paletaCores.length > 0 ? paletaCores : undefined,
    };
    await gerarRoteiro(briefing, fontes);
  };

  const enviarParaVideo = async () => {
    if (!roteiroAtual || !roteiroId) return;
    // Salva no sessionStorage para ser lido pelo NanoBananaVideoEngine
    const cenasFormatadas = roteiroAtual.cenas.map(c => ({
      description: c.descricao_visual,
      duration: c.duracao_segundos,
    }));
    sessionStorage.setItem("roteiro_para_video", JSON.stringify({
      roteiroId,
      titulo: roteiroAtual.titulo,
      formato,
      cenas: cenasFormatadas,
      conceito_visual: roteiroAtual.conceito_visual,
    }));
    await atualizarStatus(roteiroId, "enviado_para_video");
    toast.success("Roteiro enviado para o gerador de vídeo");
    navigate("/dashboard/marketing/nano-banana-video");
  };

  const gerarTodasNarracoes = async () => {
    if (!roteiroAtual) return;
    const itens = roteiroAtual.cenas
      .map((c, i) => ({
        key: `cena-${i}`,
        texto: (c.narracao || "").trim(),
        previous: roteiroAtual.cenas[i - 1]?.narracao || undefined,
        next: roteiroAtual.cenas[i + 1]?.narracao || undefined,
      }))
      .filter(it => it.texto.length > 0);

    if (itens.length === 0) {
      toast.error("Nenhuma cena tem texto de narração");
      return;
    }

    setGerandoLote(true);
    setProgressoLote({ done: 0, total: itens.length });
    try {
      await narracao.gerarLote(itens, vozSelecionada, (done, total) =>
        setProgressoLote({ done, total }),
      );
      toast.success(`${itens.length} narrações geradas`);
    } finally {
      setGerandoLote(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-primary" />
                Roteirista IA Cinematográfico
              </CardTitle>
              <CardDescription>
                Transforme fontes (PDF, URLs, textos) em roteiros estruturados prontos para vídeo IA
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {roteiroAtual && (
                <Button variant="outline" size="sm" onClick={novoRoteiro}>
                  <Plus className="h-3 w-3 mr-1" /> Novo
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coluna 1: Fontes + Briefing */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Fontes ({fontes.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Adicione PDFs, URLs ou textos como inspiração
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Tabs defaultValue="texto">
                <TabsList className="grid grid-cols-3 w-full h-9">
                  <TabsTrigger value="texto" className="text-xs"><Type className="h-3 w-3 mr-1" />Texto</TabsTrigger>
                  <TabsTrigger value="url" className="text-xs"><LinkIcon className="h-3 w-3 mr-1" />URL</TabsTrigger>
                  <TabsTrigger value="pdf" className="text-xs"><Upload className="h-3 w-3 mr-1" />PDF</TabsTrigger>
                </TabsList>
                <TabsContent value="texto" className="space-y-2 mt-3">
                  <Textarea
                    placeholder="Cole texto, briefing, transcrição..."
                    value={novoTexto}
                    onChange={e => setNovoTexto(e.target.value)}
                    rows={4}
                    className="text-xs"
                  />
                  <Button size="sm" onClick={adicionarFonteTexto} disabled={!novoTexto.trim()} className="w-full">
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </TabsContent>
                <TabsContent value="url" className="space-y-2 mt-3">
                  <Input
                    placeholder="https://..."
                    value={novaUrl}
                    onChange={e => setNovaUrl(e.target.value)}
                    className="text-xs"
                  />
                  <Button size="sm" onClick={adicionarFonteURL} disabled={!novaUrl.trim() || extraindo} className="w-full">
                    {extraindo ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <LinkIcon className="h-3 w-3 mr-1" />}
                    Extrair URL
                  </Button>
                </TabsContent>
                <TabsContent value="pdf" className="space-y-2 mt-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) adicionarFontePDF(file);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={extraindo}
                    className="w-full"
                  >
                    {extraindo ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                    Carregar PDF
                  </Button>
                  <p className="text-[10px] text-muted-foreground">Até 30 páginas serão lidas</p>
                </TabsContent>
              </Tabs>

              {fontes.length > 0 && (
                <>
                  <Separator />
                  <ScrollArea className="h-40">
                    <div className="space-y-2 pr-2">
                      {fontes.map(f => (
                        <div key={f.id} className="flex items-start gap-2 p-2 border rounded-md bg-muted/30">
                          {f.tipo === "pdf" && <FileText className="h-3 w-3 mt-0.5 text-primary shrink-0" />}
                          {f.tipo === "url" && <LinkIcon className="h-3 w-3 mt-0.5 text-primary shrink-0" />}
                          {f.tipo === "texto" && <Type className="h-3 w-3 mt-0.5 text-primary shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{f.titulo}</p>
                            <p className="text-[10px] text-muted-foreground">{f.conteudo.length} chars</p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removerFonte(f.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Briefing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Tema do vídeo *</Label>
                <Input
                  placeholder="Ex: Lançamento do produto X"
                  value={tema}
                  onChange={e => setTema(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Objetivo</Label>
                <Input
                  placeholder="Ex: Gerar vendas no Instagram"
                  value={objetivo}
                  onChange={e => setObjetivo(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Público-alvo</Label>
                <Input
                  placeholder="Ex: Mulheres 25-40, classe B+"
                  value={publicoAlvo}
                  onChange={e => setPublicoAlvo(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tom</Label>
                  <Select value={tom} onValueChange={setTom}>
                    <SelectTrigger className="text-xs h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TONS.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Formato</Label>
                  <Select value={formato} onValueChange={(v) => setFormato(v as typeof formato)}>
                    <SelectTrigger className="text-xs h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9:16" className="text-xs">9:16 Vertical</SelectItem>
                      <SelectItem value="16:9" className="text-xs">16:9 Horizontal</SelectItem>
                      <SelectItem value="1:1" className="text-xs">1:1 Quadrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Duração (s)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={duracaoTotal}
                    onChange={e => setDuracaoTotal(Number(e.target.value))}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Nº cenas</Label>
                  <Input
                    type="number"
                    min={3}
                    max={8}
                    value={numeroCenas}
                    onChange={e => setNumeroCenas(Number(e.target.value))}
                    className="text-xs mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Paleta de cores</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="color"
                    value={novaCor}
                    onChange={e => setNovaCor(e.target.value)}
                    className="h-9 w-14 p-1"
                  />
                  <Button size="sm" variant="outline" onClick={adicionarCor} className="h-9">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {paletaCores.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {paletaCores.map(c => (
                      <button
                        key={c}
                        onClick={() => setPaletaCores(prev => prev.filter(x => x !== c))}
                        className="h-6 w-6 rounded border-2 border-border hover:border-destructive transition-colors"
                        style={{ backgroundColor: c }}
                        title={`${c} — clique para remover`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Button
                onClick={handleGerar}
                disabled={generating || !tema.trim()}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando roteiro...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Gerar Roteiro IA</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 2-3: Storyboard */}
        <div className="lg:col-span-2 space-y-4">
          {!roteiroAtual ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Clapperboard className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <h3 className="font-semibold text-foreground mb-2">Nenhum roteiro gerado</h3>
                <p className="text-sm">
                  Adicione fontes (opcional), preencha o briefing e clique em "Gerar Roteiro IA".<br />
                  A IA estruturará as cenas em formato cinematográfico pronto para produção.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{roteiroAtual.titulo}</CardTitle>
                      <CardDescription className="mt-1">{roteiroAtual.sinopse}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {roteiroId && (
                        <Button size="sm" variant="outline" onClick={() => atualizarStatus(roteiroId, "aprovado")}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                        </Button>
                      )}
                      <Button size="sm" onClick={enviarParaVideo} disabled={!roteiroId}>
                        <Send className="h-3 w-3 mr-1" /> Enviar p/ Vídeo
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-muted/30 rounded-md border">
                    <p className="text-xs font-semibold mb-1">Conceito Visual</p>
                    <p className="text-xs text-muted-foreground">{roteiroAtual.conceito_visual}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {roteiroAtual.hashtags.map(h => (
                      <Badge key={h} variant="secondary" className="text-[10px]">#{h.replace(/^#/, "")}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Mic className="h-4 w-4 text-primary" /> Narração IA (ElevenLabs)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Gere a locução de cada cena automaticamente a partir do texto de narração
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                    <div>
                      <Label className="text-xs">Voz</Label>
                      <Select value={vozSelecionada} onValueChange={setVozSelecionada}>
                        <SelectTrigger className="text-xs h-9 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VOZES_NARRACAO.map(v => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">
                              <span className="font-medium">{v.nome}</span>
                              <span className="text-muted-foreground"> — {v.descricao}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      onClick={gerarTodasNarracoes}
                      disabled={gerandoLote}
                      className="h-9"
                    >
                      {gerandoLote ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {progressoLote.done}/{progressoLote.total}</>
                      ) : (
                        <><Volume2 className="h-3 w-3 mr-1" /> Gerar Todas</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Video className="h-4 w-4" /> Storyboard ({roteiroAtual.cenas.length} cenas)
                </h3>
                {roteiroAtual.cenas.map((cena, idx) => (
                  <CenaCard
                    key={idx}
                    cena={cena}
                    index={idx}
                    onUpdate={(p) => atualizarCena(idx, p)}
                    narracao={narracao}
                    vozId={vozSelecionada}
                    contextoNarracao={{
                      previous: roteiroAtual.cenas[idx - 1]?.narracao,
                      next: roteiroAtual.cenas[idx + 1]?.narracao,
                    }}
                  />
                ))}
              </div>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold mb-1">Call-to-Action Final</p>
                  <p className="text-sm">{roteiroAtual.cta}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico ({historico.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2 pr-2">
                {loadingHistorico ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  historico.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-2 p-2 border rounded-md hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.titulo}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{r.roteiro?.cenas?.length || 0} cenas</Badge>
                          <Badge variant={r.status === "aprovado" ? "default" : r.status === "enviado_para_video" ? "secondary" : "outline"} className="text-[10px]">
                            {r.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => carregarRoteiro(r)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => excluirRoteiro(r.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const CenaCard = ({ cena, index, onUpdate }: { cena: Cena; index: number; onUpdate: (p: Partial<Cena>) => void }) => {
  const [editing, setEditing] = useState(false);

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" className="text-xs">Cena {cena.numero}</Badge>
            <h4 className="font-semibold text-sm">{cena.titulo}</h4>
            <Badge variant="outline" className="text-[10px]">{cena.duracao_segundos}s</Badge>
            <Badge variant="secondary" className="text-[10px]">
              <Camera className="h-2.5 w-2.5 mr-1" />
              {TIPOS_PLANO_LABEL[cena.tipo_plano] || cena.tipo_plano}
            </Badge>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(!editing)}>
            {editing ? "Salvar" : "Editar"}
          </Button>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Movimento de câmera</p>
            <p className="text-xs">{cena.movimento_camera}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Prompt visual (EN)</p>
            {editing ? (
              <Textarea
                value={cena.descricao_visual}
                onChange={e => onUpdate({ descricao_visual: e.target.value })}
                rows={3}
                className="text-xs"
              />
            ) : (
              <p className="text-xs bg-muted/40 p-2 rounded border italic">{cena.descricao_visual}</p>
            )}
          </div>

          {cena.narracao && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Narração</p>
              {editing ? (
                <Textarea
                  value={cena.narracao}
                  onChange={e => onUpdate({ narracao: e.target.value })}
                  rows={2}
                  className="text-xs"
                />
              ) : (
                <p className="text-xs">"{cena.narracao}"</p>
              )}
            </div>
          )}

          {cena.audio_ambiente && (
            <div className="flex items-center gap-2">
              <Music className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground">{cena.audio_ambiente}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
