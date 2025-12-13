import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Building2, 
  CheckCircle2, 
  Camera,
  FileText,
  UserCheck
} from "lucide-react";
import { OfflinePhotoCapture } from "./OfflinePhotoCapture";

interface VisitDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: string | null;
}

interface VisitDetail {
  id: string;
  visit_code: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  visit_type: string | null;
  objectives: string[] | null;
  notes: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_latitude?: number | null;
  check_out_longitude?: number | null;
  checklist_completed: boolean;
  photos_required?: boolean;
  photos_taken?: number;
  duration_minutes: number | null;
  store_id?: string | null;
  user_id?: string | null;
  atribuido_por?: string | null;
  created_at?: string;
  updated_at?: string;
  stores: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  atribuidor?: {
    nome: string;
    email: string;
  } | null;
}

interface Photo {
  id: string;
  photo_url: string;
  photo_type: string;
  category: string | null;
  upload_date: string;
  observations: string | null;
}

export function VisitDetailDialog({ open, onOpenChange, visitId }: VisitDetailDialogProps) {
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && visitId) {
      fetchVisitDetails();
    }
  }, [open, visitId]);

  const fetchVisitDetails = async () => {
    if (!visitId) return;
    
    setLoading(true);
    try {
      const [visitData, photosData] = await Promise.all([
        supabase
          .from("visits")
          .select(`
            *,
            stores:store_id (name, address, city, state),
            atribuidor:atribuido_por (nome, email)
          `)
          .eq("id", visitId)
          .single(),
        supabase
          .from("photos")
          .select("id, photo_url, photo_type, category, upload_date, observations")
          .eq("visit_id", visitId)
          .order("upload_date", { ascending: true })
      ]);

      if (visitData.error) throw visitData.error;
      setVisit(visitData.data as VisitDetail);
      
      if (photosData.data) {
        setPhotos(photosData.data);
      }
    } catch (error) {
      console.error("Erro ao buscar detalhes da visita:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: "Agendada",
      in_progress: "Em Andamento",
      completed: "Concluída",
      cancelled: "Cancelada",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "default";
      case "in_progress":
        return "secondary";
      case "completed":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getVisitTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      routine: "Rotina",
      special: "Especial",
      audit: "Auditoria",
      emergency: "Emergência",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="text-center py-8">Carregando...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!visit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Detalhes da Visita</DialogTitle>
            <div className="flex gap-2">
              <Badge variant={getStatusColor(visit.status)}>
                {getStatusLabel(visit.status)}
              </Badge>
              {visit.visit_type && (
                <Badge variant="outline">
                  {getVisitTypeLabel(visit.visit_type)}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações Básicas */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Código:</span>
                <span>{visit.visit_code}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Data:</span>
                <span>
                  {format(new Date(visit.scheduled_date), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </span>
              </div>

              {visit.scheduled_time && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Horário:</span>
                  <span>{visit.scheduled_time}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Atribuído por */}
          {visit.atribuidor && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Atribuído por</h3>
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="font-medium">{visit.atribuidor.nome}</p>
                  <p className="text-sm text-muted-foreground">{visit.atribuidor.email}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loja */}
          {visit.stores && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Loja</h3>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="font-medium">{visit.stores.name}</p>
                  {visit.stores.address && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>
                        {visit.stores.address}
                        {visit.stores.city && `, ${visit.stores.city}`}
                        {visit.stores.state && ` - ${visit.stores.state}`}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Objetivos */}
          {visit.objectives && visit.objectives.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Objetivos da Visita</h3>
                <Separator />
                <ul className="space-y-2">
                  {visit.objectives.map((obj, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Check-in/Check-out */}
          {(visit.check_in_time || visit.check_out_time) && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Registro de Presença</h3>
                <Separator />
                <div className="grid gap-2">
                  {visit.check_in_time && (
                    <div className="text-sm">
                      <span className="font-medium">Check-in:</span>{" "}
                      {format(new Date(visit.check_in_time), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </div>
                  )}
                  {visit.check_out_time && (
                    <div className="text-sm">
                      <span className="font-medium">Check-out:</span>{" "}
                      {format(new Date(visit.check_out_time), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </div>
                  )}
                  {visit.duration_minutes && (
                    <div className="text-sm">
                      <span className="font-medium">Duração:</span>{" "}
                      {Math.floor(visit.duration_minutes / 60)}h {visit.duration_minutes % 60}min
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checklist e Fotos */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-semibold">Execução</h3>
              <Separator />
              <div className="grid gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`h-4 w-4 ${visit.checklist_completed ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span>
                    Checklist: {visit.checklist_completed ? 'Concluído' : 'Pendente'}
                  </span>
                </div>
                {visit.photos_required && (
                  <div className="flex items-center gap-2 text-sm">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Fotos tiradas: {visit.photos_taken || photos.length}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Captura de Fotos Offline - apenas para visitas em andamento */}
          {visit.status === 'in_progress' && visit.store_id && (
            <OfflinePhotoCapture
              storeId={visit.store_id}
              storeName={visit.stores?.name}
              onPhotoCaptured={() => fetchVisitDetails()}
            />
          )}

          {/* Fotos da Visita */}
          {photos.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Fotos da Visita</h3>
                  <Badge variant="secondary">{photos.length}</Badge>
                </div>
                <Separator />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="space-y-2">
                      <div className="relative aspect-square rounded-lg overflow-hidden border group">
                        <img
                          src={photo.photo_url}
                          alt={`Foto ${photo.photo_type}`}
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => window.open(photo.photo_url, '_blank')}
                        />
                        {photo.category && (
                          <Badge 
                            variant="secondary" 
                            className="absolute top-2 left-2 text-xs"
                          >
                            {photo.category === 'before' ? 'Antes' : photo.category === 'after' ? 'Depois' : photo.category}
                          </Badge>
                        )}
                      </div>
                      {photo.observations && (
                        <p className="text-xs text-muted-foreground">
                          {photo.observations}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          {visit.notes && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Observações</h3>
                <Separator />
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {visit.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
