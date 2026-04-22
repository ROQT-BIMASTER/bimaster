import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon, Maximize2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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

export interface Group {
  key: string;
  storeName: string;
  storeAddress?: string;
  date: string;
  before?: Photo;
  after?: Photo;
}

function buildGroups(photos: Photo[]): Group[] {
  const map = new Map<string, Group>();

  for (const photo of photos) {
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

    if (
      photo.upload_date &&
      (!existing.date || new Date(photo.upload_date) < new Date(existing.date))
    ) {
      existing.date = photo.upload_date;
    }

    map.set(key, existing);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

interface ComparisonCardProps {
  group: Group;
  onPhotoClick: (id: string) => void;
  onFocus: () => void;
  focusMode?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const ComparisonCard = ({
  group,
  onPhotoClick,
  onFocus,
  focusMode,
  selectable,
  selected,
  onToggleSelect,
}: ComparisonCardProps) => {
  const headingSize = focusMode
    ? "text-3xl sm:text-4xl"
    : "text-xl sm:text-2xl";
  const aspectClass = focusMode ? "aspect-[3/4]" : "aspect-[3/4]";

  return (
    <Card
      className={cn(
        "overflow-hidden h-full transition-all",
        selectable && selected && "ring-2 ring-trade shadow-md",
      )}
    >
      <CardContent className={focusMode ? "p-6 sm:p-8" : "p-4 sm:p-5"}>
        {/* Cabeçalho estilo relatório */}
        <div className="relative mb-4">
          {selectable && !focusMode && (
            <div className="absolute left-0 top-0">
              <Checkbox
                checked={!!selected}
                onCheckedChange={() => onToggleSelect?.()}
                aria-label={`Selecionar ${group.storeName}`}
                className="h-5 w-5 data-[state=checked]:bg-trade data-[state=checked]:border-trade"
              />
            </div>
          )}
          {!focusMode && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onFocus}
              className="absolute right-0 top-0 h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Modo foco"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
          <div className="text-center">
            <h3 className={`${headingSize} font-semibold text-foreground tracking-tight`}>
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
        </div>

        {/* Grid Antes / Depois */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
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
                className={`block w-full ${aspectClass} bg-muted rounded-md overflow-hidden hover:ring-2 hover:ring-trade transition-all`}
              >
                <img
                  src={group.before.photo_url}
                  alt={`Antes - ${group.storeName}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ) : (
              <div className={`${aspectClass} bg-muted rounded-md flex flex-col items-center justify-center text-muted-foreground`}>
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
                className={`block w-full ${aspectClass} bg-muted rounded-md overflow-hidden hover:ring-2 hover:ring-trade transition-all`}
              >
                <img
                  src={group.after.photo_url}
                  alt={`Depois - ${group.storeName}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ) : (
              <div className={`${aspectClass} bg-muted rounded-md flex flex-col items-center justify-center text-muted-foreground`}>
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
  );
};

interface PhotoBeforeAfterViewProps {
  photos: Photo[];
  onPhotoClick: (photoId: string) => void;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onToggleSelect?: (key: string) => void;
  onGroupsChange?: (groups: Group[]) => void;
}

export const PhotoBeforeAfterView = ({
  photos,
  onPhotoClick,
  selectable,
  selectedKeys,
  onToggleSelect,
  onGroupsChange,
}: PhotoBeforeAfterViewProps) => {
  const groups = useMemo(() => buildGroups(photos), [photos]);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  useEffect(() => {
    onGroupsChange?.(groups);
  }, [groups, onGroupsChange]);

  const focusGroup = useMemo(
    () => groups.find((g) => g.key === focusKey) || null,
    [groups, focusKey],
  );

  if (groups.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {groups.map((group) => (
          <ComparisonCard
            key={group.key}
            group={group}
            onPhotoClick={onPhotoClick}
            onFocus={() => setFocusKey(group.key)}
            selectable={selectable}
            selected={selectedKeys?.has(group.key)}
            onToggleSelect={() => onToggleSelect?.(group.key)}
          />
        ))}
      </div>

      <Dialog open={!!focusGroup} onOpenChange={(open) => !open && setFocusKey(null)}>
        <DialogContent
          className="max-w-6xl w-[95vw] max-h-[95vh] overflow-y-auto p-0"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => setFocusKey(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-background/90 p-2 text-muted-foreground hover:text-foreground shadow-md"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          {focusGroup && (
            <div className="p-2">
              <ComparisonCard
                group={focusGroup}
                onPhotoClick={onPhotoClick}
                onFocus={() => {}}
                focusMode
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
