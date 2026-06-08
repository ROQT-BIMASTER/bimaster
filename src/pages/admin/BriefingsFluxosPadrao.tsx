import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, ExternalLink, Save, Trash2, AlertTriangle, ArrowLeft, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TIPO_META } from "@/components/briefings/briefing-types";

const TIPOS_BRIEFING = [
  "pdv",
  "embalagem",
  "evento",
  "campanha",
  "ecommerce",
  "presskit",
  "catalogo",
  "material_interno",
] as const;

interface ConfigOption {
  id: string;
  nome: string;
  descricao: string | null;
  checklist_tipo: string;
  etapas_count: number;
}

interface PadraoRow {
  tipo: string;
  config_id: string | null;
  prazo_dias_default: number | null;
}

export default function BriefingsFluxosPadrao() {
  const [configs, setConfigs] = useState<ConfigOption[]>([]);
  const [rows, setRows] = useState<Record<string, PadraoRow>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: cfgs }, { data: padroes }, { data: etapas }] = await Promise.all([
      supabase
        .from("fluxo_aprovacao_config")
        .select("id, nome, descricao, checklist_tipo")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("briefing_tipo_fluxo_padrao" as any)
        .select("tipo, config_id, prazo_dias_default"),
      supabase
        .from("fluxo_aprovacao_etapas")
        .select("config_id, ativo")
        .eq("ativo", true),
    ]);

    const countByConfig: Record<string, number> = {};
    (etapas ?? []).forEach((e: any) => {
      countByConfig[e.config_id] = (countByConfig[e.config_id] ?? 0) + 1;
    });

    setConfigs(
      (cfgs ?? []).map((c: any) => ({
        ...c,
        etapas_count: countByConfig[c.id] ?? 0,
      })),
    );

    const init: Record<string, PadraoRow> = {};
    TIPOS_BRIEFING.forEach((t) => {
      init[t] = { tipo: t, config_id: null, prazo_dias_default: null };
    });
    ((padroes as any[]) ?? []).forEach((p) => {
      init[p.tipo] = {
        tipo: p.tipo,
        config_id: p.config_id,
        prazo_dias_default: p.prazo_dias_default,
      };
    });
    setRows(init);
    setDirty({});
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleChange = (tipo: string, patch: Partial<PadraoRow>) => {
    setRows((r) => ({ ...r, [tipo]: { ...r[tipo], ...patch } }));
    setDirty((d) => ({ ...d, [tipo]: true }));
  };

  const handleSave = async (tipo: string) => {
    const row = rows[tipo];
    if (!row.config_id) {
      toast.error("Selecione um fluxo antes de salvar");
      return;
    }
    setSaving((s) => ({ ...s, [tipo]: true }));
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("briefing_tipo_fluxo_padrao")
      .upsert(
        {
          tipo,
          config_id: row.config_id,
          prazo_dias_default: row.prazo_dias_default,
          updated_by: userData?.user?.id ?? null,
        },
        { onConflict: "tipo" },
      );
    setSaving((s) => ({ ...s, [tipo]: false }));
    if (error) {
      toast.error(`Não foi possível salvar: ${error.message}`);
      return;
    }
    toast.success("Configuração salva");
    setDirty((d) => ({ ...d, [tipo]: false }));
  };

  const handleClear = async (tipo: string) => {
    setSaving((s) => ({ ...s, [tipo]: true }));
    const { error } = await (supabase as any)
      .from("briefing_tipo_fluxo_padrao")
      .delete()
      .eq("tipo", tipo);
    setSaving((s) => ({ ...s, [tipo]: false }));
    if (error) {
      toast.error(`Não foi possível remover: ${error.message}`);
      return;
    }
    setRows((r) => ({
      ...r,
      [tipo]: { tipo, config_id: null, prazo_dias_default: null },
    }));
    setDirty((d) => ({ ...d, [tipo]: false }));
    toast.success("Configuração removida");
  };

  const configsById = useMemo(() => {
    const m = new Map<string, ConfigOption>();
    configs.forEach((c) => m.set(c.id, c));
    return m;
  }, [configs]);

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
          <Link to="/dashboard/briefings">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar para Briefings
          </Link>
        </Button>
      </div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Fluxos de aprovação por tipo de briefing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina, para cada modelo de briefing, qual fluxo será aplicado quando o
            usuário enviar para aprovação. As etapas e responsáveis vêm do fluxo
            escolhido.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/templates-alcadas">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Templates de alçada
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/admin/templates-alcadas?novo=1">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Novo fluxo de aprovação
            </Link>
          </Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Tipo de briefing</TableHead>
              <TableHead>Fluxo padrão</TableHead>
              <TableHead className="w-[140px]">Prazo (dias)</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[160px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : (
              TIPOS_BRIEFING.map((tipo) => {
                const meta = TIPO_META[tipo] ?? { label: tipo, bg: "bg-muted", fg: "text-foreground" };
                const row = rows[tipo];
                const cfg = row.config_id ? configsById.get(row.config_id) : null;
                const isDirty = dirty[tipo];
                const isSaving = saving[tipo];
                const configured = !!row.config_id;
                return (
                  <TableRow key={tipo}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${meta.bg} ${meta.fg}`}>
                          Briefing {meta.label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.config_id ?? "__none__"}
                        onValueChange={(v) =>
                          handleChange(tipo, { config_id: v === "__none__" ? null : v })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecionar fluxo…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Sem fluxo padrão —</SelectItem>
                          {configs.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-2">
                                <span>{c.nome}</span>
                                {c.etapas_count === 0 ? (
                                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                                    Sem etapas
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {c.etapas_count} etapa{c.etapas_count !== 1 ? "s" : ""}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cfg && cfg.etapas_count === 0 && (
                        <div className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Este fluxo ainda não tem etapas configuradas.
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={row.prazo_dias_default ?? ""}
                        onChange={(e) =>
                          handleChange(tipo, {
                            prazo_dias_default: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="h-9"
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell>
                      {configured ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Configurado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Não configurado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {configured && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClear(tipo)}
                            disabled={isSaving}
                            title="Remover configuração"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleSave(tipo)}
                          disabled={!isDirty || isSaving || !row.config_id}
                        >
                          <Save className="h-3.5 w-3.5 mr-1.5" />
                          Salvar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Os usuários ainda podem trocar o fluxo no momento do envio — esta tela apenas
        define a sugestão padrão para cada modelo.
      </p>
    </div>
  );
}
