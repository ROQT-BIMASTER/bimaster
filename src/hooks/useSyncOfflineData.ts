import { logger } from "@/lib/logger";
import { useEffect } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { offlineStorage } from '@/lib/utils/offline-storage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook para sincronizar dados offline quando o usuário voltar online
 * Integrado com criptografia para proteção de dados
 */
export const useSyncOfflineData = () => {
  const isOnline = useOnlineStatus();

  // Initialize offline storage with user ID for encryption
  useEffect(() => {
    const initializeEncryption = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        offlineStorage.setUserId(user.id);
      }
    };

    initializeEncryption();

    // Listen for auth changes to update encryption context
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        offlineStorage.setUserId(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        // Clear offline data on logout for security
        await offlineStorage.clearOnLogout(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      syncOfflineData();
    }
  }, [isOnline]);

  const syncOfflineData = async () => {
    try {
      // Ensure user is set for decryption
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('🔒 No user authenticated, skipping offline sync');
        return;
      }
      
      offlineStorage.setUserId(user.id);
      
      const { photos, data } = await offlineStorage.getStorageSize();
      
      if (photos === 0 && data === 0) {
        return; // Nada para sincronizar
      }

      console.log(`🔄 Sincronizando dados offline: ${photos} fotos, ${data} registros`);
      
      let successCount = 0;
      let failCount = 0;

      // Sincronizar dados primeiro
      const pendingData = await offlineStorage.getPendingData();
      for (const item of pendingData) {
        try {
          if (item.operation === 'insert') {
            const { error } = await (supabase as any)
              .from(item.table)
              .insert(item.data);
            
            if (error) throw error;
          } else if (item.operation === 'update') {
            const { error } = await (supabase as any)
              .from(item.table)
              .update(item.data)
              .eq('id', item.data.id);
            
            if (error) throw error;
          }

          await offlineStorage.removePendingData(item.id);
          successCount++;
        } catch (error) {
          console.error('Erro ao sincronizar dado:', error);
          failCount++;
          
          // Limitar tentativas
          if (item.retries >= 3) {
            await offlineStorage.removePendingData(item.id);
            console.log('Dado descartado após 3 tentativas:', item.id);
          }
        }
      }

      // Sincronizar fotos
      const pendingPhotos = await offlineStorage.getPendingPhotos();
      for (const photo of pendingPhotos) {
        try {
          // Upload da foto
          const filePath = `${user.id}/${photo.visitId || 'temp'}/${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('trade-photos')
            .upload(filePath, photo.file);

          if (uploadError) throw uploadError;

          // Gerar signed URL em vez de URL pública
          const { data: signedData, error: signError } = await supabase.storage
            .from('trade-photos')
            .createSignedUrl(filePath, 31536000); // 1 ano

          if (signError || !signedData?.signedUrl) throw signError || new Error('Failed to generate signed URL');

          const photoUrl = signedData.signedUrl;

          // Criar registro da foto
          const { data: photoRecord, error: photoError } = await supabase
            .from('photos')
            .insert({
              visit_id: photo.visitId,
              store_id: photo.storeId,
              photo_url: photoUrl,
              photo_type: 'shelf',
              vendedor_id: user.id,
            })
            .select()
            .single();

          if (photoError) throw photoError;

          // Adicionar à fila de análise
          await supabase.from('photo_analysis_queue').insert({
            photo_id: photoRecord.id,
            photo_url: photoUrl,
            created_by: user.id,
          });

          await offlineStorage.removePendingPhoto(photo.id);
          successCount++;
        } catch (error) {
          console.error('Erro ao sincronizar foto:', error);
          failCount++;
          
          // Incrementar tentativas
          await offlineStorage.incrementPhotoRetries(photo.id);
          
          // Remover após 3 tentativas
          if (photo.retries >= 2) {
            await offlineStorage.removePendingPhoto(photo.id);
            console.log('Foto descartada após 3 tentativas:', photo.id);
          }
        }
      }

      if (successCount > 0) {
        toast.success(`✅ ${successCount} item(ns) sincronizado(s)`);
      }
      
      if (failCount > 0) {
        toast.warning(`⚠️ ${failCount} item(ns) falharam na sincronização`);
      }
    } catch (error) {
      console.error('Erro na sincronização offline:', error);
    }
  };

  return { syncOfflineData };
};
