import { useState, useEffect, useMemo, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, ChevronsUpDown, Check, Info } from "lucide-react";
import { IACategorySuggestion } from "@/components/financeiro/ap/IACategorySuggestion";
import { ChaveAcessoInput, type XmlExtractedData } from "@/components/financeiro/ChaveAcessoInput";
import { PostPaymentErpPrompt } from "@/components/financeiro/ap/PostPaymentErpPrompt";
import { callApi, callExportApi, dateToApi, enqueueErpSync } from "@/lib/utils/api-helpers";
import { cn } from "@/lib/utils";
import { debounce } from "@/lib/utils/debounce";

export default function CadastroTituloAP() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  // Form state
  const [codigoIntegracao, setCodigoIntegracao] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [fornecedorCodigo, setFornecedorCodigo] = useState("");
  const [fornecedorLabel, setFornecedorLabel] = useState("");
  const [fornecedorBusca, setFornecedorBusca] = useState("");
  const [fornecedorBuscaDebounced, setFornecedorBuscaDebounced] = useState("");
  const [fornecedorOpen, setFornecedorOpen] = useState(false);
  const [valorDocumento, setValorDocumento] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [contaCorrente, setContaCorrente] = useState("");
  const [categoria, setCategoria] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [projeto, setProjeto] = useState("");
  const [observacao, setObservacao] = useState("");
  const [nfeChave, setNfeChave] = useState("");

  // Parcelamento
  const [condicaoParcela, setCondicaoParcela] = useState("");
  const [numParcelas, setNumParcelas] = useState("");

  // IA suggestion
  const [iaSugestao, setIaSugestao] = useState<{ nome: string; confianca: number; id: string } | null>(null);

  // ERP prompt
  const [erpPromptId, setErpPromptId] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Debounced fornecedor search
  const debouncedSetFornecedorBusca = useMemo(
    () => debounce((v: string) => setFornecedorBuscaDebounced(v), 400),
    []
  );

  // Load existing title for edit
  const { data: existingTitle, isLoading: loadingTitle } = useQuery({
    queryKey: ["ap-titulo-edit", id],
    queryFn: () => callApi("contas-pagar-api", { path: "/consultar", id }),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingTitle && isEdit) {
      const t = existingTitle;
      setCodigoIntegracao(t.codigo_lancamento_integracao || "");
      setNumeroDocumento(t.numero_documento || "");
      setFornecedorCodigo(String(t.codigo_cliente_fornecedor || ""));
      setFornecedorLabel(t.fornecedor_nome || "");
      setValorDocumento(String(t.valor_documento || ""));
      setDataVencimento(t.data_vencimento || "");
      setDataPrevisao(t.data_previsao || "");
      setContaCorrente(String(t.id_conta_corrente || ""));
      setCategoria(t.codigo_categoria || "");
      setDepartamento(t.departamento_id || "");
      setObservacao(t.observacao || "");
    }
  }, [existingTitle, isEdit]);

  // Lookups
  const { data: fornecedores } = useQuery({
    queryKey: ["ap-fornecedores", fornecedorBuscaDebounced],
    queryFn: () => callApi("clientes-api", {
      path: "/listar",
      pagina: 1,
      registros_por_pagina: 50,
      ...(fornecedorBuscaDebounced ? { clientesFiltro: { razao_social: fornecedorBuscaDebounced } } : {}),
    }),
    staleTime: 60_000,
  });

  const { data: categorias } = useQuery({
    queryKey: ["ap-categorias"],
    queryFn: () => callApi("categorias-api", { path: "/listar" }),
    staleTime: 120_000,
  });

  const { data: departamentos } = useQuery({
    queryKey: ["ap-departamentos"],
    queryFn: () => callApi("departamentos-api", { path: "/listar" }),
    staleTime: 120_000,
  });

  const { data: projetos } = useQuery({
    queryKey: ["ap-projetos"],
    queryFn: () => callApi("projetos-api", { path: "/listar" }),
    staleTime: 120_000,
  });

  const { data: contasCC } = useQuery({
    queryKey: ["ap-contas-correntes"],
    queryFn: () => callApi("contas-correntes-api", { path: "/resumo" }),
    staleTime: 120_000,
  });

  const { data: condicoesParcelas } = useQuery({
    queryKey: ["ap-parcelas-condicoes"],
    queryFn: () => callApi("parcelas-api", { path: "/listar" }),
    staleTime: 120_000,
  });

  // IA classification on category change
  useEffect(() => {
    if (!categoria || isEdit) return;
    const timer = setTimeout(async () => {
      try {
        const result = await callApi("classificar-contas-pagar-ia", {
          descricao: categoria,
          fornecedor: fornecedorLabel,
          valor: Number(valorDocumento) || 0,
        });
        if (result?.confianca > 0.85 && result?.departamento_id) {
          setIaSugestao({
            nome: result.departamento_nome || result.departamento_id,
            confianca: result.confianca,
            id: result.departamento_id,
          });
        } else {
          setIaSugestao(null);
        }
      } catch {
        setIaSugestao(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [categoria]);

  // Validation — auto-generate codigoIntegracao if empty (not required)
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!fornecedorCodigo) errs.fornecedor = "Selecione um fornecedor";
    if (!valorDocumento || Number(valorDocumento) <= 0) errs.valor = "Valor deve ser maior que zero";
    if (!dataVencimento) errs.dataVencimento = "Data de vencimento é obrigatória";
    if (!categoria) errs.categoria = "Categoria é obrigatória";
    if (!contaCorrente) errs.contaCorrente = "Conta corrente é obrigatória";
    if (nfeChave && !/^\d{44}$/.test(nfeChave)) errs.nfeChave = "Chave NF-e deve ter exatamente 44 dígitos numéricos";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Preencha os campos obrigatórios corretamente");
      return false;
    }
    return true;
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("Validação falhou");

      // Auto-generate integration code if empty
      const finalCode = codigoIntegracao.trim() || `BIM-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      const body: any = {
        codigo_lancamento_integracao: finalCode,
        codigo_cliente_fornecedor: Number(fornecedorCodigo),
        data_vencimento: dateToApi(dataVencimento),
        valor_documento: Number(valorDocumento),
        codigo_categoria: categoria,
        data_previsao: dateToApi(dataPrevisao || dataVencimento),
        id_conta_corrente: Number(contaCorrente),
      };
      if (departamento) body.departamento_id = departamento;
      if (projeto) body.projeto_id = projeto;
      if (numeroDocumento) body.numero_documento = numeroDocumento;
      if (observacao) body.observacao = observacao;
      if (numParcelas && Number(numParcelas) > 1) {
        body.quantidade_parcelas = Number(numParcelas);
        if (condicaoParcela) body.codigo_parcela = condicaoParcela;
      }

      if (isEdit) {
        return callApi("contas-pagar-api", { path: "/alterar", ...body });
      } else {
        return callApi("contas-pagar-api", { path: "/incluir", ...body });
      }
    },
    onSuccess: (data) => {
      const msg = isEdit ? "Título atualizado com sucesso!" : `Título incluído! Código Huggs: ${data?.codigo_lancamento_huggs || "—"}`;
      toast.success(msg);

      if (nfeChave && nfeChave.length === 44) {
        callApi("process-nfe-xml", { chave_acesso: nfeChave }).catch(() => {});
      }

      if (!isEdit) {
        setErpPromptId(data?.id || data?.codigo_lancamento_integracao || codigoIntegracao);
      } else {
        navigate(-1);
      }
    },
    onError: (e: any) => {
      if (e.message !== "Validação falhou") toast.error(e.message);
    },
  });

  if (isEdit && loadingTitle) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  const fornecedoresList = fornecedores?.clientes_cadastro || fornecedores?.data || [];
  const categoriasList = categorias?.data || categorias?.categorias || [];
  const departamentosList = departamentos?.data || departamentos?.departamentos || [];
  const projetosList = projetos?.data || projetos?.projetos || [];
  const contasCCList = contasCC?.data || contasCC?.contas || [];
  const parcelasList = condicoesParcelas?.data || condicoesParcelas?.parcelas || [];

  // Parcelamento preview
  const parcPreview = (() => {
    if (!numParcelas || Number(numParcelas) <= 1 || !valorDocumento || !dataVencimento) return [];
    const n = Number(numParcelas);
    const val = Number(valorDocumento);
    if (val <= 0 || n <= 0) return [];
    const parcVal = Math.floor((val / n) * 100) / 100;
    const diff = Math.round((val - parcVal * n) * 100) / 100;
    const result = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(dataVencimento);
      d.setMonth(d.getMonth() + i);
      result.push({
        num: i + 1,
        valor: i === 0 ? parcVal + diff : parcVal,
        vencimento: d.toLocaleDateString("pt-BR"),
      });
    }
    return result;
  })();

  function FieldError({ field }: { field: string }) {
    return errors[field] ? <p className="text-xs text-destructive mt-1">{errors[field]}</p> : null;
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            {isEdit ? "Editar Título AP" : "Novo Título AP"}
          </h1>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Identificação</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código ERP / Integração</Label>
              <Input
                value={codigoIntegracao}
                onChange={(e) => { setCodigoIntegracao(e.target.value); setErrors((p) => ({ ...p, codigoIntegracao: "" })); }}
                placeholder="Gerado automaticamente se vazio"
              />
              <p className="text-xs text-muted-foreground">Deixe vazio para gerar automaticamente (BIM-timestamp)</p>
            </div>
            <div className="space-y-2">
              <Label>N° do Documento</Label>
              <Input value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} placeholder="NF 12345" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Fornecedor e Financeiro</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fornecedor *</Label>
              <Popover open={fornecedorOpen} onOpenChange={setFornecedorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={fornecedorOpen}
                    className={cn("w-full justify-between font-normal", errors.fornecedor && "border-destructive")}
                  >
                    {fornecedorLabel || "Selecionar fornecedor..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar fornecedor..."
                      value={fornecedorBusca}
                      onValueChange={(v) => { setFornecedorBusca(v); debouncedSetFornecedorBusca(v); }}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                      <CommandGroup>
                        {fornecedoresList.map((f: any) => {
                          const code = String(f.codigo_cliente_huggs || f.id);
                          const label = f.razao_social || f.nome || code;
                          return (
                            <CommandItem
                              key={code}
                              value={code}
                              onSelect={() => {
                                setFornecedorCodigo(code);
                                setFornecedorLabel(label);
                                setFornecedorOpen(false);
                                setErrors((p) => ({ ...p, fornecedor: "" }));
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", fornecedorCodigo === code ? "opacity-100" : "opacity-0")} />
                              {label}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FieldError field="fornecedor" />
            </div>
            <div className="space-y-2">
              <Label>Valor do Documento (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={valorDocumento}
                onChange={(e) => { setValorDocumento(e.target.value); setErrors((p) => ({ ...p, valor: "" })); }}
                placeholder="0,00"
                className={errors.valor ? "border-destructive" : ""}
              />
              <FieldError field="valor" />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento *</Label>
              <Input
                type="date"
                value={dataVencimento}
                onChange={(e) => { setDataVencimento(e.target.value); setErrors((p) => ({ ...p, dataVencimento: "" })); }}
                className={errors.dataVencimento ? "border-destructive" : ""}
              />
              <FieldError field="dataVencimento" />
            </div>
            <div className="space-y-2">
              <Label>Data de Previsão</Label>
              <Input type="date" value={dataPrevisao} onChange={(e) => setDataPrevisao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Conta Corrente *</Label>
              <Select value={contaCorrente} onValueChange={(v) => { setContaCorrente(v); setErrors((p) => ({ ...p, contaCorrente: "" })); }}>
                <SelectTrigger className={errors.contaCorrente ? "border-destructive" : ""}><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                <SelectContent>
                  {contasCCList.map((c: any) => (
                    <SelectItem key={c.nCodCC || c.id} value={String(c.nCodCC || c.id)}>
                      {c.descricao || c.cDescricao || `Conta ${c.nCodCC}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError field="contaCorrente" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Classificação</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={(v) => { setCategoria(v); setErrors((p) => ({ ...p, categoria: "" })); }}>
                <SelectTrigger className={errors.categoria ? "border-destructive" : ""}><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                <SelectContent>
                  {categoriasList.map((c: any) => (
                    <SelectItem key={c.codigo || c.id} value={c.codigo || c.id}>
                      {c.codigo} — {c.descricao || c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError field="categoria" />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={departamento} onValueChange={setDepartamento}>
                <SelectTrigger><SelectValue placeholder="Selecionar departamento" /></SelectTrigger>
                <SelectContent>
                  {departamentosList.map((d: any) => (
                    <SelectItem key={d.codigo || d.id} value={String(d.codigo || d.id)}>
                      {d.descricao || d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {iaSugestao && (
                <IACategorySuggestion
                  sugestao={iaSugestao.nome}
                  confianca={iaSugestao.confianca}
                  onAccept={() => {
                    setDepartamento(iaSugestao.id);
                    setIaSugestao(null);
                  }}
                  onReject={() => setIaSugestao(null)}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Projeto (opcional)</Label>
              <Select value={projeto} onValueChange={setProjeto}>
                <SelectTrigger><SelectValue placeholder="Selecionar projeto" /></SelectTrigger>
                <SelectContent>
                  {projetosList.map((p: any) => (
                    <SelectItem key={p.codigo || p.id} value={String(p.codigo || p.id)}>
                      {p.descricao || p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Parcelamento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Parcelamento (opcional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condição de Pagamento</Label>
                <Select value={condicaoParcela} onValueChange={setCondicaoParcela}>
                  <SelectTrigger><SelectValue placeholder="Selecionar condição" /></SelectTrigger>
                  <SelectContent>
                    {parcelasList.map((p: any) => (
                      <SelectItem key={p.codigo || p.nCodParc || p.id} value={String(p.codigo || p.nCodParc || p.id)}>
                        {p.descricao || p.cDescricao || `Parcela ${p.nCodParc}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade de Parcelas</Label>
                <Input type="number" min="1" max="60" value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)} placeholder="1" />
              </div>
            </div>
            {parcPreview.length > 0 && (
              <div className="rounded-md border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Preview de Parcelas</p>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" /> Estimativa — vencimentos reais podem variar conforme a condição de pagamento
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <span className="font-medium">Parcela</span>
                  <span className="font-medium">Valor</span>
                  <span className="font-medium">Vencimento</span>
                  {parcPreview.map((p) => (
                    <Fragment key={p.num}>
                      <span>{p.num}/{parcPreview.length}</span>
                      <span>R$ {p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <span>{p.vencimento}</span>
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Complemento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
            </div>
            <ChaveAcessoInput
              value={nfeChave}
              onChange={(v) => { setNfeChave(v); setErrors((p) => ({ ...p, nfeChave: "" })); }}
              onXmlExtracted={(data: XmlExtractedData) => {
                if (data.numero && !numeroDocumento) setNumeroDocumento(data.numero);
                if (data.valorTotal > 0 && !valorDocumento) setValorDocumento(String(data.valorTotal));
              }}
              error={errors.nfeChave}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            {isEdit ? "Salvar Alterações" : "Incluir Título"}
          </Button>
        </div>

        {/* Post-save ERP prompt */}
        <PostPaymentErpPrompt
          open={!!erpPromptId}
          onOpenChange={(o) => {
            if (!o) {
              setErpPromptId(null);
              navigate("/dashboard/financeiro/ap-central");
            }
          }}
          tituloId={erpPromptId || ""}
          onConfirm={async () => {
            await enqueueErpSync({
              contaPagarId: erpPromptId!,
              operacao: "provisao",
              action: "export_provisao",
            });
            navigate("/dashboard/financeiro/ap-central");
          }}
          onSkip={() => {
            setErpPromptId(null);
            navigate("/dashboard/financeiro/ap-central");
          }}
        />
      </div>
    </DashboardLayout>
  );
}
