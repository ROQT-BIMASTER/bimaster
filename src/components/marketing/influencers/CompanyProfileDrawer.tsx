import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Building2, Bot, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CompanyProfile {
  company_name: string;
  segment: string;
  target_audience: string;
  brand_values: string;
  products_services: string;
  competitors: string;
  preferred_platforms: string[];
  budget_range: string;
  campaign_goals: string;
  brand_tone: string;
  autopilot_enabled: boolean;
  autopilot_frequency: string;
  last_autopilot_run: string | null;
}

const defaultProfile: CompanyProfile = {
  company_name: "",
  segment: "",
  target_audience: "",
  brand_values: "",
  products_services: "",
  competitors: "",
  preferred_platforms: [],
  budget_range: "",
  campaign_goals: "",
  brand_tone: "",
  autopilot_enabled: false,
  autopilot_frequency: "weekly",
  last_autopilot_run: null,
};

const PLATFORMS = ["instagram", "tiktok", "youtube", "twitter", "facebook", "linkedin"];

interface CompanyProfileDrawerProps {
  autopilotEnabled: boolean;
  onAutopilotChange: (enabled: boolean) => void;
}

export function CompanyProfileDrawer({ autopilotEnabled, onAutopilotChange }: CompanyProfileDrawerProps) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile>(defaultProfile);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("influencer_company_profile")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          company_name: data.company_name || "",
          segment: data.segment || "",
          target_audience: data.target_audience || "",
          brand_values: data.brand_values || "",
          products_services: data.products_services || "",
          competitors: data.competitors || "",
          preferred_platforms: data.preferred_platforms || [],
          budget_range: data.budget_range || "",
          campaign_goals: data.campaign_goals || "",
          brand_tone: data.brand_tone || "",
          autopilot_enabled: data.autopilot_enabled || false,
          autopilot_frequency: data.autopilot_frequency || "weekly",
          last_autopilot_run: data.last_autopilot_run,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadProfile();
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = { user_id: user.id, ...profile };
      const { error } = await supabase
        .from("influencer_company_profile")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
      onAutopilotChange(profile.autopilot_enabled);
      toast.success("Perfil da empresa salvo!");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const togglePlatform = (p: string) => {
    setProfile(prev => ({
      ...prev,
      preferred_platforms: prev.preferred_platforms.includes(p)
        ? prev.preferred_platforms.filter(x => x !== p)
        : [...prev.preferred_platforms, p],
    }));
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Building2 className="h-4 w-4 mr-1" />
          Minha Empresa
          {autopilotEnabled && (
            <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              <Bot className="h-3 w-3 mr-1" />
              Auto
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Perfil da Empresa</SheetTitle>
          <SheetDescription>
            Preencha dados da sua marca para a IA encontrar influenciadores mais relevantes.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nome da Empresa</Label>
              <Input value={profile.company_name} onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))} placeholder="Ex: Minha Marca" />
            </div>
            <div>
              <Label>Segmento / Nicho</Label>
              <Input value={profile.segment} onChange={e => setProfile(p => ({ ...p, segment: e.target.value }))} placeholder="Ex: Moda sustentável, SaaS B2B" />
            </div>
            <div>
              <Label>Público-alvo</Label>
              <Textarea value={profile.target_audience} onChange={e => setProfile(p => ({ ...p, target_audience: e.target.value }))} placeholder="Ex: Mulheres 25-35 anos, classe AB, interessadas em sustentabilidade" rows={2} />
            </div>
            <div>
              <Label>Valores da Marca</Label>
              <Textarea value={profile.brand_values} onChange={e => setProfile(p => ({ ...p, brand_values: e.target.value }))} placeholder="Ex: Sustentabilidade, inovação, transparência" rows={2} />
            </div>
            <div>
              <Label>Produtos / Serviços</Label>
              <Textarea value={profile.products_services} onChange={e => setProfile(p => ({ ...p, products_services: e.target.value }))} placeholder="Ex: Roupas femininas eco-friendly, acessórios reciclados" rows={2} />
            </div>
            <div>
              <Label>Concorrentes</Label>
              <Input value={profile.competitors} onChange={e => setProfile(p => ({ ...p, competitors: e.target.value }))} placeholder="Ex: Marca A, Marca B, Marca C" />
            </div>
            <div>
              <Label>Tom de Comunicação</Label>
              <Input value={profile.brand_tone} onChange={e => setProfile(p => ({ ...p, brand_tone: e.target.value }))} placeholder="Ex: Descontraído, profissional, inspirador" />
            </div>
            <div>
              <Label>Objetivos de Campanha</Label>
              <Textarea value={profile.campaign_goals} onChange={e => setProfile(p => ({ ...p, campaign_goals: e.target.value }))} placeholder="Ex: Aumentar awareness, gerar vendas diretas, lançamento de produto" rows={2} />
            </div>
            <div>
              <Label>Faixa de Orçamento</Label>
              <Select value={profile.budget_range} onValueChange={v => setProfile(p => ({ ...p, budget_range: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="micro">Até R$ 5.000/mês</SelectItem>
                  <SelectItem value="small">R$ 5.000 - R$ 20.000/mês</SelectItem>
                  <SelectItem value="medium">R$ 20.000 - R$ 100.000/mês</SelectItem>
                  <SelectItem value="large">R$ 100.000+/mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plataformas Preferidas</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PLATFORMS.map(p => (
                  <Badge
                    key={p}
                    variant={profile.preferred_platforms.includes(p) ? "default" : "outline"}
                    className="cursor-pointer capitalize"
                    onClick={() => togglePlatform(p)}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Autopilot IA
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    A IA buscará e analisará influenciadores automaticamente
                  </p>
                </div>
                <Switch
                  checked={profile.autopilot_enabled}
                  onCheckedChange={v => setProfile(p => ({ ...p, autopilot_enabled: v }))}
                />
              </div>
              {profile.autopilot_enabled && (
                <div className="mt-3">
                  <Label>Frequência</Label>
                  <Select value={profile.autopilot_frequency} onValueChange={v => setProfile(p => ({ ...p, autopilot_frequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                  {profile.last_autopilot_run && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Última execução: {new Date(profile.last_autopilot_run).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Perfil
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
