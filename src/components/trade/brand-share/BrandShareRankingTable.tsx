import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Store } from "lucide-react";

interface StoreRanking {
  storeId: string;
  storeName: string;
  storeCode: string;
  totalShare: number;
  measurementCount: number;
  brandShares: { [brandName: string]: number };
}

interface BrandShareRankingTableProps {
  data: StoreRanking[];
}

export function BrandShareRankingTable({ data }: BrandShareRankingTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Ranking de Lojas por Share
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Sem dados para exibir
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-amber-500">🥇 1º</Badge>;
    if (index === 1) return <Badge className="bg-gray-400">🥈 2º</Badge>;
    if (index === 2) return <Badge className="bg-amber-700">🥉 3º</Badge>;
    return <Badge variant="outline">{index + 1}º</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Ranking de Lojas por Share
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((store, index) => (
            <div
              key={store.storeId}
              className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex-shrink-0">
                {getRankBadge(index)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate">{store.storeName}</span>
                  <span className="text-xs text-muted-foreground">({store.storeCode})</span>
                </div>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {Object.entries(store.brandShares).map(([brand, share]) => (
                    <span key={brand} className="text-xs text-muted-foreground">
                      {brand}: {share.toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex-shrink-0 text-right">
                <div className="text-lg font-bold text-primary">
                  {store.totalShare.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {store.measurementCount} medições
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
