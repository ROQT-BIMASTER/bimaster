import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
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
import { Ruler, CalendarIcon, TrendingUp, PieChart, BarChart3, HelpCircle, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";

interface BrandMeasurement {
  id: string;
  brand_id: string;
  width_cm: number;
  shelf_count: number;
  total_cm: number;
  facings: number | null;
  our_brands: {
    brand_name: string;
  } | null;
}

interface ShelfMeasurement {
  id: string;
  store_id: string;
  measurement_date: string;
  shelf_section: string | null;
  total_shelf_width_cm: number;
  shelf_count: number | null;
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
  shelf_measurement_brands?: BrandMeasurement[];
}

export default function TradeShelfMeasurements() {
  const navigate = useNavigate();
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const [measurements, setMeasurements] = useState<ShelfMeasurement[]>([]);
  const [filteredMeasurements, setFilteredMeasurements] = useState<ShelfMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<ShelfMeasurement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [measurementToDelete, setMeasurementToDelete] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [measurementDate, setMeasurementDate] = useState<Date>(new Date());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
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
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });

    const channel = supabase
      .channel('shelf-measurements-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shelf_measurements' }, fetchMeasurements)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (currentUserId !== null && !roleLoading) {
      fetchMeasurements();
    }
  }, [currentUserId, roleLoading, isAdminOrSupervisor]);

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
      let query = supabase
        .from("shelf_measurements")
        .select(`
          *,
          stores (name, code),
          shelf_measurement_brands (
            id,
            brand_id,
            width_cm,
            shelf_count,
            total_cm,
            facings,
            our_brands (brand_name)
          )
        `);

      // Filtrar para não-admins/supervisores
      if (!isAdminOrSupervisor && currentUserId) {
        query = query.or(`created_by.eq.${currentUserId},vendedor_id.eq.${currentUserId}`);
      }

      const { data, error } = await query.order("measurement_date", { ascending: false });

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
    
    if (!selectedStore && !editingMeasurement) {
      toast.error("Selecione uma loja");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const measurementData = {
        store_id: selectedStore || editingMeasurement?.store_id,
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
      };

      if (editingMeasurement) {
        const { error } = await supabase
          .from("shelf_measurements")
          .update(measurementData)
          .eq("id", editingMeasurement.id);

        if (error) throw error;
        toast.success("Medição atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("shelf_measurements")
          .insert({
            ...measurementData,
            vendedor_id: user.id,
            created_by: user.id
          });

        if (error) throw error;
        toast.success("Medição registrada com sucesso!");
      }

      setDialogOpen(false);
      setEditingMeasurement(null);
      resetForm();
      fetchMeasurements();
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar medição");
    }
  };

  const handleEdit = (measurement: ShelfMeasurement) => {
    setEditingMeasurement(measurement);
    setSelectedStore(measurement.store_id);
    setMeasurementDate(new Date(measurement.measurement_date));
    setFormData({
      shelf_section: measurement.shelf_section || "",
      total_shelf_width_cm: measurement.total_shelf_width_cm.toString(),
      total_shelf_height_cm: "",
      total_facings: measurement.total_facings?.toString() || "",
      our_brands_width_cm: measurement.our_brands_width_cm?.toString() || "",
      our_brands_facings: measurement.our_brands_facings?.toString() || "",
      competitors_width_cm: "",
      competitors_facings: "",
      observations: measurement.observations || ""
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (measurementId: string) => {
    setMeasurementToDelete(measurementId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!measurementToDelete) return;

    try {
      const { error } = await supabase
        .from("shelf_measurements")
        .delete()
        .eq("id", measurementToDelete);

      if (error) throw error;

      toast.success("Medição excluída com sucesso!");
      setDeleteDialogOpen(false);
      setMeasurementToDelete(null);
      fetchMeasurements();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir medição");
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
    setEditingMeasurement(null);
    setSelectedStore(null);
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
        <ModuleBreadcrumb 
          moduleName="Trade Marketing" 
          moduleHref="/dashboard/trade" 
          currentPage="Medição de Prateleiras" 
        />
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Medição de Prateleiras</h1>
            <p className="text-muted-foreground">
              Gerencie o espaço ocupado pelas suas marcas nas lojas
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => navigate("/dashboard/trade/brand-share")}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Dashboard de Marcas
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate("/dashboard/trade/measurement-guide")}
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              Como Medir
            </Button>
            <Button 
              onClick={() => setDialogOpen(true)} 
              disabled={!selectedStore}
            >
              <Ruler className="mr-2 h-4 w-4" />
              Nova Medição
            </Button>
          </div>
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
                    <div className="flex-1">
                      <CardTitle>{measurement.stores?.name}</CardTitle>
                      <CardDescription>
                        {format(new Date(measurement.measurement_date), "dd/MM/yyyy", { locale: ptBR })}
                        {measurement.shelf_section && ` • ${measurement.shelf_section}`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant="secondary">
                        Share: {measurement.shelf_share_percentage?.toFixed(1) || 0}%
                      </Badge>
                      <Badge variant="outline">
                        Frentes: {measurement.facing_share_percentage?.toFixed(1) || 0}%
                      </Badge>
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(measurement)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteClick(measurement.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Largura Total</p>
                      <p className="font-semibold">{measurement.total_shelf_width_cm} cm</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Prateleiras</p>
                      <p className="font-semibold">{measurement.shelf_count || 1}</p>
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

                  {/* Breakdown por Marca */}
                  {measurement.shelf_measurement_brands && measurement.shelf_measurement_brands.length > 0 && (
                    <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                      <p className="text-sm font-medium mb-3 flex items-center gap-2">
                        🏷️ Detalhamento por Marca
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {measurement.shelf_measurement_brands.map((brand) => (
                          <div key={brand.id} className="p-2 bg-background rounded-md border">
                            <p className="text-xs text-muted-foreground truncate">
                              {brand.our_brands?.brand_name || "Marca"}
                            </p>
                            <p className="font-semibold text-sm">
                              {brand.width_cm} cm × {brand.shelf_count}
                            </p>
                            <p className="text-xs text-primary font-medium">
                              = {brand.total_cm} cm
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
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

      {/* Dialog Nova/Editar Medição */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingMeasurement(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMeasurement ? "Editar Medição de Prateleira" : "Nova Medição de Prateleira"}
            </DialogTitle>
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
              <Button type="button" variant="outline" onClick={() => {
                setDialogOpen(false);
                setEditingMeasurement(null);
                resetForm();
              }}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingMeasurement ? "Salvar Alterações" : "Registrar Medição"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta medição? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMeasurementToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
