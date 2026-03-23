import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { IACategorySuggestion } from "@/components/financeiro/ap/IACategorySuggestion";
import { PostPaymentErpPrompt } from "@/components/financeiro/ap/PostPaymentErpPrompt";
import { format } from "date-fns";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function callApi(fn: string, body: any) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message);
  return data;
}

async function callExportApi(path: string, method = "POST", body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/contas-pagar-export-api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export default function CadastroTituloAP() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  // Form state
  const [codigoIntegracao, setCodigoIntegracao] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [fornecedorCodigo, setFornecedorCodigo] = useState("");
  const [fornecedorBusca, setFornecedorBusca] = useState("");
  const [valorDocumento, setValorDocumento] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [contaCorrente, setContaCorrente] = useState("");
  const [categoria, setCategoria] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [projeto, setProjeto] = useState("");
  const [observacao, setObservacao] = useState("");
  const [nfeChave, setNfeChave] = useState("");

  // IA suggestion
  const [iaSugestao, setIaSugestao] = useState<{ nome: string; confianca: number; id: string } | null>(null);

  // ERP prompt
  const [erpPromptId, setErpPromptId] = useState<string | null>(null);

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
    queryKey: ["ap-fornecedores", fornecedorBusca],
    queryFn: () => callApi("clientes-api", {
      path: "/listar",
      pagina: 1,
      registros_por_pagina: 50,
      ...(fornecedorBusca ? { clientesFiltro: { razao_social: fornecedorBusca } } : {}),
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

  // IA classification on category change
  useEffect(() => {
    if (!categoria || isEdit) return;
    const timer = setTimeout(async () => {
      try {
        const result = await callApi("classificar-contas-pagar-ia", {
          descricao: categoria,
          fornecedor: fornecedorBusca,
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

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        codigo_lancamento_integracao: codigoIntegracao,
        codigo_cliente_fornecedor: Number(fornecedorCodigo),
        data_vencimento: dataVencimento,
        valor_documento: Number(valorDocumento),
        codigo_categoria: categoria,
        data_previsao: dataPrevisao || dataVencimento,
        id_conta_corrente: Number(contaCorrente),
      };
      if (departamento) body.departamento_id = departamento;
      if (projeto) body.projeto_id = projeto;
      if (numeroDocumento) body.numero_documento = numeroDocumento;
      if (observacao) body.observacao = observacao;

      if (isEdit) {
        return callApi("contas-pagar-api", { path: "/alterar", ...body });
      } else {
        return callApi("contas-pagar-api", { path: "/incluir", ...body });
      }
    },
    onSuccess: (data) => {
      const msg = isEdit ? "Título atualizado com sucesso!" : `Título incluído! Código Huggs: ${data?.codigo_lancamento_huggs || "—"}`;
      toast.success(msg);

      // Process NF-e if provided
      if (nfeChave && nfeChave.length === 44) {
        supabase.functions.invoke("process-nfe-xml", { body: { chave_acesso: nfeChave } }).catch(() => {});
      }

      if (!isEdit) {
        setErpPromptId(data?.id || data?.codigo_lancamento_integracao || codigoIntegracao);
      } else {
        navigate(-1);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isEdit && loadingTitle) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const fornecedoresList = fornecedores?.clientes_cadastro || fornecedores?.data || [];
  const categoriasList = categorias?.data || categorias?.categorias || [];
  const departamentosList = departamentos?.data || departamentos?.departamentos || [];
  const projetosList = projetos?.data || projetos?.projetos || [];
  const contasCCList = contasCC?.data || contasCC?.contas || [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold text-[#1B2A4A]">
          {isEdit ? "Editar Título AP" : "Novo Título AP"}
        </h1>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B2A4A]">Identificação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Código ERP / Integração *</Label>
            <Input value={codigoIntegracao} onChange={(e) => setCodigoIntegracao(e.target.value)} placeholder="INT-001" />
          </div>
          <div className="space-y-2">
            <Label>N° do Documento</Label>
            <Input value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} placeholder="NF 12345" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B2A4A]">Fornecedor e Financeiro</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Fornecedor *</Label>
            <Input
              placeholder="Buscar fornecedor..."
              value={fornecedorBusca}
              onChange={(e) => setFornecedorBusca(e.target.value)}
              className="mb-1"
            />
            {fornecedoresList.length > 0 && (
              <Select value={fornecedorCodigo} onValueChange={setFornecedorCodigo}>
                <SelectTrigger><SelectValue placeholder="Selecionar fornecedor" /></SelectTrigger>
                <SelectContent>
                  {fornecedoresList.map((f: any) => (
                    <SelectItem key={f.codigo_cliente_huggs || f.id} value={String(f.codigo_cliente_huggs || f.id)}>
                      {f.razao_social || f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Valor do Documento (R$) *</Label>
            <Input type="number" step="0.01" value={valorDocumento} onChange={(e) => setValorDocumento(e.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-2">
            <Label>Data de Vencimento *</Label>
            <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Data de Previsão *</Label>
            <Input type="date" value={dataPrevisao} onChange={(e) => setDataPrevisao(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Conta Corrente *</Label>
            <Select value={contaCorrente} onValueChange={setContaCorrente}>
              <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
              <SelectContent>
                {contasCCList.map((c: any) => (
                  <SelectItem key={c.nCodCC || c.id} value={String(c.nCodCC || c.id)}>
                    {c.descricao || c.cDescricao || `Conta ${c.nCodCC}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B2A4A]">Classificação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
              <SelectContent>
                {categoriasList.map((c: any) => (
                  <SelectItem key={c.codigo || c.id} value={c.codigo || c.id}>
                    {c.codigo} — {c.descricao || c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1B2A4A]">Complemento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Chave de Acesso NF-e (44 dígitos, opcional)</Label>
            <Input
              value={nfeChave}
              onChange={(e) => setNfeChave(e.target.value.replace(/\D/g, "").slice(0, 44))}
              maxLength={44}
              placeholder="00000000000000000000000000000000000000000000"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !codigoIntegracao || !fornecedorCodigo || !valorDocumento || !dataVencimento || !categoria || !contaCorrente}
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
          await callExportApi("/export-batch", "POST", {
            ids: [erpPromptId],
            channel: "rest_api",
            export_type: "registration",
          });
          navigate("/dashboard/financeiro/ap-central");
        }}
        onSkip={() => {
          setErpPromptId(null);
          navigate("/dashboard/financeiro/ap-central");
        }}
      />
    </div>
  );
}
