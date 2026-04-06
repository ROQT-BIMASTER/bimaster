import React, { useState } from "react";
import { useOrcamentosAlternativos } from "@/hooks/useOrcamentosAlternativos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Check, FileDown, Upload, X, Loader2 } from "lucide-react";

interface Props {
  revisaoId: string;
  valorAtual: number;
}

export function OrcamentosAlternativos({ revisaoId, valorAtual }: Props) {
  const { orcamentos, isLoading, addOrcamento, isAdding, deleteOrcamento, selectOrcamento } = useOrcamentosAlternativos(revisaoId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fornecedor: "", valor: "", descricao: "", validade: "" });
  const [arquivo, setArquivo] = useState<File | null>(null);

  const fmtCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const menorValor = orcamentos.length > 0 ? Math.min(...orcamentos.map(o => Number(o.valor_proposta))) : null;

  const handleSubmit = async () => {
    if (!form.fornecedor || !form.valor) return;
    await addOrcamento({
      revisaoId,
      fornecedorNome: form.fornecedor,
      valorProposta: parseFloat(form.valor),
      descricao: form.descricao || undefined,
      validade: form.validade || undefined,
      arquivo: arquivo || undefined,
    });
    setForm({ fornecedor: "", valor: "", descricao: "", validade: "" });
    setArquivo(null);
    setShowForm(false);
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Upload className="h-4 w-4 text-primary" />
          Orçamentos Alternativos
          {orcamentos.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">{orcamentos.length}</Badge>
          )}
        </h4>
        {!showForm && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowForm(true)}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-muted/50 rounded-lg p-3 mb-3 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Input
              placeholder="Fornecedor *"
              value={form.fornecedor}
              onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
              className="h-8 text-xs"
            />
            <Input
              type="number"
              placeholder="Valor proposta *"
              value={form.valor}
              onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              className="h-8 text-xs"
              step="0.01"
            />
            <Input
              placeholder="Descrição"
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              className="h-8 text-xs"
            />
            <Input
              type="date"
              placeholder="Validade"
              value={form.validade}
              onChange={e => setForm(f => ({ ...f, validade: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer border border-dashed border-border rounded px-2 py-1 hover:bg-muted/80 transition-colors">
              <Upload className="h-3 w-3" />
              {arquivo ? arquivo.name : "Anexar arquivo"}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={e => setArquivo(e.target.files?.[0] || null)}
              />
            </label>
            <div className="ml-auto flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowForm(false); setArquivo(null); }}>
                <X className="h-3 w-3 mr-1" /> Cancelar
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={isAdding || !form.fornecedor || !form.valor}>
                {isAdding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-muted-foreground py-2">Carregando...</div>
      ) : orcamentos.length === 0 && !showForm ? (
        <div className="text-xs text-muted-foreground py-1">Nenhum orçamento alternativo cadastrado.</div>
      ) : (
        <div className="space-y-1.5">
          {orcamentos.map(orc => {
            const valor = Number(orc.valor_proposta);
            const economia = valorAtual - valor;
            const isMenor = menorValor !== null && valor === menorValor;

            return (
              <div
                key={orc.id}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs border transition-colors ${
                  orc.selecionado
                    ? "border-primary/50 bg-primary/5"
                    : isMenor
                    ? "border-success/30 bg-success/5"
                    : "border-border bg-background"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{orc.fornecedor_nome}</span>
                    {orc.selecionado && <Badge variant="default" className="text-[10px] px-1.5 py-0">Selecionado</Badge>}
                    {isMenor && !orc.selecionado && <Badge variant="success" className="text-[10px] px-1.5 py-0">Menor preço</Badge>}
                  </div>
                  {orc.descricao && <div className="text-muted-foreground truncate mt-0.5">{orc.descricao}</div>}
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-semibold">{fmtCurrency(valor)}</div>
                  {economia > 0 && (
                    <div className="text-[10px] text-success">
                      Economia: {fmtCurrency(economia)} ({((economia / valorAtual) * 100).toFixed(1)}%)
                    </div>
                  )}
                </div>

                {orc.validade && (
                  <div className="text-muted-foreground shrink-0">
                    Val: {new Date(orc.validade).toLocaleDateString("pt-BR")}
                  </div>
                )}

                <div className="flex items-center gap-0.5 shrink-0">
                  {orc.arquivo_url && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                      <a href={orc.arquivo_url} target="_blank" rel="noopener noreferrer" title="Download">
                        <FileDown className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                  {!orc.selecionado && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="Selecionar como substituto"
                      onClick={() => selectOrcamento({ id: orc.id, revisaoId, fornecedorNome: orc.fornecedor_nome })}
                    >
                      <Check className="h-3 w-3 text-success" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Excluir" onClick={() => deleteOrcamento(orc.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
