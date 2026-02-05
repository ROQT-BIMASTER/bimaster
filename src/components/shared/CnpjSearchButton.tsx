import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CnpjData {
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
}

interface CnpjSearchButtonProps {
  cnpj: string;
  onDataFound: (data: CnpjData) => void;
  disabled?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function CnpjSearchButton({
  cnpj,
  onDataFound,
  disabled = false,
  size = "icon",
  variant = "outline",
}: CnpjSearchButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    // Limpar CNPJ
    const cnpjLimpo = cnpj.replace(/\D/g, "");

    if (cnpjLimpo.length !== 14) {
      toast.error("Digite um CNPJ válido com 14 dígitos");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("opencnpj-consulta", {
        body: { cnpj: cnpjLimpo },
      });

      if (error) {
        console.error("Erro na função:", error);
        throw new Error(error.message || "Erro ao consultar CNPJ");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Verificar situação cadastral
      if (data.situacao && data.situacao !== "ATIVA") {
        toast.warning(`Atenção: Empresa com situação "${data.situacao}"`);
      }

      onDataFound(data);
      toast.success("Dados carregados da Receita Federal!");
      
      if (data.cached) {
        console.log("Dados obtidos do cache");
      }

    } catch (error: any) {
      console.error("Erro ao buscar CNPJ:", error);
      toast.error(error.message || "Erro ao consultar CNPJ. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const isValidCnpj = cnpj.replace(/\D/g, "").length === 14;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleSearch}
      disabled={disabled || loading || !isValidCnpj}
      title={isValidCnpj ? "Buscar dados do CNPJ" : "Digite um CNPJ válido com 14 dígitos"}
      className="shrink-0"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Search className="h-4 w-4" />
      )}
    </Button>
  );
}
