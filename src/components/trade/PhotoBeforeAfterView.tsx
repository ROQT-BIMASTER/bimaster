import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Photo {
  id: string;
  photo_url: string;
  photo_type: string;
  ai_processed: boolean;
  upload_date: string;
  ai_analysis: any;
  store_id: string | null;
  stores: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  // Campos opcionais usados pelo agrupamento
  visit_id?: string | null;
  category?: string | null;
}

interface Group {
  key: string;
  storeName: string;
  storeAddress?: string;
  date: string;
  before?: Photo;
  after?: Photo;
  // Quando o grupo tem apenas um lado, mostramos ambas as colunas
  // mas a ausente fica como placeholder.
}

function buildGroups(photos: Photo[]): Group[] {
  const map = new Map<string, Group>();

  for (const photo of photos) {
    // Usamos visit_id como chave principal (cobre o fluxo do Lançamento Rápido).
    // Quando ausente, agrupamos por loja + dia para emparelhar uploads avulsos.
    const dayKey = photo.upload_date?.slice(0, 10) ?? "";
    const key = photo.visit_id
      ? `visit:${photo.visit_id}`
      : `store:${photo.store_id ?? "sem-loja"}:${dayKey}`;

    const addressParts = [
      photo.stores?.address,
      photo.stores?.city,
      photo.stores?.state,
    ].filter(Boolean);
    const storeAddress = addressParts.join(" - ");

    const existing =
      map.get(key) ??
      ({
        key,
        storeName: photo.stores?.name || "Loja não especificada",
        storeAddress: storeAddress || undefined,
        date: photo.upload_date,
        before: undefined,
        after: undefined,
      } as Group);

    if (!existing.storeAddress && storeAddress) {
      existing.storeAddress = storeAddress;
    }

    if (photo.category === "before" && !existing.before) {
      existing.before = photo;
    } else if (photo.category === "after" && !existing.after) {
      existing.after = photo;
    } else if (!existing.before) {
      existing.before = photo;
    } else if (!existing.after) {
      existing.after = photo;
    }

    // Manter a data mais antiga do grupo como referência.
    if (
      photo.upload_date &&
      (!existing.date || new Date(photo.upload_date) < new Date(existing.date))
    ) {
      existing.date = photo.upload_date;
    }

    map.set(key, existing);
  }

  // Ordenar por data desc.
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

interface PhotoBeforeAfterViewProps {
  photos: Photo[];
  onPhotoClick: (photoId: string) => void;
}

export const PhotoBeforeAfterView = ({
  photos,
  onPhotoClick,
}: PhotoBeforeAfterViewProps) => {
  const groups = useMemo(() => buildGroups(photos), [photos]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <Card key={group.key} className="overflow-hidden max-w-4xl mx-auto">
          <CardContent className="p-4 sm:p-6">
            {/* Cabeçalho estilo relatório */}
            <div className="text-center mb-4">
              <h3 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
                {group.storeName}
              </h3>
              {group.storeAddress && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {group.storeAddress}
                </p>
              )}
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 uppercase tracking-wider">
                Data:{" "}
                {new Date(group.date).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </p>
            </div>

            {/* Grid Antes / Depois */}
            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              {/* ANTES */}
              <div className="space-y-2">
                <div className="text-center">
                  <span className="text-xs sm:text-sm font-bold tracking-[0.2em] text-trade">
                    ANTES
                  </span>
                </div>
                {group.before ? (
                  <button
                    type="button"
                    onClick={() => onPhotoClick(group.before!.id)}
                    className="block w-full aspect-[3/4] bg-muted rounded-md overflow-hidden hover:ring-2 hover:ring-trade transition-all"
                  >
                    <img
                      src={group.before.photo_url}
                      alt={`Antes - ${group.storeName}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <div className="aspect-[3/4] bg-muted rounded-md flex flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-xs">Sem foto Antes</span>
                  </div>
                )}
              </div>

              {/* DEPOIS */}
              <div className="space-y-2">
                <div className="text-center">
                  <span className="text-xs sm:text-sm font-bold tracking-[0.2em] text-trade">
                    DEPOIS
                  </span>
                </div>
                {group.after ? (
                  <button
                    type="button"
                    onClick={() => onPhotoClick(group.after!.id)}
                    className="block w-full aspect-[3/4] bg-muted rounded-md overflow-hidden hover:ring-2 hover:ring-trade transition-all"
                  >
                    <img
                      src={group.after.photo_url}
                      alt={`Depois - ${group.storeName}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <div className="aspect-[3/4] bg-muted rounded-md flex flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-xs">Sem foto Depois</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé com badges de IA quando houver */}
            {(group.before?.ai_processed || group.after?.ai_processed) && (
              <div className="flex items-center justify-center gap-2 mt-4">
                {group.before?.ai_processed && (
                  <Badge variant="outline" className="text-[10px]">
                    Antes • IA
                  </Badge>
                )}
                {group.after?.ai_processed && (
                  <Badge variant="outline" className="text-[10px]">
                    Depois • IA
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
