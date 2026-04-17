import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Store, Calendar, Camera, Tag, Upload, Sparkles, 
  CheckCircle2, Loader2, ArrowRight, ImagePlus, ClipboardCheck, Ruler, HelpCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import BrandMeasurementSection from "@/components/fabrica/BrandMeasurementSection";
import { Progress } from "@/components/ui/progress";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useNavigate } from "react-router-dom";
import { useFilteredStores } from "@/hooks/useFilteredStores";
import { compressImage, uploadFile } from "@/lib/utils/storage-helper";
import { useTour, tradeQuickEntryTourSteps, TRADE_QUICK_ENTRY_TOUR_ID } from "@/components/tour";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface QuickEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const QuickEntryDialog = ({ open, onOpenChange, onSuccess }: QuickEntryDialogProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [filteredStores, setFilteredStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [completedVisitId, setCompletedVisitId] = useState<string | null>(null);
  const [showSuccessActions, setShowSuccessActions] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [brandMeasurements, setBrandMeasurements] = useState<{
    brand_id: string;
    brand_name: string;
    header_dimensions: string;
    width_cm: string;
    shelf_count: string;
  }[]>([]);
  
  const { hasPermission } = useScreenPermissions();
  const navigate = useNavigate();
  const { startTour, hasSeenTour } = useTour();
  
  // Usar hook centralizado para lojas filtradas
  const { stores, loading: storesLoading } = useFilteredStores();
  
  // Estado para dados do cliente selecionado
  const [selectedStoreData, setSelectedStoreData] = useState<{
    storesCount: number;
    curva: string | null;
  } | null>(null);

  // Tour guiado removido a pedido do usuário

  const [formData, setFormData] = useState({
    // Visita
    store_id: "",
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    visit_type: "routine",
    
    // Fotos e Análise
    photos: [] as File[],
    photos_after: [] as File[],
    ai_insights: "",
    
    // Shelf Share
    products_found: [] as string[],
    our_facings: 0,
    competitor_facings: 0,
    
    // Medições de Prateleira
    shelf_width: 0,
    shelf_height: 0,
    shelf_depth: 0,
    shelf_count: 1, // Quantidade de prateleiras
    
    // Promoções e Campanhas
    promotion_id: "",
    promotion_active: false,
    materials_present: [] as string[],
    campaign_id: "",
    expense_amount: 0,
    expense_description: "",
    evidence_files: [] as File[],
    evidence_urls: [] as string[],
    
    // Observações
    notes: "",
    issues_found: [] as string[],
  });

  // Buscar dados do cliente quando PDV é selecionado
  useEffect(() => {
    const fetchClientData = async () => {
      if (!formData.store_id) {
        setSelectedStoreData(null);
        return;
      }
      
      const selectedStore = stores.find(s => s.id === formData.store_id);
      if (!selectedStore) {
        setSelectedStoreData(null);
        return;
      }
      
      // Buscar quantas lojas esse cliente (pela rede/chain) tem
      let storesCount = 1;
      let curva: string | null = null;
      
      // Contar todas as lojas do mesmo vendedor (grupo de lojas atendidas)
      if (selectedStore.vendedor_id) {
        const { count } = await supabase
          .from("stores")
          .select("id", { count: 'exact', head: true })
          .eq("vendedor_id", selectedStore.vendedor_id);
        
        storesCount = count || 1;
      }
      
      // Buscar curva do prospect associado (se houver CNPJ)
      if (selectedStore.cnpj) {
        const cnpjNumerico = selectedStore.cnpj.replace(/\D/g, '');
        const { data: prospect } = await supabase
          .from("prospects")
          .select("categoria")
          .eq("cnpj", cnpjNumerico)
          .maybeSingle();
        
        curva = prospect?.categoria || null;
      }
      
      // Fallback: buscar classificação comercial da loja
      if (!curva && selectedStore.classification) {
        curva = selectedStore.classification;
      }
      
      setSelectedStoreData({ storesCount, curva });
    };
    
    fetchClientData();
  }, [formData.store_id, stores]);

  // Atualizar filteredStores quando stores do hook mudar - com guard para evitar loop
  useEffect(() => {
    if (!storesLoading && stores.length > 0 && filteredStores.length === 0 && !storeSearch) {
      setFilteredStores(stores);
    }
  }, [stores, storesLoading]);

  useEffect(() => {
    let mounted = true;
    
    if (open && mounted) {
      fetchInitialData();
    }

    return () => {
      mounted = false;
    };
  }, [open]);

  const fetchInitialData = async () => {
    try {
      const [productsData, promotionsData, campaignsData] = await Promise.all([
        supabase.from("products").select("*").eq("active", true).eq("is_our_product", true),
        supabase.from("promotions").select("*").eq("status", "active"),
        supabase.from("trade_campaigns").select(`
          id, name, code, status, estimated_cost,
          trade_budgets!trade_campaigns_budget_id_fkey(id, name, total_amount, committed_amount, executed_amount)
        `).in("status", ["approved", "active"]).order("name"),
      ]);

      if (productsData.data) setProducts(productsData.data);
      if (promotionsData.data) setPromotions(promotionsData.data);
      if (campaignsData.data) setCampaigns(campaignsData.data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  // Upload evidence files
  const handleEvidenceUpload = async (files: FileList) => {
    if (!files.length) return;
    
    setUploadingEvidence(true);
    const newUrls: string[] = [];
    
    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file);
        const fileName = `evidence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
        const filePath = `expenses/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('campaign-evidence')
          .upload(filePath, compressed, { contentType: 'image/jpeg' });
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }
        
        const { data: signedData, error: signError } = await supabase.storage
          .from('campaign-evidence')
          .createSignedUrl(filePath, 31536000); // 1 ano
        
        if (!signError && signedData?.signedUrl) {
          newUrls.push(signedData.signedUrl);
        }
      }
      
      setFormData(prev => ({
        ...prev,
        evidence_files: [...prev.evidence_files, ...Array.from(files)],
        evidence_urls: [...prev.evidence_urls, ...newUrls],
      }));
      
      if (newUrls.length > 0) {
        toast.success(`${newUrls.length} evidência(s) carregada(s)`);
      }
    } catch (error) {
      console.error('Error uploading evidence:', error);
      toast.error('Erro ao carregar evidências');
    } finally {
      setUploadingEvidence(false);
    }
  };

  const removeEvidence = (index: number) => {
    setFormData(prev => ({
      ...prev,
      evidence_files: prev.evidence_files.filter((_, i) => i !== index),
      evidence_urls: prev.evidence_urls.filter((_, i) => i !== index),
    }));
  };

  const handleStoreSearch = (searchValue: string) => {
    setStoreSearch(searchValue);
    
    if (!searchValue.trim()) {
      setFilteredStores(stores);
      return;
    }

    const searchLower = searchValue.toLowerCase();
    const searchNumbers = searchValue.replace(/\D/g, '');
    
    const filtered = stores.filter((store) => {
      const nameMatch = store.name?.toLowerCase().includes(searchLower);
      const cnpjMatch = searchNumbers && store.cnpj?.replace(/\D/g, '').includes(searchNumbers);
      const cityMatch = store.city?.toLowerCase().includes(searchLower);
      const addressMatch = store.address?.toLowerCase().includes(searchLower);
      return nameMatch || cnpjMatch || cityMatch || addressMatch;
    });

    setFilteredStores(filtered);
  };

  const handlePhotoUpload = async (files: FileList | null, type: 'before' | 'after' = 'before') => {
    if (!files || files.length === 0) return;
    
    const newPhotos = Array.from(files);
    
    if (type === 'before') {
      setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }));
      toast.success(`${newPhotos.length} foto(s) adicionada(s). Análise será feita após salvar.`);
    } else {
      setFormData(prev => ({ ...prev, photos_after: [...prev.photos_after, ...newPhotos] }));
      toast.success("Fotos 'depois' adicionadas com sucesso!");
    }
  };

  // Removida análise síncrona - agora será feita em background após salvar

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar supervisor_id do perfil do usuário
      const { data: profile } = await supabase
        .from("profiles")
        .select("supervisor_id")
        .eq("id", user.id)
        .single();

      const supervisorId = profile?.supervisor_id || null;

      // 1. Create visit
      const visitCode = `V-${Date.now()}`;
      const { data: visit, error: visitError } = await supabase
        .from("visits")
        .insert({
          visit_code: visitCode,
          store_id: formData.store_id,
          user_id: user.id,
          scheduled_date: formData.visit_date,
          scheduled_time: formData.visit_time,
          visit_type: formData.visit_type,
          status: "completed",
          notes: formData.notes,
          check_in_time: new Date().toISOString(),
          check_out_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (visitError) throw visitError;
      
      // Salvar ID da visita para uso posterior
      setCompletedVisitId(visit.id);

      // 2. Upload photos and create records (ANTES) - Com compressão e análise assíncrona
      const beforePhotoPromises = formData.photos.map(async (photo, index) => {
        try {
          // Comprimir imagem antes do upload (otimização mobile)
          const compressedPhoto = await compressImage(photo, 1200, 0.8);
          
          const filePath = `${user.id}/${visit.id}/before-${Date.now()}-${index}.jpg`;
          
          // Usar helper para upload com retry
          const { path, error: uploadError } = await uploadFile('trade-photos', filePath, compressedPhoto);

          if (uploadError) {
            console.error('❌ Erro no upload:', uploadError);
            throw uploadError;
          }

          // Obter URL assinada (válida por 1 ano)
          const { data: { signedUrl }, error: urlError } = await supabase.storage
            .from('trade-photos')
            .createSignedUrl(path, 31536000); // 1 ano

          if (urlError) {
            console.error('❌ Erro ao gerar URL assinada:', urlError);
            throw urlError;
          }

          console.log('✅ Upload concluído:', path);

          // Salvar registro da foto com URL assinada
          const { data: photoRecord, error: photoError } = await supabase
            .from("photos")
            .insert({
              visit_id: visit.id,
              store_id: formData.store_id,
              photo_url: signedUrl,
              photo_type: "shelf",
              category: "before",
              ai_processed: false,
              vendedor_id: user.id,
              supervisor_id: supervisorId,
            })
            .select()
            .single();
          
          if (photoError) {
            console.error('❌ Erro ao salvar registro da foto:', photoError);
            throw photoError;
          }

          console.log('✅ Registro da foto salvo:', photoRecord.id);

          // Adicionar à fila de análise de IA
          const { error: queueError } = await supabase.from("photo_analysis_queue").insert({
            photo_id: photoRecord.id,
            photo_url: signedUrl,
            created_by: user.id,
            status: 'pending',
            attempts: 0,
          });
          
          if (queueError) {
            console.error('❌ Erro ao adicionar à fila:', queueError);
          } else {
            console.log('✅ Foto adicionada à fila de análise:', photoRecord.id);
          }
          
          return true;
        } catch (error) {
          console.error("❌ Erro ao processar foto:", error);
          return false;
        }
      });

      // 2b. Upload photos "DEPOIS" (opcional) - Com compressão
      const afterPhotoPromises = formData.photos_after.map(async (photo, index) => {
        try {
          const compressedPhoto = await compressImage(photo, 1200, 0.8);
          const filePath = `${user.id}/${visit.id}/after-${Date.now()}-${index}.jpg`;
          
          // Usar helper para upload com retry
          const { path, error: uploadError } = await uploadFile('trade-photos', filePath, compressedPhoto);

          if (uploadError) {
            console.error('❌ Erro no upload (after):', uploadError);
            throw uploadError;
          }
          
          // Obter URL assinada (válida por 1 ano)
          const { data: { signedUrl }, error: urlError } = await supabase.storage
            .from('trade-photos')
            .createSignedUrl(path, 31536000);

          if (urlError) {
            console.error('❌ Erro ao gerar URL assinada (after):', urlError);
            throw urlError;
          }

          console.log('✅ Upload concluído (after):', path);
          
          const { error: photoError } = await supabase.from("photos").insert({
            visit_id: visit.id,
            store_id: formData.store_id,
            photo_url: signedUrl,
            photo_type: "shelf",
            category: "after",
            ai_processed: false,
            vendedor_id: user.id,
            supervisor_id: supervisorId,
          });
          
          if (photoError) {
            console.error('❌ Erro ao salvar registro (after):', photoError);
            throw photoError;
          }
          
          return true;
        } catch (error) {
          console.error("❌ Erro ao processar foto (after):", error);
          return false;
        }
      });

      // Aguardar todos os uploads em paralelo
      const allPhotoPromises = [...beforePhotoPromises, ...afterPhotoPromises];
      
      if (allPhotoPromises.length > 0) {
        const results = await Promise.all(allPhotoPromises);
        const successCount = results.filter(r => r === true).length;
        
        if (successCount > 0) {
          toast.success(`${successCount} foto(s) salva(s). Análise em andamento...`);
        }
        if (successCount < results.length) {
          toast.warning(`${results.length - successCount} foto(s) falharam no upload`);
        }
      }

      // 3. Create shelf share records - Paralelo
      if (formData.products_found.length > 0) {
        const shelfSharePromises = formData.products_found.map((productId) =>
          supabase.from("shelf_share").insert({
            visit_id: visit.id,
            store_id: formData.store_id,
            product_id: productId,
            quantity_facings: formData.our_facings,
            in_stock: true,
          })
        );
        await Promise.all(shelfSharePromises);
      }

      // 4. Create promotion execution record
      if (formData.promotion_id && formData.promotion_active) {
        await supabase.from("promotion_execution").insert({
          visit_id: visit.id,
          store_id: formData.store_id,
          promotion_id: formData.promotion_id,
          is_active: formData.promotion_active,
          materials_present: formData.materials_present,
        });
      }

      // 5. Create campaign expense record - Status pending para aprovação
      if (formData.campaign_id && formData.expense_amount > 0) {
        const { error: expenseError } = await supabase.from("trade_campaign_expenses").insert({
          campaign_id: formData.campaign_id,
          category: 'gasto_realizado',
          description: formData.expense_description || 'Gasto registrado via lançamento rápido',
          valor_realizado: formData.expense_amount,
          expense_date: formData.visit_date,
          evidencias: formData.evidence_urls,
          comprovante_url: formData.evidence_urls[0] || null,
          status: 'pending', // Enviado para aprovação
          created_by: user.id,
          notes: `Visita: ${visitCode} | Loja: ${stores.find(s => s.id === formData.store_id)?.name || 'N/A'}`,
        });
        
        if (expenseError) {
          console.error('Erro ao criar despesa:', expenseError);
          toast.error('Erro ao registrar gasto da campanha');
        } else {
          toast.info('Gasto enviado para aprovação');
        }
      }

      // 5. Create AI insights from analysis
      if (formData.ai_insights) {
        const insightsToCreate = [];

        // Create general insight from AI analysis
        insightsToCreate.push({
          title: "Análise de Gôndola - " + new Date().toLocaleDateString("pt-BR"),
          description: formData.ai_insights,
          insight_type: "recommendation",
          category: "shelf_analysis",
          entity_type: "visit",
          entity_id: visit.id,
          priority: formData.issues_found.length > 0 ? "alta" : "media",
          impact_level: formData.issues_found.length > 0 ? "high" : "medium",
          status: "new",
        });

        // Create specific insights for issues found
        if (formData.issues_found.length > 0) {
          formData.issues_found.forEach((issue: string) => {
            insightsToCreate.push({
              title: "Problema Detectado: " + issue.substring(0, 50),
              description: issue,
              insight_type: "risk",
              category: "quality_issue",
              entity_type: "visit",
              entity_id: visit.id,
              priority: "alta",
              impact_level: "high",
              status: "new",
            });
          });
        }

        // Create opportunity insight if good facings ratio
        const totalFacings = formData.our_facings + formData.competitor_facings;
        if (totalFacings > 0) {
          const ourShare = (formData.our_facings / totalFacings) * 100;
          if (ourShare < 50) {
            insightsToCreate.push({
              title: "Oportunidade de Crescimento de Share",
              description: `Nosso share de gôndola é ${ourShare.toFixed(1)}%. Há oportunidade para aumentar presença.`,
              insight_type: "opportunity",
              category: "shelf_share",
              entity_type: "visit",
              entity_id: visit.id,
              priority: "media",
              impact_level: "medium",
              status: "new",
              confidence_score: 85,
            });
          } else if (ourShare >= 70) {
            insightsToCreate.push({
              title: "Excelente Presença de Marca",
              description: `Nosso share de gôndola é ${ourShare.toFixed(1)}%. Ótima performance!`,
              insight_type: "trend",
              category: "shelf_share",
              entity_type: "visit",
              entity_id: visit.id,
              priority: "baixa",
              impact_level: "low",
              status: "new",
              confidence_score: 95,
            });
          }
        }

        if (insightsToCreate.length > 0) {
          await supabase.from("ai_insights").insert(insightsToCreate);
        }
      }

      // 6. Salvar medições de prateleira se preenchidas
      if (formData.shelf_width > 0) {
        // Calcular totais das nossas marcas
        const totalOurBrandsCm = brandMeasurements.reduce((sum, m) => {
          const width = parseFloat(m.width_cm) || 0;
          const shelves = parseInt(m.shelf_count) || 0;
          return sum + (width * shelves);
        }, 0);
        
        const totalShelfArea = formData.shelf_width * formData.shelf_count;
        const shelfSharePct = totalShelfArea > 0 ? (totalOurBrandsCm / totalShelfArea) * 100 : 0;

        const { data: measurementRecord, error: measurementError } = await supabase
          .from("shelf_measurements")
          .insert({
            store_id: formData.store_id,
            visit_id: visit.id,
            measurement_date: formData.visit_date,
            total_shelf_width_cm: formData.shelf_width,
            total_shelf_height_cm: formData.shelf_height || null,
            shelf_count: formData.shelf_count,
            our_brands_width_cm: totalOurBrandsCm,
            our_brands_facings: formData.our_facings,
            competitors_facings: formData.competitor_facings,
            total_facings: formData.our_facings + formData.competitor_facings,
            shelf_share_percentage: shelfSharePct,
            vendedor_id: user.id,
            supervisor_id: supervisorId,
            created_by: user.id,
          })
          .select()
          .single();

        if (measurementError) {
          console.error('Erro ao salvar medição:', measurementError);
        } else if (measurementRecord && brandMeasurements.length > 0) {
          // Salvar medições por marca
          const brandMeasurementsToInsert = brandMeasurements
            .filter(m => parseFloat(m.width_cm) > 0)
            .map(m => ({
              measurement_id: measurementRecord.id,
              brand_id: m.brand_id,
              width_cm: parseFloat(m.width_cm) || 0,
              shelf_count: parseInt(m.shelf_count) || 1,
              total_cm: (parseFloat(m.width_cm) || 0) * (parseInt(m.shelf_count) || 1),
            }));

          if (brandMeasurementsToInsert.length > 0) {
            const { error: brandError } = await supabase
              .from("shelf_measurement_brands")
              .insert(brandMeasurementsToInsert);

            if (brandError) {
              console.error('Erro ao salvar medições por marca:', brandError);
            }
          }
        }
      }

      toast.success("✅ Lançamento concluído com sucesso!");
      
      // Mostrar opções de ações pós-lançamento
      setShowSuccessActions(true);
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro no lançamento:", error);
      toast.error("Erro ao salvar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setStoreSearch("");
    setFilteredStores(stores);
    setCompletedVisitId(null);
    setShowSuccessActions(false);
    setFormData({
      store_id: "",
      visit_date: new Date().toISOString().split('T')[0],
      visit_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      visit_type: "routine",
      photos: [],
      photos_after: [],
      ai_insights: "",
      products_found: [],
      our_facings: 0,
      competitor_facings: 0,
      shelf_width: 0,
      shelf_height: 0,
      shelf_depth: 0,
      shelf_count: 1,
      promotion_id: "",
      promotion_active: false,
      materials_present: [],
      campaign_id: "",
      expense_amount: 0,
      expense_description: "",
      evidence_files: [],
      evidence_urls: [],
      notes: "",
      issues_found: [],
    });
    setBrandMeasurements([]);
  };
  
  const handleGoToAudit = () => {
    if (completedVisitId) {
      onOpenChange(false);
      resetForm();
      navigate(`/dashboard/trade/auditorias?visitId=${completedVisitId}`);
    }
  };
  
  const handleGoToShelfMeasurements = () => {
    if (completedVisitId) {
      onOpenChange(false);
      resetForm();
      navigate(`/dashboard/trade/shelf-measurements`);
    }
  };
  
  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const progress = (currentStep / 4) * 100;
  
  // Se concluído com sucesso, mostrar opções
  if (showSuccessActions) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Lançamento Concluído!
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Seu lançamento foi salvo com sucesso. O que deseja fazer agora?
            </p>
            
            <div className="space-y-2">
              <Button 
                className="w-full" 
                onClick={handleGoToAudit}
                variant="default"
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Ir para Auditoria
              </Button>
              
              {hasPermission("trade_shelf_measurements") && (
                <Button 
                  className="w-full" 
                  onClick={handleGoToShelfMeasurements}
                  variant="default"
                >
                  <Ruler className="mr-2 h-4 w-4" />
                  Medir Prateleira
                </Button>
              )}
              
              <Button 
                className="w-full" 
                onClick={() => {
                  setShowSuccessActions(false);
                  setCurrentStep(1);
                }}
                variant="outline"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Fazer Outro Lançamento
              </Button>
              
              <Button 
                className="w-full" 
                onClick={handleClose}
                variant="ghost"
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-tour="quick-entry-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Lançamento Rápido Inteligente
            </div>
          </DialogTitle>
          <div className="space-y-2" data-tour="quick-entry-progress">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Passo {currentStep} de 4 - {progress.toFixed(0)}% concluído
            </p>
          </div>
        </DialogHeader>

        <Tabs value={`step${currentStep}`} className="w-full">
          <TabsList className="grid w-full grid-cols-4" data-tour="quick-entry-tabs">
            <TabsTrigger value="step1" disabled={currentStep !== 1}>
              <Store className="h-4 w-4 mr-2" />
              PDV
            </TabsTrigger>
            <TabsTrigger value="step2" disabled={currentStep !== 2}>
              <Camera className="h-4 w-4 mr-2" />
              Fotos + IA
            </TabsTrigger>
            <TabsTrigger value="step3" disabled={currentStep !== 3}>
              <Tag className="h-4 w-4 mr-2" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="step4" disabled={currentStep !== 4}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Revisão
            </TabsTrigger>
          </TabsList>

          {/* Step 1: Selecionar PDV */}
          <TabsContent value="step1" className="space-y-4" data-tour="quick-entry-step1">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Visita</CardTitle>
                <CardDescription>Selecione o PDV e detalhes da visita</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2" data-tour="quick-entry-store-search">
                    <Label>Buscar PDV / Loja por Nome ou CNPJ</Label>
                    <Input
                      placeholder="Digite o nome da loja, cidade ou CNPJ..."
                      value={storeSearch}
                      onChange={(e) => handleStoreSearch(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label>PDV / Loja *</Label>
                    <Select value={formData.store_id} onValueChange={(value) => setFormData(prev => ({ ...prev, store_id: value }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o PDV" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] bg-background z-50">
                        {filteredStores.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">
                            {storeSearch ? "Nenhuma loja encontrada com esse critério" : "Nenhuma loja encontrada"}
                          </div>
                        ) : (
                          filteredStores.map((store) => (
                            <SelectItem 
                              key={store.id} 
                              value={store.id}
                              className="cursor-pointer"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{store.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {store.city} {store.cnpj && `• CNPJ: ${store.cnpj}`}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Exibir dados do cliente selecionado */}
                  {formData.store_id && selectedStoreData && (
                    <div className="col-span-2 flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Lojas:</span>
                        <Badge variant="secondary" className="font-semibold">
                          {selectedStoreData.storesCount}
                        </Badge>
                      </div>
                      {selectedStoreData.curva && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Curva:</span>
                          <Badge 
                            variant="outline"
                            className={
                              selectedStoreData.curva === 'A' || selectedStoreData.curva === 'A+' 
                                ? 'border-blue-500 text-blue-700 bg-blue-50' 
                                : selectedStoreData.curva === 'B' 
                                  ? 'border-green-500 text-green-700 bg-green-50'
                                  : selectedStoreData.curva === 'C'
                                    ? 'border-yellow-500 text-yellow-700 bg-yellow-50'
                                    : 'border-orange-500 text-orange-700 bg-orange-50'
                            }
                          >
                            {selectedStoreData.curva}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Tipo de Visita</Label>
                    <Select value={formData.visit_type} onValueChange={(value) => setFormData(prev => ({ ...prev, visit_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine">Rotina</SelectItem>
                        <SelectItem value="audit">Auditoria</SelectItem>
                        <SelectItem value="promotion">Promoção</SelectItem>
                        <SelectItem value="merchandising">Merchandising</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data da Visita</Label>
                    <Input
                      type="date"
                      value={formData.visit_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, visit_date: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Hora</Label>
                    <Input
                      type="time"
                      value={formData.visit_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, visit_time: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => setCurrentStep(2)} disabled={!formData.store_id}>
                Próximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Step 2: Upload de Fotos + IA */}
          <TabsContent value="step2" className="space-y-4" data-tour="quick-entry-step2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Análise Inteligente com IA
                </CardTitle>
                <CardDescription>
                  Tire fotos do PDV e deixe a IA analisar automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Fotos ANTES */}
                <div className="space-y-3" data-tour="quick-entry-photos-before">
                  <Label className="text-base font-semibold">Fotos ANTES *</Label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e.target.files, 'before')}
                      className="hidden"
                      id="photo-upload-before"
                    />
                    <label htmlFor="photo-upload-before" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-2">
                        <ImagePlus className="h-12 w-12 text-muted-foreground" />
                        <p className="text-sm font-medium">Clique para adicionar fotos (ANTES)</p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG ou WEBP (máx. 10 fotos)
                        </p>
                      </div>
                    </label>
                  </div>

                   {formData.photos.length > 0 && (
                    <div className="space-y-2">
                      <Label>Fotos ANTES Adicionadas ({formData.photos.length})</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {formData.photos.map((photo, index) => (
                          <div key={index} className="relative aspect-square rounded-lg overflow-hidden border group">
                            <img
                              src={URL.createObjectURL(photo)}
                              alt={`Foto antes ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  photos: prev.photos.filter((_, i) => i !== index)
                                }));
                                toast.success("Foto removida");
                              }}
                              aria-label="Remover foto"
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {analyzing && (
                  <div className="flex items-center justify-center gap-2 p-4 bg-primary/10 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="text-sm font-medium">Analisando fotos com IA...</p>
                  </div>
                )}

                {/* Fotos DEPOIS (Opcional) */}
                <div className="space-y-3" data-tour="quick-entry-photos-after">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">Fotos DEPOIS</Label>
                    <Badge variant="secondary">Opcional</Badge>
                  </div>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/30">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e.target.files, 'after')}
                      className="hidden"
                      id="photo-upload-after"
                    />
                    <label htmlFor="photo-upload-after" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-2">
                        <ImagePlus className="h-12 w-12 text-muted-foreground" />
                        <p className="text-sm font-medium">Clique para adicionar fotos (DEPOIS)</p>
                        <p className="text-xs text-muted-foreground">
                          Para comparação com as fotos "antes"
                        </p>
                      </div>
                    </label>
                  </div>

                  {formData.photos_after.length > 0 && (
                    <div className="space-y-2">
                      <Label>Fotos DEPOIS Adicionadas ({formData.photos_after.length})</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {formData.photos_after.map((photo, index) => (
                          <div key={index} className="relative aspect-square rounded-lg overflow-hidden border group">
                            <img
                              src={URL.createObjectURL(photo)}
                              alt={`Foto depois ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  photos_after: prev.photos_after.filter((_, i) => i !== index)
                                }));
                                toast.success("Foto removida");
                              }}
                              aria-label="Remover foto"
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {formData.ai_insights && (
                  <Card className="bg-primary/5">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Insights da IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{formData.ai_insights}</p>
                      {formData.issues_found.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-semibold">Problemas Detectados:</p>
                          {formData.issues_found.map((issue, i) => (
                            <Badge key={i} variant="destructive" className="mr-2">
                              {issue}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Voltar
              </Button>
              <Button onClick={() => setCurrentStep(3)}>
                Próximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Step 3: Dados de Shelf Share e Promoção */}
          <TabsContent value="step3" className="space-y-4" data-tour="quick-entry-step3">
            <div className="grid gap-4">
              <Card data-tour="quick-entry-shelf-share">
                <CardHeader>
                  <CardTitle>Share de Gôndola</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Faces Nossas</Label>
                      <Input
                        type="number"
                        value={formData.our_facings}
                        onChange={(e) => setFormData(prev => ({ ...prev, our_facings: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Faces Concorrentes</Label>
                      <Input
                        type="number"
                        value={formData.competitor_facings}
                        onChange={(e) => setFormData(prev => ({ ...prev, competitor_facings: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-tour="quick-entry-shelf-measures">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    Medições de Prateleira
                  </CardTitle>
                  <CardDescription>Dimensões do espaço ocupado em cm</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Largura (cm)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={formData.shelf_width || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, shelf_width: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Prateleiras</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        value={formData.shelf_count || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, shelf_count: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Altura (cm)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={formData.shelf_height || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, shelf_height: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Profundidade (cm)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={formData.shelf_depth || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, shelf_depth: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  
                  {formData.shelf_width > 0 && formData.shelf_count > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <Badge variant="secondary">
                        Área total: {(formData.shelf_width * formData.shelf_count).toFixed(0)} cm
                      </Badge>
                    </div>
                  )}

                  {/* Medidas por Marca - Sempre visível */}
                  <BrandMeasurementSection
                    brandMeasurements={brandMeasurements}
                    onBrandMeasurementsChange={setBrandMeasurements}
                    totalShelfWidthCm={formData.shelf_width.toString()}
                    totalShelfCount={formData.shelf_count.toString()}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Promoção Ativa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selecione a Promoção</Label>
                    <Select value={formData.promotion_id} onValueChange={(value) => setFormData(prev => ({ ...prev, promotion_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhuma promoção" />
                      </SelectTrigger>
                      <SelectContent>
                        {promotions.map((promo) => (
                          <SelectItem key={promo.id} value={promo.id}>
                            {promo.name} - {promo.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Campanha e Gasto */}
              <Card data-tour="quick-entry-campaign">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Campanha e Gasto Realizado
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    O gasto será enviado para aprovação antes de debitar da verba
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selecione a Campanha</Label>
                    <Select value={formData.campaign_id} onValueChange={(value) => setFormData(prev => ({ ...prev, campaign_id: value, expense_amount: 0, expense_description: "", evidence_urls: [], evidence_files: [] }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhuma campanha" />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map((camp) => {
                          const budget = camp.trade_budgets;
                          const available = budget ? (budget.total_amount - (budget.committed_amount || 0) - (budget.executed_amount || 0)) : 0;
                          return (
                            <SelectItem key={camp.id} value={camp.id}>
                              <div className="flex flex-col">
                                <span>{camp.name} - {camp.code}</span>
                                {budget && (
                                  <span className="text-xs text-muted-foreground">
                                    Verba disponível: R$ {available.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Mostrar info da verba quando campanha selecionada */}
                  {formData.campaign_id && (() => {
                    const selectedCamp = campaigns.find(c => c.id === formData.campaign_id);
                    const budget = selectedCamp?.trade_budgets;
                    if (!budget) return null;
                    const available = budget.total_amount - (budget.committed_amount || 0) - (budget.executed_amount || 0);
                    const isOverBudget = formData.expense_amount > available;
                    return (
                      <div className={`p-3 rounded-lg border ${isOverBudget ? 'bg-destructive/10 border-destructive' : 'bg-muted/50'}`}>
                        <div className="flex justify-between text-sm">
                          <span>Verba: {budget.name}</span>
                          <span className={`font-medium ${isOverBudget ? 'text-destructive' : 'text-primary'}`}>
                            Disponível: R$ {available.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {isOverBudget && (
                          <p className="text-xs text-destructive mt-1">
                            ⚠️ Valor excede a verba disponível - será analisado na aprovação
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {formData.campaign_id && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Valor do Gasto (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={formData.expense_amount || ""}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              expense_amount: parseFloat(e.target.value) || 0 
                            }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição do Gasto</Label>
                          <Input
                            placeholder="Ex: Material promocional"
                            value={formData.expense_description}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              expense_description: e.target.value 
                            }))}
                          />
                        </div>
                      </div>

                      {/* Upload de Evidências */}
                      <div className="space-y-2" data-tour="quick-entry-evidence">
                        <Label className="flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          Evidências (Fotos/Comprovantes)
                        </Label>
                        <div className="border-2 border-dashed rounded-lg p-4 text-center">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            id="evidence-upload"
                            onChange={(e) => e.target.files && handleEvidenceUpload(e.target.files)}
                            disabled={uploadingEvidence}
                          />
                          <label 
                            htmlFor="evidence-upload" 
                            className="cursor-pointer flex flex-col items-center gap-2"
                          >
                            {uploadingEvidence ? (
                              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            ) : (
                              <ImagePlus className="h-8 w-8 text-muted-foreground" />
                            )}
                            <span className="text-sm text-muted-foreground">
                              {uploadingEvidence ? 'Carregando...' : 'Clique para adicionar evidências'}
                            </span>
                          </label>
                        </div>

                        {/* Preview das evidências */}
                        {formData.evidence_urls.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {formData.evidence_urls.map((url, index) => (
                              <div key={index} className="relative group">
                                <img 
                                  src={url} 
                                  alt={`Evidência ${index + 1}`}
                                  className="w-full h-20 object-cover rounded-md border"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeEvidence(index)}
                                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <span className="sr-only">Remover</span>
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Voltar
              </Button>
              <Button onClick={() => setCurrentStep(4)}>
                Próximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Step 4: Revisão e Observações */}
          <TabsContent value="step4" className="space-y-4" data-tour="quick-entry-step4">
            <Card>
              <CardHeader>
                <CardTitle>Observações Finais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Observações da Visita</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Adicione observações gerais sobre a visita..."
                    rows={4}
                  />
                </div>

                <Card className="bg-muted/50" data-tour="quick-entry-summary">
                  <CardHeader>
                    <CardTitle className="text-sm">Resumo do Lançamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>PDV:</span>
                      <span className="font-medium">
                        {stores.find(s => s.id === formData.store_id)?.name || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fotos:</span>
                      <span className="font-medium">{formData.photos.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Faces (Nossas/Concorrentes):</span>
                      <span className="font-medium">
                        {formData.our_facings} / {formData.competitor_facings}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Promoção:</span>
                      <span className="font-medium">
                        {formData.promotion_id ? "Sim" : "Não"}
                      </span>
                    </div>
                    {formData.campaign_id && (
                      <>
                        <div className="flex justify-between border-t pt-2 mt-2">
                          <span>Campanha:</span>
                          <span className="font-medium">
                            {campaigns.find(c => c.id === formData.campaign_id)?.name || "-"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Gasto Realizado:</span>
                          <span className="font-medium text-primary">
                            R$ {formData.expense_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Evidências:</span>
                          <span className="font-medium">{formData.evidence_urls.length} arquivo(s)</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={loading} data-tour="quick-entry-submit">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Concluir Lançamento
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
