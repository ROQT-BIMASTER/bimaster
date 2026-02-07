import { useState } from "react";
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
  const [enrichedData, setEnrichedData] = useState<CnpjEnrichedData | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isCnpj =
    supplierDocument && supplierDocument.replace(/\D/g, "").length === 14;

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

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-base">
                {enrichedData?.razaoSocial || supplierName}
              </p>
              {enrichedData?.nomeFantasia &&
                enrichedData.nomeFantasia !== enrichedData.razaoSocial && (
                  <p className="text-sm text-muted-foreground">
                    {enrichedData.nomeFantasia}
                  </p>
                )}
              {supplierDocument && (
                <p className="text-sm text-muted-foreground font-mono mt-0.5">
                  {formatCnpj(supplierDocument)}
                </p>
              )}
            </div>
          </div>

          {/* Enrich button */}
          {isCnpj && !enrichedData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnrich}
              disabled={loading}
              className="shrink-0 gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              {loading ? "Consultando..." : "Consultar Receita"}
            </Button>
          )}
        </div>

        {/* Enriched Data */}
        {enrichedData && (
          <>
            <Separator />

            {/* Situação Cadastral */}
            <div className="flex items-center gap-2">
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
            </div>

            {/* Grid de informações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Endereço */}
              {(enrichedData.endereco || enrichedData.cidade) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-sm">
                    {enrichedData.endereco && <p>{enrichedData.endereco}</p>}
                    {enrichedData.bairro && (
                      <p className="text-muted-foreground">
                        {enrichedData.bairro}
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      {[
                        enrichedData.cidade,
                        enrichedData.uf,
                        enrichedData.cep,
                      ]
                        .filter(Boolean)
                        .join(" - ")}
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
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{enrichedData.cnae}</span>
                </div>
              )}

              {/* Regime Tributário */}
              {enrichedData.regimeTributario && (
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">
                    {enrichedData.regimeTributario}
                  </span>
                </div>
              )}

              {/* Capital Social */}
              {enrichedData.capitalSocial != null &&
                enrichedData.capitalSocial > 0 && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">
                      Capital: {formatCurrency(enrichedData.capitalSocial)}
                    </span>
                  </div>
                )}
            </div>

            {/* Re-consultar */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEnrich}
                disabled={loading}
                className="text-xs gap-1"
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Globe className="h-3 w-3" />
                )}
                Atualizar dados
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
