import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Search,
  Loader2,
  Globe,
  Landmark,
  BadgeCheck,
  AlertTriangle,
  Briefcase,
  DollarSign,
  ExternalLink,
  CreditCard,
  QrCode,
  User,
  Banknote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CnpjEnrichedData {
  razaoSocial?: string;
  nomeFantasia?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  situacao?: string;
  cnae?: string;
  porte?: string;
  capitalSocial?: number;
  regimeTributario?: string;
  matrizFilial?: string;
}

interface LocalSupplierData {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  contato: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  pix_chave: string | null;
  pix_tipo: string | null;
  favorecido: string | null;
  linha_digitavel: string | null;
}

interface SupplierDetailsCardProps {
  supplierName: string;
  supplierDocument: string | null;
}

const formatCnpj = (doc: string) => {
  const clean = doc.replace(/\D/g, "");
  if (clean.length === 14) {
    return clean.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return doc;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );

export function SupplierDetailsCard({
  supplierName,
  supplierDocument,
}: SupplierDetailsCardProps) {
  const [enrichedData, setEnrichedData] = useState<CnpjEnrichedData | null>(null);
  const [localSupplier, setLocalSupplier] = useState<LocalSupplierData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const { toast } = useToast();

  const isCnpj =
    supplierDocument && supplierDocument.replace(/\D/g, "").length === 14;

  // Fetch local supplier data on mount
  useEffect(() => {
    if (!supplierDocument) return;
    const cnpjClean = supplierDocument.replace(/\D/g, "");
    if (cnpjClean.length < 11) return;

    setLoadingLocal(true);
    supabase
      .from("fabrica_fornecedores")
      .select("*")
      .eq("cnpj", cnpjClean)
      .eq("ativo", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLocalSupplier(data as unknown as LocalSupplierData);
        setLoadingLocal(false);
      });
  }, [supplierDocument]);

  const handleEnrich = async () => {
    if (!supplierDocument) return;
    const cnpjClean = supplierDocument.replace(/\D/g, "");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "opencnpj-consulta",
        { body: { cnpj: cnpjClean } }
      );

      if (error) throw new Error(error.message || "Erro ao consultar CNPJ");
      if (data.error) throw new Error(data.error);

      setEnrichedData(data);
      toast({
        title: "Dados carregados",
        description: "Informações da Receita Federal atualizadas.",
      });
    } catch (err: any) {
      console.error("Erro ao enriquecer fornecedor:", err);
      toast({
        title: "Erro na consulta",
        description:
          err.message || "Não foi possível consultar a Receita Federal.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const hasBankData = localSupplier && (
    localSupplier.banco || localSupplier.pix_chave || localSupplier.linha_digitavel
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-base">
                {enrichedData?.razaoSocial || localSupplier?.razao_social || supplierName}
              </p>
              {(enrichedData?.nomeFantasia || localSupplier?.nome_fantasia) && (
                <p className="text-sm text-muted-foreground">
                  {enrichedData?.nomeFantasia || localSupplier?.nome_fantasia}
                </p>
              )}
              {supplierDocument && (
                <p className="text-sm text-muted-foreground font-mono mt-0.5">
                  {formatCnpj(supplierDocument)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Enrich button */}
            {isCnpj && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnrich}
                disabled={loading}
                className="gap-1.5"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                {loading
                  ? "Consultando..."
                  : enrichedData
                  ? "Atualizar"
                  : "Consultar Receita"}
              </Button>
            )}
          </div>
        </div>

        {/* Enriched Data from Receita Federal */}
        {enrichedData && (
          <>
            <Separator />

            {/* Situação Cadastral + Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {enrichedData.situacao === "ATIVA" ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400 gap-1"
                >
                  <BadgeCheck className="h-3 w-3" />
                  Ativa
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {enrichedData.situacao || "Desconhecida"}
                </Badge>
              )}
              {enrichedData.matrizFilial && (
                <Badge variant="secondary" className="text-xs">
                  {enrichedData.matrizFilial}
                </Badge>
              )}
              {enrichedData.porte && (
                <Badge variant="secondary" className="text-xs">
                  {enrichedData.porte}
                </Badge>
              )}
              {enrichedData.regimeTributario && (
                <Badge variant="secondary" className="text-xs">
                  {enrichedData.regimeTributario}
                </Badge>
              )}
            </div>

            {/* Grid de informações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Endereço */}
              {(enrichedData.endereco || enrichedData.cidade) && (
                <div className="flex items-start gap-2 col-span-1 sm:col-span-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-sm">
                    {enrichedData.endereco && <p>{enrichedData.endereco}</p>}
                    <p className="text-muted-foreground">
                      {[enrichedData.bairro, enrichedData.cidade, enrichedData.uf]
                        .filter(Boolean)
                        .join(" - ")}
                      {enrichedData.cep && ` • CEP ${enrichedData.cep}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Telefone */}
              {enrichedData.telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{enrichedData.telefone}</span>
                </div>
              )}

              {/* Email */}
              {enrichedData.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{enrichedData.email}</span>
                </div>
              )}

              {/* CNAE */}
              {enrichedData.cnae && (
                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm">{enrichedData.cnae}</span>
                </div>
              )}

              {/* Capital Social */}
              {enrichedData.capitalSocial != null && enrichedData.capitalSocial > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">
                    Capital Social: {formatCurrency(enrichedData.capitalSocial)}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Dados bancários do cadastro local */}
        {hasBankData && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Dados Bancários (Cadastro)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {localSupplier?.banco && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>
                      {localSupplier.banco}
                      {localSupplier.agencia && ` • Ag: ${localSupplier.agencia}`}
                      {localSupplier.conta && ` • Cc: ${localSupplier.conta}`}
                      {localSupplier.tipo_conta && ` (${localSupplier.tipo_conta})`}
                    </span>
                  </div>
                )}
                {localSupplier?.pix_chave && (
                  <div className="flex items-center gap-2">
                    <QrCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>
                      PIX ({localSupplier.pix_tipo || "Chave"}): {localSupplier.pix_chave}
                    </span>
                  </div>
                )}
                {localSupplier?.favorecido && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>Favorecido: {localSupplier.favorecido}</span>
                  </div>
                )}
                {localSupplier?.linha_digitavel && (
                  <div className="flex items-start gap-2 col-span-1 sm:col-span-2">
                    <Landmark className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="font-mono text-xs break-all">
                      {localSupplier.linha_digitavel}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Contato local (se não veio da API) */}
        {localSupplier?.contato && !enrichedData && (
          <>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {localSupplier.contato && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Contato: {localSupplier.contato}</span>
                </div>
              )}
              {localSupplier.telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{localSupplier.telefone}</span>
                </div>
              )}
              {localSupplier.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{localSupplier.email}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer: link para cadastro + loading */}
        <div className="flex items-center justify-between pt-1">
          <div>
            {loadingLocal && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Buscando cadastro...
              </span>
            )}
            {!loadingLocal && !localSupplier && supplierDocument && (
              <span className="text-xs text-muted-foreground">
                Fornecedor não encontrado no cadastro local
              </span>
            )}
          </div>
          
          {localSupplier && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => {
                // Open supplier in a new context - navigate to factory suppliers
                window.open(
                  `/dashboard/fabrica/materias-primas`,
                  "_blank"
                );
              }}
            >
              <ExternalLink className="h-3 w-3" />
              Abrir Cadastro
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
