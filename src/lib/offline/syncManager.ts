/**
 * Gerenciador de sincronização offline
 * Processa a fila de sincronização quando o dispositivo está online
 */

import { supabase } from '@/integrations/supabase/client';
import {
  getSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueItem,
  addItem,
  type SyncQueueItem
} from './offlineDatabase';

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;

type SyncCallback = (progress: { total: number; synced: number; failed: number }) => void;

let isSyncing = false;
let syncCallback: SyncCallback | null = null;

export const setSyncCallback = (callback: SyncCallback | null) => {
  syncCallback = callback;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const syncStore = async (data: any): Promise<boolean> => {
  try {
    // Verificar se a loja existe
    const { data: existing } = await supabase
      .from('stores')
      .select('id')
      .eq('id', data.id)
      .maybeSingle();
    
    if (existing) {
      // Update
      const { error } = await supabase.from('stores').update({
        name: data.name,
        address: data.address,
        city: data.city,
        uf: data.uf,
        latitude: data.latitude,
        longitude: data.longitude,
      }).eq('id', data.id);
      if (error) throw error;
    } else {
      // Insert com code obrigatório
      const { error } = await supabase.from('stores').insert({
        id: data.id,
        code: data.code || `OFFLINE_${Date.now()}`,
        name: data.name,
        address: data.address,
        city: data.city,
        uf: data.uf,
        latitude: data.latitude,
        longitude: data.longitude,
      });
      if (error) throw error;
    }
    
    // Marcar como sincronizado no IndexedDB
    await addItem('stores', { ...data, synced: true });
    console.log('[SyncManager] Loja sincronizada:', data.id);
    return true;
  } catch (error) {
    console.error('[SyncManager] Erro ao sincronizar loja:', error);
    return false;
  }
};

const syncVisit = async (data: any): Promise<boolean> => {
  try {
    // Verificar se a visita existe
    const { data: existing } = await supabase
      .from('visits')
      .select('id')
      .eq('id', data.id)
      .maybeSingle();
    
    if (existing) {
      const { error } = await supabase.from('visits').update({
        store_id: data.storeId,
        vendedor_id: data.userId,
        check_in_time: data.checkInTime,
        check_out_time: data.checkOutTime,
        check_in_latitude: data.latitude,
        check_in_longitude: data.longitude,
        notes: data.notes,
        status: data.status === 'completed' ? 'completed' : 'in_progress',
      }).eq('id', data.id);
      if (error) throw error;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from('visits').insert({
        store_id: data.storeId,
        vendedor_id: data.userId,
        check_in_time: data.checkInTime,
        check_out_time: data.checkOutTime,
        check_in_latitude: data.latitude,
        check_in_longitude: data.longitude,
        notes: data.notes,
        status: data.status === 'completed' ? 'completed' : 'in_progress',
      } as any);
      if (error) throw error;
    }
    
    await addItem('visits', { ...data, synced: true });
    console.log('[SyncManager] Visita sincronizada:', data.id);
    return true;
  } catch (error) {
    console.error('[SyncManager] Erro ao sincronizar visita:', error);
    return false;
  }
};

const syncPhoto = async (data: any): Promise<boolean> => {
  try {
    // Converter base64 para blob
    const base64Response = await fetch(data.base64Data);
    const blob = await base64Response.blob();
    
    // Upload para storage
    const fileName = `offline_${data.id}_${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(`visits/${data.storeId}/${fileName}`, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (uploadError) throw uploadError;
    
    // Gerar signed URL em vez de URL pública
    const { data: signedData, error: signError } = await supabase.storage
      .from('photos')
      .createSignedUrl(`visits/${data.storeId}/${fileName}`, 31536000); // 1 ano

    if (signError || !signedData?.signedUrl) throw signError || new Error('Failed to generate signed URL');
    
    // Salvar no banco
    const { error: dbError } = await supabase.from('photos').insert({
      visit_id: data.visitId,
      store_id: data.storeId,
      photo_url: signedData.signedUrl,
      photo_type: data.photoType,
      latitude: data.latitude,
      longitude: data.longitude,
    });
    
    if (dbError) throw dbError;
    
    await addItem('photos', { ...data, synced: true });
    console.log('[SyncManager] Foto sincronizada:', data.id);
    return true;
  } catch (error) {
    console.error('[SyncManager] Erro ao sincronizar foto:', error);
    return false;
  }
};

const syncProspect = async (data: any): Promise<boolean> => {
  try {
    // Verificar se o prospect existe
    const { data: existing } = await supabase
      .from('prospects')
      .select('id')
      .eq('id', data.id)
      .maybeSingle();
    
    if (existing) {
      const { error } = await supabase.from('prospects').update({
        nome: data.nome,
        cnpj: data.cnpj,
        telefone: data.telefone,
        email: data.email,
        cidade: data.cidade,
        uf: data.uf,
        endereco: data.endereco,
        status: data.status,
        vendedor_id: data.vendedorId,
      }).eq('id', data.id);
      if (error) throw error;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from('prospects').insert({
        nome: data.nome,
        cnpj: data.cnpj,
        telefone: data.telefone,
        email: data.email,
        cidade: data.cidade,
        uf: data.uf,
        endereco: data.endereco,
        status: data.status,
        vendedor_id: data.vendedorId,
      } as any);
      if (error) throw error;
    }
    
    await addItem('prospects', { ...data, synced: true });
    console.log('[SyncManager] Prospect sincronizado:', data.id);
    return true;
  } catch (error) {
    console.error('[SyncManager] Erro ao sincronizar prospect:', error);
    return false;
  }
};

const processQueueItem = async (item: SyncQueueItem): Promise<boolean> => {
  switch (item.type) {
    case 'store':
      return syncStore(item.data);
    case 'visit':
      return syncVisit(item.data);
    case 'photo':
      return syncPhoto(item.data);
    case 'prospect':
      return syncProspect(item.data);
    default:
      console.warn('[SyncManager] Tipo de item desconhecido:', item.type);
      return false;
  }
};

export const processSyncQueue = async (): Promise<{ synced: number; failed: number }> => {
  if (isSyncing) {
    console.log('[SyncManager] Sincronização já em andamento');
    return { synced: 0, failed: 0 };
  }

  if (!navigator.onLine) {
    console.log('[SyncManager] Dispositivo offline, sincronização adiada');
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const queue = await getSyncQueue();
    const total = queue.length;
    
    console.log(`[SyncManager] Iniciando sincronização de ${total} itens`);

    for (const item of queue) {
      if (item.attempts >= MAX_RETRY_ATTEMPTS) {
        console.warn('[SyncManager] Item excedeu tentativas máximas:', item.id);
        failed++;
        continue;
      }

      const success = await processQueueItem(item);

      if (success) {
        await removeSyncQueueItem(item.id);
        synced++;
      } else {
        const updatedItem: SyncQueueItem = {
          ...item,
          attempts: item.attempts + 1,
          lastAttempt: new Date().toISOString()
        };
        await updateSyncQueueItem(updatedItem);
        failed++;
        
        // Aguardar antes de tentar o próximo
        await delay(RETRY_DELAY_MS);
      }

      // Notificar progresso
      if (syncCallback) {
        syncCallback({ total, synced, failed });
      }
    }

    console.log(`[SyncManager] Sincronização concluída: ${synced} sucesso, ${failed} falhas`);
  } catch (error) {
    console.error('[SyncManager] Erro durante sincronização:', error);
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
};

// Auto-sync quando voltar online
export const setupAutoSync = () => {
  window.addEventListener('online', () => {
    console.log('[SyncManager] Dispositivo online, iniciando sincronização automática');
    processSyncQueue();
  });

  // Tentar sincronizar a cada 5 minutos se online
  setInterval(() => {
    if (navigator.onLine) {
      processSyncQueue();
    }
  }, 5 * 60 * 1000);
};

export const isSyncInProgress = () => isSyncing;
