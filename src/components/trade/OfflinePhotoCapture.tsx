/**
 * Componente para captura de fotos com suporte offline
 * Salva localmente quando offline e sincroniza quando online
 */

import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { saveOfflinePhoto, addItem } from '@/lib/offline/offlineDatabase';
import { supabase } from '@/integrations/supabase/client';

interface OfflinePhotoCaptureProps {
  storeId?: string;
  storeName?: string;
  onPhotoCaptured?: (photo: CapturedPhoto) => void;
  className?: string;
}

interface CapturedPhoto {
  id: string;
  dataUrl: string;
  photoType: string;
  storeId?: string;
  capturedAt: string;
  syncStatus: 'pending' | 'synced' | 'error';
}

const PHOTO_TYPES = [
  { value: 'gondola', label: 'Gôndola' },
  { value: 'fachada', label: 'Fachada' },
  { value: 'preco', label: 'Preço' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'concorrente', label: 'Concorrente' },
  { value: 'promocao', label: 'Promoção' },
  { value: 'ruptura', label: 'Ruptura' },
];

export const OfflinePhotoCapture: React.FC<OfflinePhotoCaptureProps> = ({
  storeId,
  storeName,
  onPhotoCaptured,
  className
}) => {
  const { isOnline } = useOfflineStatus();
  const [photoType, setPhotoType] = useState<string>('gondola');
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Capturar foto da câmera ou galeria
  const handleCapture = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsCapturing(true);

    try {
      // Converter para base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        
        const newPhoto: CapturedPhoto = {
          id: crypto.randomUUID(),
          dataUrl,
          photoType,
          storeId,
          capturedAt: new Date().toISOString(),
          syncStatus: 'pending'
        };

        // Salvar localmente no IndexedDB
        await saveOfflinePhoto({
          id: newPhoto.id,
          storeId: storeId || '',
          base64Data: dataUrl,
          photoType: photoType as any,
          synced: false,
          createdAt: newPhoto.capturedAt
        });

        setCapturedPhotos(prev => [...prev, newPhoto]);
        onPhotoCaptured?.(newPhoto);

        if (isOnline) {
          toast.success('Foto capturada! Iniciando upload...');
          await uploadPhoto(newPhoto);
        } else {
          toast.info('Foto salva offline. Será sincronizada quando conectar.');
        }

        setIsCapturing(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[OfflinePhotoCapture] Erro ao capturar foto:', error);
      toast.error('Erro ao capturar foto');
      setIsCapturing(false);
    }

    // Limpar input para permitir nova captura do mesmo arquivo
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [photoType, storeId, isOnline, onPhotoCaptured]);

  // Upload de foto para o Supabase
  const uploadPhoto = useCallback(async (photo: CapturedPhoto) => {
    setIsUploading(true);

    try {
      // Converter base64 para blob
      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();
      
      const fileName = `${photo.storeId || 'unknown'}/${photo.id}.jpg`;
      
      // Upload para storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('trade-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('trade-photos')
        .getPublicUrl(fileName);

      // Inserir registro no banco
      const { error: insertError } = await supabase
        .from('photos')
        .insert({
          store_id: photo.storeId || null,
          photo_type: photo.photoType,
          photo_url: urlData.publicUrl,
          upload_date: photo.capturedAt,
          ai_processed: false
        });

      if (insertError) throw insertError;

      // Atualizar status no IndexedDB - marcar como sincronizado
      await addItem('photos', {
        id: photo.id,
        storeId: photo.storeId || '',
        base64Data: photo.dataUrl,
        photoType: photo.photoType,
        synced: true,
        createdAt: photo.capturedAt
      });

      // Atualizar estado local
      setCapturedPhotos(prev => 
        prev.map(p => p.id === photo.id ? { ...p, syncStatus: 'synced' } : p)
      );

      toast.success('Foto enviada com sucesso!');
    } catch (error) {
      console.error('[OfflinePhotoCapture] Erro no upload:', error);
      
      // Marcar como erro
      setCapturedPhotos(prev => 
        prev.map(p => p.id === photo.id ? { ...p, syncStatus: 'error' } : p)
      );

      toast.error('Erro ao enviar foto. Será tentado novamente.');
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Remover foto capturada
  const removePhoto = useCallback(async (photoId: string) => {
    setCapturedPhotos(prev => prev.filter(p => p.id !== photoId));
    // Também remover do IndexedDB se necessário
  }, []);

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-trade" />
            <span className="font-medium">Captura de Fotos</span>
          </div>
          {!isOnline && (
            <Badge variant="outline" className="text-warning border-warning">
              <WifiOff className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          )}
        </div>

        {/* Loja selecionada */}
        {storeName && (
          <div className="text-sm text-muted-foreground">
            Loja: <span className="font-medium text-foreground">{storeName}</span>
          </div>
        )}

        {/* Seletor de tipo */}
        <Select value={photoType} onValueChange={setPhotoType}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo de foto" />
          </SelectTrigger>
          <SelectContent>
            {PHOTO_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Botão de captura */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            className="hidden"
            id="photo-capture-input"
          />
          <Button
            className="flex-1 bg-trade hover:bg-trade-dark"
            onClick={() => inputRef.current?.click()}
            disabled={isCapturing || isUploading}
          >
            <Camera className="mr-2 h-4 w-4" />
            {isCapturing ? 'Processando...' : 'Tirar Foto'}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.removeAttribute('capture');
                inputRef.current.click();
                setTimeout(() => {
                  inputRef.current?.setAttribute('capture', 'environment');
                }, 100);
              }
            }}
            disabled={isCapturing || isUploading}
          >
            <Upload className="h-4 w-4" />
          </Button>
        </div>

        {/* Preview das fotos capturadas */}
        {capturedPhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {capturedPhotos.map(photo => (
              <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden">
                <img
                  src={photo.dataUrl}
                  alt={`Foto ${photo.photoType}`}
                  className="w-full h-full object-cover"
                />
                
                {/* Status badge */}
                <div className="absolute top-1 right-1">
                  {photo.syncStatus === 'pending' && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      <WifiOff className="h-3 w-3" />
                    </Badge>
                  )}
                  {photo.syncStatus === 'synced' && (
                    <Badge className="h-5 px-1.5 text-[10px] bg-green-500">
                      <Check className="h-3 w-3" />
                    </Badge>
                  )}
                </div>

                {/* Remove button */}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute bottom-1 right-1 h-6 w-6"
                  onClick={() => removePhoto(photo.id)}
                >
                  <X className="h-3 w-3" />
                </Button>

                {/* Type label */}
                <Badge 
                  variant="secondary" 
                  className="absolute bottom-1 left-1 text-[10px] h-5"
                >
                  {PHOTO_TYPES.find(t => t.value === photo.photoType)?.label}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Info de pendências */}
        {capturedPhotos.filter(p => p.syncStatus === 'pending').length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {capturedPhotos.filter(p => p.syncStatus === 'pending').length} foto(s) pendente(s) de sincronização
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default OfflinePhotoCapture;
