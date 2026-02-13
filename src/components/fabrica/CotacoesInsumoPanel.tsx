import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Check, TrendingDown, TrendingUp, Upload, FileText, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { resolveStorageUrl } from "@/lib/utils/storage-url";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Cotacao {
  id: string;
  produto_custo_id: string;
  produto_id: string;
  mp_id: string | null;
  fornecedor_nome: string;
  valor_unitario: number;
  custo_nf: number;
  custo_servico: number;
  custo_condicao: number;
  condicao_pagamento: string | null;
  validade: string | null;
  observacoes: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  selecionada: boolean;
  usuario_nome: string | null;
  created_at: string;
}

interface Props {
  produtoCustoId: string;
  produtoId: string;
  mpId: string | null;
  custoAtualNF: number;
  custoAtualServico: number;
  custoAtualCondicao: number;
  insumoNome: string;
  onAplicarCotacao?: (fornecedorNome: string, custoNF: number, custoServico: number, custoCondicao: number) => void;
}

const calcTotal = (c: Cotacao) => Number(c.custo_nf) + Number(c.custo_servico) + Number(c.custo_condicao);

export function CotacoesInsumoPanel({ produtoCustoId, produtoId, mpId, custoAtualNF, custoAtualServico, custoAtualCondicao, insumoNome, onAplicarCotacao }: Props) {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fornecedor, setFornecedor] = useState("");
  const [formNF, setFormNF] = useState("");
  const [formServico, setFormServico] = useState("");
  const [formCondicao, setFormCondicao] = useState("");
  const [condicao, setCondicao] = useState("");
  const [validade, setValidade] = useState("");
  const [obs, setObs] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nfRef, setNfRef] = useState("");

  const custoAtualTotal = custoAtualNF + custoAtualServico + custoAtualCondicao;

  const carregarCotacoes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fabrica_mp_cotacoes")
      .select("*")
      .eq("produto_custo_id", produtoCustoId)
      .order("created_at", { ascending: false });
    if (data) setCotacoes(data as unknown as Cotacao[]);
    setLoading(false);
  }, [produtoCustoId]);

  useEffect(() => {
    carregarCotacoes();
  }, [carregarCotacoes]);

  const formatarMoeda = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 6 });

  const totais = cotacoes.map(c => ({ ...c, total: calcTotal(c) }));
  const menorTotal = totais.length > 0 ? Math.min(...totais.map(c => c.total)) : 0;
  const maiorTotal = totais.length > 0 ? Math.max(...totais.map(c => c.total)) : 0;
  const cotacaoMenor = totais.find(c => c.total === menorTotal);
  const economiaUnidade = custoAtualTotal > 0 && menorTotal > 0 ? custoAtualTotal - menorTotal : 0;
  const economiaPct = custoAtualTotal > 0 && menorTotal > 0 ? ((custoAtualTotal - menorTotal) / custoAtualTotal) * 100 : 0;

  const handleSalvar = async () => {
    if (!fornecedor.trim()) return;
    const nf = parseFloat((formNF || "0").replace(",", ".")) || 0;
    const serv = parseFloat((formServico || "0").replace(",", ".")) || 0;
    const cond = parseFloat((formCondicao || "0").replace(",", ".")) || 0;
    if (nf === 0 && serv === 0 && cond === 0) {
      toast.error("Informe ao menos um valor de custo");
      return;
    }
    setSaving(true);
    try {
      let arquivoUrl: string | null = null;
      let arquivoNome: string | null = null;

      if (arquivo) {
        const ext = arquivo.name.split(".").pop();
        const path = `${produtoId}/${produtoCustoId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("fabrica-cotacoes").upload(path, arquivo);
        if (upErr) throw upErr;
        const { data: signedData, error: signError } = await supabase.storage
          .from("fabrica-cotacoes")
          .createSignedUrl(path, 31536000); // 1 ano
        if (signError || !signedData?.signedUrl) throw signError || new Error('Failed to generate signed URL');
        arquivoUrl = signedData.signedUrl;
        arquivoNome = arquivo.name;
      }

      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("fabrica_mp_cotacoes").insert({
        produto_custo_id: produtoCustoId,
        produto_id: produtoId,
        mp_id: mpId,
        fornecedor_nome: fornecedor,
        valor_unitario: nf + serv + cond,
        custo_nf: nf,
        custo_servico: serv,
        custo_condicao: cond,
        condicao_pagamento: condicao || null,
        validade: validade || null,
        observacoes: obs || null,
        arquivo_url: arquivoUrl,
        arquivo_nome: arquivoNome,
        usuario_id: user?.id,
        usuario_nome: user?.user_metadata?.nome || user?.email || "",
      } as any);

      toast.success("Cotação adicionada");
      setDialogOpen(false);
      resetForm();
      carregarCotacoes();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFornecedor("");
    setFormNF("");
    setFormServico("");
    setFormCondicao("");
    setCondicao("");
    setValidade("");
    setObs("");
    setArquivo(null);
    setNfRef("");
  };

  const handleSelecionar = async (cotacaoId: string) => {
    await supabase.from("fabrica_mp_cotacoes").update({ selecionada: false } as any).eq("produto_custo_id", produtoCustoId);
    await supabase.from("fabrica_mp_cotacoes").update({ selecionada: true } as any).eq("id", cotacaoId);
    carregarCotacoes();
    toast.success("Cotação selecionada");
  };

  const handleRemover = async (id: string) => {
    await supabase.from("fabrica_mp_cotacoes").delete().eq("id", id);
    carregarCotacoes();
    toast.success("Cotação removida");
  };

  const handleAplicar = (cotacao: Cotacao) => {
    if (onAplicarCotacao) {
      onAplicarCotacao(cotacao.fornecedor_nome, Number(cotacao.custo_nf), Number(cotacao.custo_servico), Number(cotacao.custo_condicao));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Star className="h-4 w-4 text-amber-500" />
          Cotações / Orçamentos
        </h4>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nova Cotação
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-2">Carregando...</p>
      ) : cotacoes.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhuma cotação registrada para este insumo.</p>
      ) : (
        <>
          {/* Resumo comparativo */}
          <div className="bg-muted/50 rounded-lg p-3 mb-3 text-sm">
            <div className="flex flex-wrap gap-4">
              <span>{cotacoes.length} cotação(ões)</span>
              <span>Menor total: <strong className="text-green-700">{formatarMoeda(menorTotal)}</strong> ({cotacaoMenor?.fornecedor_nome})</span>
              <span>Maior: <strong className="text-destructive">{formatarMoeda(maiorTotal)}</strong></span>
              {economiaPct > 0 && (
                <span className="text-green-700 font-medium flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Economia potencial: {formatarMoeda(economiaUnidade)} (-{economiaPct.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>

          {/* Cards de cotações */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {totais.map((c) => {
              const isMenor = c.total === menorTotal && cotacoes.length > 1;
              const varPct = custoAtualTotal > 0 ? ((c.total - custoAtualTotal) / custoAtualTotal) * 100 : 0;
              return (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg border text-sm space-y-1.5 ${
                    c.selecionada ? "border-primary bg-primary/5" : isMenor ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{c.fornecedor_nome}</span>
                    <div className="flex items-center gap-1">
                      {c.selecionada && <Badge className="bg-primary text-primary-foreground text-[10px]">Selecionada</Badge>}
                      {isMenor && !c.selecionada && <Badge className="bg-green-100 text-green-800 text-[10px]">Melhor Preço</Badge>}
                    </div>
                  </div>

                  {/* Breakdown NF / Serviço / Condição */}
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="bg-muted/50 rounded p-1.5 text-center">
                      <span className="text-muted-foreground block">NF</span>
                      <span className="font-mono font-medium">{formatarMoeda(Number(c.custo_nf))}</span>
                    </div>
                    <div className="bg-muted/50 rounded p-1.5 text-center">
                      <span className="text-muted-foreground block">Serviço</span>
                      <span className="font-mono font-medium">{formatarMoeda(Number(c.custo_servico))}</span>
                    </div>
                    <div className="bg-muted/50 rounded p-1.5 text-center">
                      <span className="text-muted-foreground block">Condição</span>
                      <span className="font-mono font-medium">{formatarMoeda(Number(c.custo_condicao))}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold">Total: {formatarMoeda(c.total)}</span>
                    {custoAtualTotal > 0 && (
                      <span className={`text-xs font-medium flex items-center gap-0.5 ${varPct > 0 ? "text-destructive" : varPct < 0 ? "text-green-600" : "text-muted-foreground"}`}>
                        {varPct > 0 ? <TrendingUp className="h-3 w-3" /> : varPct < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                        {varPct > 0 ? "+" : ""}{varPct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {c.condicao_pagamento && <p className="text-xs text-muted-foreground">Pagamento: {c.condicao_pagamento}</p>}
                  {c.validade && <p className="text-xs text-muted-foreground">Validade: {format(new Date(c.validade), "dd/MM/yyyy", { locale: ptBR })}</p>}
                  {c.observacoes && <p className="text-xs text-muted-foreground italic">{c.observacoes}</p>}
                  {c.arquivo_url && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-1" onClick={async () => {
                      const { signedUrl, error } = await resolveStorageUrl(c.arquivo_url!);
                      if (error || !signedUrl) { toast.error(error || "Erro ao abrir arquivo"); return; }
                      window.open(signedUrl, "_blank");
                    }}>
                      <FileText className="h-3 w-3 mr-1" /> {c.arquivo_nome || "Ver arquivo"}
                    </Button>
                  )}
                  <div className="flex gap-1 pt-1">
                    {!c.selecionada && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSelecionar(c.id)}>
                        <Check className="h-3 w-3 mr-1" /> Selecionar
                      </Button>
                    )}
                    {onAplicarCotacao && (
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleAplicar(c)}>
                        Aplicar Cotação
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleRemover(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Dialog Nova Cotação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Cotação — {insumoNome}</DialogTitle>
            <DialogDescription>Registre o orçamento recebido de um fornecedor com os custos detalhados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Fornecedor *</Label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
            </div>

            {/* Campos de custo iguais à tabela de insumos */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>NF (R$) *</Label>
                <Input value={formNF} onChange={(e) => setFormNF(e.target.value)} placeholder="0.0000" inputMode="decimal" />
              </div>
              <div className="space-y-1">
                <Label>Serviço (R$)</Label>
                <Input value={formServico} onChange={(e) => setFormServico(e.target.value)} placeholder="0.0000" inputMode="decimal" />
              </div>
              <div className="space-y-1">
                <Label>Condição (R$)</Label>
                <Input value={formCondicao} onChange={(e) => setFormCondicao(e.target.value)} placeholder="0.0000" inputMode="decimal" />
              </div>
            </div>

            {/* Total calculado */}
            {(formNF || formServico || formCondicao) && (
              <div className="bg-muted/50 rounded p-2 text-sm text-center">
                Total: <strong>{formatarMoeda(
                  (parseFloat((formNF || "0").replace(",", ".")) || 0) +
                  (parseFloat((formServico || "0").replace(",", ".")) || 0) +
                  (parseFloat((formCondicao || "0").replace(",", ".")) || 0)
                )}</strong>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Condição de Pagamento</Label>
                <Input value={condicao} onChange={(e) => setCondicao(e.target.value)} placeholder="Ex: 30/60/90 dias" />
              </div>
              <div className="space-y-1">
                <Label>Validade</Label>
                <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>NF Referência</Label>
              <Input value={nfRef} onChange={(e) => setNfRef(e.target.value)} placeholder="NF12345" />
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Observações adicionais..." />
            </div>
            <div className="space-y-1">
              <Label>Arquivo (Orçamento PDF)</Label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
                  <Button variant="outline" size="sm" type="button" onClick={(e) => {
                    const input = (e.currentTarget.parentElement as HTMLLabelElement)?.querySelector("input");
                    input?.click();
                  }}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Selecionar
                  </Button>
                </label>
                {arquivo && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{arquivo.name}</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={saving || !fornecedor.trim()}>
              {saving ? "Salvando..." : "Salvar Cotação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
