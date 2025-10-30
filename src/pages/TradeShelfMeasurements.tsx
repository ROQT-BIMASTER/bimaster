import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TradeFilters } from "@/components/trade/TradeFilters";
import { Ruler, CalendarIcon, TrendingUp, PieChart, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ShelfMeasurement {
  id: string;
  store_id: string;
  measurement_date: string;
  shelf_section: string | null;
  total_shelf_width_cm: number;
  our_brands_width_cm: number | null;
  shelf_share_percentage: number | null;
  total_facings: number | null;
  our_brands_facings: number | null;
  facing_share_percentage: number | null;
  observations: string | null;
  stores: {
    name: string;
    code: string;
  } | null;
}

export default function TradeShelfMeasurements() {
  const [measurements, setMeasurements] = useState<ShelfMeasurement[]>([]);
  const [filteredMeasurements, setFilteredMeasurements] = useState<ShelfMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [measurementDate, setMeasurementDate] = useState<Date>(new Date());
  
  const [formData, setFormData] = useState({
    shelf_section: "",
    total_shelf_width_cm: "",
    total_shelf_height_cm: "",
    total_facings: "",
    our_brands_width_cm: "",
    our_brands_facings: "",
    competitors_width_cm: "",
    competitors_facings: "",
    observations: ""
  });

  useEffect(() => {
    fetchMeasurements();

    const channel = supabase
      .channel('shelf-measurements-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shelf_measurements' }, fetchMeasurements)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [measurements, selectedStore]);

  const applyFilters = () => {
    let filtered = [...measurements];
    if (selectedStore) {
      filtered = filtered.filter(m => m.store_id === selectedStore);
    }
    setFilteredMeasurements(filtered);
  };

  const fetchMeasurements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shelf_measurements")
        .select(`
          *,
          stores (name, code)
        `)
        .order("measurement_date", { ascending: false });

      if (error) throw error;
      setMeasurements(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStore) {
      toast.error("Selecione uma loja");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("shelf_measurements")
        .insert({
          store_id: selectedStore,
          measurement_date: format(measurementDate, "yyyy-MM-dd"),
          shelf_section: formData.shelf_section || null,
          total_shelf_width_cm: parseFloat(formData.total_shelf_width_cm),
          total_shelf_height_cm: formData.total_shelf_height_cm ? parseFloat(formData.total_shelf_height_cm) : null,
          total_facings: formData.total_facings ? parseInt(formData.total_facings) : null,
          our_brands_width_cm: formData.our_brands_width_cm ? parseFloat(formData.our_brands_width_cm) : null,
          our_brands_facings: formData.our_brands_facings ? parseInt(formData.our_brands_facings) : null,
          competitors_width_cm: formData.competitors_width_cm ? parseFloat(formData.competitors_width_cm) : null,
          competitors_facings: formData.competitors_facings ? parseInt(formData.competitors_facings) : null,
          observations: formData.observations || null,
          created_by: user.id
        });

      if (error) throw error;

      toast.success("Medição registrada com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchMeasurements();
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar medição");
    }
  };

  const resetForm = () => {
    setFormData({
      shelf_section: "",
      total_shelf_width_cm: "",
      total_shelf_height_cm: "",
      total_facings: "",
      our_brands_width_cm: "",
      our_brands_facings: "",
      competitors_width_cm: "",
      competitors_facings: "",
      observations: ""
    });
    setMeasurementDate(new Date());
  };

  // KPIs
  const avgShelfShare = filteredMeasurements.length > 0
    ? filteredMeasurements.reduce((sum, m) => sum + (m.shelf_share_percentage || 0), 0) / filteredMeasurements.length
    : 0;

  const avgFacingShare = filteredMeasurements.length > 0
    ? filteredMeasurements.reduce((sum, m) => sum + (m.facing_share_percentage || 0), 0) / filteredMeasurements.length
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Medição de Prateleiras</h1>
            <p className="text-muted-foreground">
              Gerencie o espaço ocupado pelas suas marcas nas lojas
            </p>
          </div>
          <Button 
            onClick={() => setDialogOpen(true)} 
            disabled={!selectedStore}
          >
            <Ruler className="mr-2 h-4 w-4" />
            Nova Medição
          </Button>
        </div>

        <TradeFilters
          onStoreChange={setSelectedStore}
          onAIFilter={() => {}}
          selectedStore={selectedStore}
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Medições Registradas</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredMeasurements.length}</div>
              <p className="text-xs text-muted-foreground">medições totais</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Share Médio (Espaço)</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgShelfShare.toFixed(1)}%</div>
              <Progress value={avgShelfShare} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Share Médio (Frentes)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgFacingShare.toFixed(1)}%</div>
              <Progress value={avgFacingShare} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Lista de Medições */}
        {loading ? (
          <div className="text-center py-8">Carregando medições...</div>
        ) : filteredMeasurements.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Nenhuma medição registrada.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredMeasurements.map((measurement) => (
              <Card key={measurement.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{measurement.stores?.name}</CardTitle>
                      <CardDescription>
                        {format(new Date(measurement.measurement_date), "dd/MM/yyyy", { locale: ptBR })}
                        {measurement.shelf_section && ` • ${measurement.shelf_section}`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">
                        Share: {measurement.shelf_share_percentage?.toFixed(1) || 0}%
                      </Badge>
                      <Badge variant="outline">
                        Frentes: {measurement.facing_share_percentage?.toFixed(1) || 0}%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Largura Total</p>
                      <p className="font-semibold">{measurement.total_shelf_width_cm} cm</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nossas Marcas</p>
                      <p className="font-semibold">{measurement.our_brands_width_cm || 0} cm</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total de Frentes</p>
                      <p className="font-semibold">{measurement.total_facings || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Frentes Nossas</p>
                      <p className="font-semibold">{measurement.our_brands_facings || 0}</p>
                    </div>
                  </div>
                  
                  {measurement.shelf_share_percentage !== null && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Espaço Ocupado</span>
                        <span className="font-semibold">{measurement.shelf_share_percentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={measurement.shelf_share_percentage} />
                    </div>
                  )}

                  {measurement.observations && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <p className="text-sm">{measurement.observations}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog Nova Medição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Medição de Prateleira</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="section">Seção da Prateleira</Label>
                <Input
                  id="section"
                  value={formData.shelf_section}
                  onChange={(e) => setFormData(prev => ({ ...prev, shelf_section: e.target.value }))}
                  placeholder="Ex: Bebidas, Higiene..."
                />
              </div>

              <div className="space-y-2">
                <Label>Data da Medição *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(measurementDate, "dd/MM/yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={measurementDate}
                      onSelect={(date) => date && setMeasurementDate(date)}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Dimensões da Prateleira</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_width">Largura Total (cm) *</Label>
                  <Input
                    id="total_width"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.total_shelf_width_cm}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_shelf_width_cm: e.target.value }))}
                    placeholder="Ex: 300"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="total_height">Altura (cm)</Label>
                  <Input
                    id="total_height"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.total_shelf_height_cm}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_shelf_height_cm: e.target.value }))}
                    placeholder="Ex: 180"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Nossas Marcas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="our_width">Largura Ocupada (cm)</Label>
                  <Input
                    id="our_width"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.our_brands_width_cm}
                    onChange={(e) => setFormData(prev => ({ ...prev, our_brands_width_cm: e.target.value }))}
                    placeholder="Ex: 120"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="our_facings">Número de Frentes</Label>
                  <Input
                    id="our_facings"
                    type="number"
                    min="0"
                    value={formData.our_brands_facings}
                    onChange={(e) => setFormData(prev => ({ ...prev, our_brands_facings: e.target.value }))}
                    placeholder="Ex: 12"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Concorrentes</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="comp_width">Largura Ocupada (cm)</Label>
                  <Input
                    id="comp_width"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.competitors_width_cm}
                    onChange={(e) => setFormData(prev => ({ ...prev, competitors_width_cm: e.target.value }))}
                    placeholder="Ex: 180"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comp_facings">Número de Frentes</Label>
                  <Input
                    id="comp_facings"
                    type="number"
                    min="0"
                    value={formData.competitors_facings}
                    onChange={(e) => setFormData(prev => ({ ...prev, competitors_facings: e.target.value }))}
                    placeholder="Ex: 18"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_facings">Total de Frentes na Prateleira</Label>
              <Input
                id="total_facings"
                type="number"
                min="0"
                value={formData.total_facings}
                onChange={(e) => setFormData(prev => ({ ...prev, total_facings: e.target.value }))}
                placeholder="Ex: 30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observations">Observações</Label>
              <Textarea
                id="observations"
                value={formData.observations}
                onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                placeholder="Observações sobre a medição..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar Medição</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
