import { useMemo, useState } from "react";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertOctagon, Plus, Search, Loader2 } from "lucide-react";
import { useNaoConformidades } from "@/hooks/useChinaNaoConformidades";
import { AbrirNCDialog } from "@/components/china/divergencias/AbrirNCDialog";
import { DivergenciaDetailPanel } from "@/components/china/divergencias/DivergenciaDetailPanel";
import { cn } from "@/lib/utils";

const TIPO_COLOR: Record<string, string> = {
  faltante: "bg-orange-500",
  avariado: "bg-red-500",
  errado: "bg-purple-500",
  atraso: "bg-amber-500",
  qualidade: "bg-blue-500",
  outro: "bg-slate-500",
};
const SEV_COLOR: Record<string, string> = {
  baixa: "bg-slate-500",
  media: "bg-amber-500",
  alta: "bg-orange-600",
  critica: "bg-red-600",
};

export default function ChinaDivergenciasRecebimento() {
  const { data: ncs = [], isLoading } = useNaoConformidades();
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<string>("ativas");
  const [tipoF, setTipoF] = useState<string>("all");
  const [sevF, setSevF] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return ncs.filter((n: any) => {
      if (statusF === "ativas" && !["aberta", "em_tratativa"].includes(n.status)) return false;
      if (statusF !== "ativas" && statusF !== "all" && n.status !== statusF) return false;
      if (tipoF !== "all" && n.tipo !== tipoF) return false;
      if (sevF !== "all" && n.severidade !== sevF) return false;
      if (search) {
        const s = search.toLowerCase();
        const blob = `${n.numero_nc} ${n.oc?.numero_oc || ""} ${n.oc?.produto_codigo || ""} ${n.descricao || ""}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [ncs, search, statusF, tipoF, sevF]);

  const selected = filtered.find((n: any) => n.id === selectedId) || filtered[0];

  const kpis = useMemo(() => {
    const abertas = ncs.filter((n: any) => ["aberta", "em_tratativa"].includes(n.status)).length;
    const criticas = ncs.filter((n: any) => n.severidade === "critica" && ["aberta", "em_tratativa"].includes(n.status)).length;
    const qty = ncs.reduce((acc: number, n: any) =>
      ["aberta", "em_tratativa"].includes(n.status) ? acc + Number(n.qty_envolvida || 0) : acc, 0);
    const resolvidas = ncs.filter((n: any) => n.status === "resolvida" && n.resolvida_em);
    let mttrH: number | null = null;
    if (resolvidas.length) {
      const total = resolvidas.reduce((acc: number, n: any) => {
        const d = (new Date(n.resolvida_em).getTime() - new Date(n.created_at).getTime()) / 36e5;
        return acc + d;
      }, 0);
      mttrH = total / resolvidas.length;
    }
    return { abertas, criticas, qty, mttrH };
  }, [ncs]);

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        icon={AlertOctagon}
        titlePt="Divergências de Recebimento"
        titleCn="收货差异"
        subtitle="Avariado, faltante, saldo e qualidade — com tratativa e resolução."
        showBack
        backTo="/dashboard/fabrica-china/recebimentos-oc"
        backLabel="Voltar para Monitor"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {[
          { l: "Abertas / em tratativa", v: kpis.abertas.toLocaleString("pt-BR") },
          { l: "Críticas ativas", v: kpis.criticas.toLocaleString("pt-BR"), warn: kpis.criticas > 0 },
          { l: "Qty envolvida ativa", v: kpis.qty.toLocaleString("pt-BR") },
          { l: "MTTR médio (h)", v: kpis.mttrH != null ? kpis.mttrH.toFixed(1) : "—" },
        ].map((k) => (
          <Card key={k.l} className={cn("p-3", k.warn && "border-red-500/50 bg-red-500/5")}>
            <div className="text-[11px] text-muted-foreground uppercase">{k.l}</div>
            <div className="text-xl font-semibold mt-1">{k.v}</div>
          </Card>
        ))}
      </div>

      <Card className="p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar NC, OC, produto…"
            className="pl-7 h-9"
          />
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativas">Ativas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="aberta">Aberta</SelectItem>
            <SelectItem value="em_tratativa">Em tratativa</SelectItem>
            <SelectItem value="resolvida">Resolvida</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipoF} onValueChange={setTipoF}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="faltante">Faltante</SelectItem>
            <SelectItem value="avariado">Avariado</SelectItem>
            <SelectItem value="errado">Errado</SelectItem>
            <SelectItem value="atraso">Atraso</SelectItem>
            <SelectItem value="qualidade">Qualidade</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sevF} onValueChange={setSevF}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda severidade</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setOpenNew(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova divergência
        </Button>
      </Card>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-5 space-y-2 max-h-[calc(100vh-340px)] overflow-auto pr-1">
          {isLoading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2 p-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma divergência com os filtros atuais.
            </Card>
          )}
          {filtered.map((n: any) => {
            const isSel = (selected as any)?.id === n.id;
            const idadeH = (Date.now() - new Date(n.created_at).getTime()) / 36e5;
            return (
              <Card
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className={cn(
                  "p-2.5 cursor-pointer hover:border-primary transition-colors",
                  isSel && "border-primary ring-1 ring-primary/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-semibold">{n.numero_nc}</span>
                      <Badge className={`${TIPO_COLOR[n.tipo]} text-white text-[10px] py-0 h-4`}>{n.tipo}</Badge>
                      <Badge className={`${SEV_COLOR[n.severidade]} text-white text-[10px] py-0 h-4 uppercase`}>{n.severidade}</Badge>
                    </div>
                    <div className="text-xs mt-1 truncate">
                      <span className="font-mono text-muted-foreground">{n.oc?.numero_oc}</span>
                      {n.oc?.produto_codigo && <> · {n.oc.produto_codigo}</>}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">{n.descricao}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-foreground">Qty</div>
                    <div className="text-sm font-semibold">{Number(n.qty_envolvida || 0).toLocaleString("pt-BR")}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {idadeH < 24 ? `${Math.round(idadeH)}h` : `${Math.round(idadeH / 24)}d`}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="col-span-12 lg:col-span-7">
          {selected ? (
            <DivergenciaDetailPanel nc={selected} key={(selected as any).id} />
          ) : (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Selecione uma divergência à esquerda
            </Card>
          )}
        </div>
      </div>

      <AbrirNCDialog open={openNew} onOpenChange={setOpenNew} />
    </ChinaPageShell>
  );
}
