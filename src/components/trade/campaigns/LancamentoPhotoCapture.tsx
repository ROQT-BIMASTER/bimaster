import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, X, Loader2, Sparkles, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CapturedPhoto {
  id: string;
  url: string;
  status: 'uploading' | 'pending_analysis' | 'analyzing' | 'completed' | 'failed';
  analysisResult?: any;
}

interface LancamentoPhotoCaptureProps {
  campaignId: string;
  customerId: string | null;
  onPhotosChange: (photos: CapturedPhoto[]) => void;
  photos: CapturedPhoto[];
}

export function LancamentoPhotoCapture({ 
  campaignId, 
  customerId, 
  onPhotosChange,
  photos 
}: LancamentoPhotoCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    await uploadPhotos(Array.from(files));
    
    // Reset input
    if (e.target === fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (e.target === cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const uploadPhotos = async (files: File[]) => {
    setIsUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      for (const file of files) {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Add photo with uploading status
        const newPhoto: CapturedPhoto = {
          id: tempId,
          url: URL.createObjectURL(file),
          status: 'uploading'
        };
        onPhotosChange([...photos, newPhoto]);

        try {
          // Upload to storage
          const fileExt = file.name.split('.').pop() || 'jpg';
          const fileName = `${user.id}/${campaignId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('trade-photos')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Gerar signed URL em vez de URL pública
          const { data: signedData, error: signError } = await supabase.storage
            .from('trade-photos')
            .createSignedUrl(fileName, 31536000); // 1 ano

          if (signError || !signedData?.signedUrl) throw signError || new Error('Failed to generate signed URL');

          const photoUrl = signedData.signedUrl;

          // Create photo record
          const { data: photoRecord, error: photoError } = await supabase
            .from('photos')
            .insert({
              photo_url: photoUrl,
              photo_type: 'campaign_execution',
              vendedor_id: user.id,
              store_id: null, // Will link via customer if needed
              visit_id: null,
            })
            .select()
            .single();

          if (photoError) throw photoError;

          // Add to analysis queue
          await supabase.from('photo_analysis_queue').insert({
            photo_id: photoRecord.id,
            photo_url: photoUrl,
            created_by: user.id,
          });

          // Update photo status
          const updatedPhotos = photos.map(p => 
            p.id === tempId 
              ? { ...p, id: photoRecord.id, url: photoUrl, status: 'pending_analysis' as const }
              : p
          );
          onPhotosChange([...updatedPhotos.filter(p => p.id !== tempId), {
            id: photoRecord.id,
            url: photoUrl,
            status: 'pending_analysis'
          }]);

          // Trigger queue processing
          supabase.functions.invoke('trigger-photo-queue').catch(console.error);

          toast.success("Foto enviada para análise!");
        } catch (error) {
          console.error('Error uploading photo:', error);
          // Remove failed photo
          onPhotosChange(photos.filter(p => p.id !== tempId));
          toast.error("Erro ao enviar foto");
        }
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (photoId: string) => {
    onPhotosChange(photos.filter(p => p.id !== photoId));
  };

  const getStatusBadge = (status: CapturedPhoto['status']) => {
    switch (status) {
      case 'uploading':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Enviando
          </Badge>
        );
      case 'pending_analysis':
        return (
          <Badge variant="outline" className="gap-1 bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3" />
            Na fila
          </Badge>
        );
      case 'analyzing':
        return (
          <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
            <Sparkles className="h-3 w-3 animate-pulse" />
            Analisando
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="gap-1 bg-green-500 hover:bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Analisada
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Falhou
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Capture Buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Camera capture */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <Button
          type="button"
          variant="default"
          className="gap-2"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading || !customerId}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Tirar Foto
        </Button>

        {/* File upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || !customerId}
        >
          <Upload className="h-4 w-4" />
          Carregar da Galeria
        </Button>
      </div>

      {!customerId && (
        <p className="text-sm text-muted-foreground">
          Selecione um cliente para habilitar a captura de fotos
        </p>
      )}

      {/* Photos Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square">
              <img
                src={photo.url}
                alt="Foto PDV"
                className="w-full h-full object-cover rounded-lg border"
              />
              
              {/* Status Badge */}
              <div className="absolute top-2 left-2">
                {getStatusBadge(photo.status)}
              </div>

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Analysis Result Preview */}
              {photo.status === 'completed' && photo.analysisResult && (
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent rounded-b-lg">
                  <p className="text-white text-xs truncate">
                    Score: {photo.analysisResult.score || 'N/A'}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-primary">Análise Automática por IA</p>
          <p className="text-muted-foreground">
            As fotos serão analisadas automaticamente para verificar posicionamento, precificação e exposição dos produtos.
          </p>
        </div>
      </div>
    </div>
  );
}
