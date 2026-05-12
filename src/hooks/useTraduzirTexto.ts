import { useMutation } from "@tanstack/react-query";
import { invokeChat } from "@/lib/ai/invokeChat";
import { toast } from "sonner";

export type IdiomaTraducao = "pt" | "zh" | "en";

export interface TraducaoResponse {
  origem: IdiomaTraducao;
  traducoes: Record<IdiomaTraducao, string>;
}

export function useTraduzirTexto() {
  return useMutation({
    mutationFn: async (params: {
      texto: string;
      origem?: IdiomaTraducao;
    }): Promise<TraducaoResponse> => {
      const { data, error } = await invokeChat<TraducaoResponse>(
        "china-traduzir-texto",
        { texto: params.texto, origem: params.origem },
        { timeoutMs: 60_000 },
      );
      if (error) {
        toast.error(error.userMessage || "Falha ao traduzir texto.");
        throw new Error(error.userMessage || "Falha ao traduzir texto.");
      }
      return data!;
    },
  });
}
