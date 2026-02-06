import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EnrichmentProgress {
  total: number;
  current: number;
  succeeded: number;
  failed: number;
  currentStore: string | null;
}

interface EnrichmentResult {
  storeId: string;
  storeName: string;
  success: boolean;
  error?: string;
}

const DELAY_BETWEEN_CALLS_MS = 1500; // 1.5s between calls to avoid rate limiting

/**
 * Hook para enriquecer lojas importadas via CNPJ (OpenCNPJ API)
 * Processa sequencialmente com delay para evitar rate limiting
 */
export function useCnpjEnrichment() {
  const [isEnriching, setIsEnriching] = useState(false);
  const [progress, setProgress] = useState<EnrichmentProgress>({
    total: 0,
    current: 0,
    succeeded: 0,
    failed: 0,
    currentStore: null,
  });
  const abortRef = useRef(false);

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  const enrichStores = useCallback(async (
    stores: Array<{ id: string; name: string; cnpj: string | null }>
  ) => {
    // Filter stores that have valid CNPJs
    const enrichable = stores.filter(s => {
      const cnpjClean = s.cnpj?.replace(/\D/g, "") || "";
      return cnpjClean.length === 14;
    });

    if (enrichable.length === 0) {
      toast.info("Nenhuma loja com CNPJ válido para enriquecer");
      return;
    }

    abortRef.current = false;
    setIsEnriching(true);
    setProgress({
      total: enrichable.length,
      current: 0,
      succeeded: 0,
      failed: 0,
      currentStore: null,
    });

    const toastId = toast.loading(
      `Enriquecendo dados: 0/${enrichable.length} lojas...`
    );

    const results: EnrichmentResult[] = [];

    for (let i = 0; i < enrichable.length; i++) {
      if (abortRef.current) {
        toast.info("Enriquecimento cancelado pelo usuário", { id: toastId });
        break;
      }

      const store = enrichable[i];
      const cnpjClean = store.cnpj!.replace(/\D/g, "");

      setProgress(prev => ({
        ...prev,
        current: i + 1,
        currentStore: store.name,
      }));

      toast.loading(
        `Enriquecendo dados: ${i + 1}/${enrichable.length} — ${store.name}`,
        { id: toastId }
      );

      try {
        const { data, error } = await supabase.functions.invoke("opencnpj-consulta", {
          body: { cnpj: cnpjClean },
        });

        if (error || data?.error) {
          throw new Error(error?.message || data?.error || "Erro desconhecido");
        }

        // Update store with enriched data
        const updatePayload: Record<string, any> = {};
        
        if (data.razaoSocial) updatePayload.name = data.razaoSocial;
        if (data.nomeFantasia) updatePayload.chain = data.nomeFantasia;
        if (data.endereco) updatePayload.address = data.endereco;
        if (data.cidade) updatePayload.city = data.cidade;
        if (data.uf) updatePayload.state = data.uf;
        if (data.cep) updatePayload.zip_code = data.cep;
        if (data.telefone) updatePayload.phone = data.telefone;
        if (data.email) updatePayload.email = data.email;
        if (data.situacao) updatePayload.situacao_cadastral = data.situacao;
        if (data.porte) updatePayload.porte_empresa = data.porte;
        if (data.regimeTributario) updatePayload.regime_tributario = data.regimeTributario;
        if (data.matrizFilial) updatePayload.matriz_filial = data.matrizFilial;
        if (data.capitalSocial) updatePayload.capital_social = data.capitalSocial;
        if (data.cnae) updatePayload.cnae_principal = data.cnae;

        if (Object.keys(updatePayload).length > 0) {
          const { error: updateError } = await supabase
            .from("stores")
            .update(updatePayload)
            .eq("id", store.id);

          if (updateError) {
            throw new Error(`Erro ao salvar: ${updateError.message}`);
          }
        }

        results.push({ storeId: store.id, storeName: store.name, success: true });
        setProgress(prev => ({ ...prev, succeeded: prev.succeeded + 1 }));
      } catch (err: any) {
        console.error(`[Enrichment] Falha em ${store.name}:`, err);
        results.push({
          storeId: store.id,
          storeName: store.name,
          success: false,
          error: err.message,
        });
        setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
      }

      // Delay between calls (skip on last item)
      if (i < enrichable.length - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS_MS));
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    if (failed === 0) {
      toast.success(`✅ ${succeeded} lojas enriquecidas com sucesso!`, { id: toastId });
    } else {
      toast.warning(
        `Enriquecimento: ${succeeded} ok, ${failed} com falha`,
        { id: toastId }
      );
    }

    setIsEnriching(false);
    setProgress(prev => ({ ...prev, currentStore: null }));

    return results;
  }, []);

  return {
    enrichStores,
    isEnriching,
    progress,
    cancel,
  };
}
