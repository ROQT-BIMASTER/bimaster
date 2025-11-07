import { supabase } from "@/integrations/supabase/client";

/**
 * Processa a fila de análise de fotos chamando a edge function
 * Pode ser chamado periodicamente ou sob demanda
 */
export async function processPhotoQueue() {
  try {
    const { data, error } = await supabase.functions.invoke('process-photo-analysis-queue', {
      body: {},
    });

    if (error) throw error;

    console.log('✅ Fila de fotos processada:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Erro ao processar fila de fotos:', error);
    return { success: false, error };
  }
}

/**
 * Inicia processamento periódico da fila (a cada 2 minutos)
 * Retorna função para parar o processamento
 */
export function startPhotoQueueProcessor() {
  // Processar imediatamente
  processPhotoQueue();

  // Depois processar a cada 2 minutos
  const intervalId = setInterval(() => {
    processPhotoQueue();
  }, 120000); // 2 minutos

  // Retornar função para parar
  return () => clearInterval(intervalId);
}
