import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, subDays } from "date-fns";

interface BrandShareData {
  brandName: string;
  totalCm: number;
  percentage: number;
  color: string;
}

interface MonthlyEvolution {
  month: string;
  [brandName: string]: string | number;
}

interface StoreRanking {
  storeId: string;
  storeName: string;
  storeCode: string;
  totalShare: number;
  measurementCount: number;
  brandShares: { [brandName: string]: number };
}

const BRAND_COLORS: Record<string, string> = {
  "Melu": "hsl(var(--primary))",
  "Ruby Rose": "hsl(340, 75%, 55%)",
  "Luluca": "hsl(280, 70%, 60%)",
  "Nathalia Beauty": "hsl(45, 85%, 55%)",
};

export function useBrandShareDashboard(startDate?: Date, endDate?: Date) {
  const start = startDate ? format(startDate, "yyyy-MM-dd") : format(subMonths(new Date(), 6), "yyyy-MM-dd");
  const end = endDate ? format(endDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

  // Fetch all brand measurements with related data
  const { data: brandMeasurements, isLoading: loadingMeasurements, refetch } = useQuery({
    queryKey: ["brand-share-dashboard", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shelf_measurement_brands")
        .select(`
          id,
          brand_id,
          width_cm,
          shelf_count,
          total_cm,
          created_at,
          measurement_id,
          our_brands (id, brand_name),
          shelf_measurements (
            id,
            store_id,
            measurement_date,
            total_shelf_width_cm,
            shelf_count,
            stores (id, name, code)
          )
        `)
        .gte("created_at", start)
        .lte("created_at", end + "T23:59:59");

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate KPIs
  const kpis = (() => {
    if (!brandMeasurements || brandMeasurements.length === 0) {
      return {
        totalMeasurements: 0,
        avgShare: 0,
        leadingBrand: "N/A",
        growth: 0,
      };
    }

    // Get unique measurement IDs
    const uniqueMeasurements = new Set(brandMeasurements.map(m => m.measurement_id));
    const totalMeasurements = uniqueMeasurements.size;

    // Calculate total cm by brand
    const brandTotals: Record<string, number> = {};
    let grandTotal = 0;

    brandMeasurements.forEach((m) => {
      const brandName = m.our_brands?.brand_name || "Outros";
      const totalCm = m.total_cm || 0;
      brandTotals[brandName] = (brandTotals[brandName] || 0) + totalCm;
      grandTotal += totalCm;
    });

    // Find leading brand
    let leadingBrand = "N/A";
    let maxCm = 0;
    Object.entries(brandTotals).forEach(([brand, cm]) => {
      if (cm > maxCm) {
        maxCm = cm;
        leadingBrand = brand;
      }
    });

    // Calculate average share (using shelf_measurements data)
    const measurementShares: number[] = [];
    const measurementMap = new Map<string, { ourBrandsCm: number; totalCm: number }>();

    brandMeasurements.forEach((m) => {
      const measurementId = m.measurement_id;
      if (!measurementId) return;

      const shelfMeasurement = m.shelf_measurements;
      if (!shelfMeasurement) return;

      const totalShelfCm = (shelfMeasurement.total_shelf_width_cm || 0) * (shelfMeasurement.shelf_count || 1);
      
      if (!measurementMap.has(measurementId)) {
        measurementMap.set(measurementId, { ourBrandsCm: 0, totalCm: totalShelfCm });
      }
      
      const current = measurementMap.get(measurementId)!;
      current.ourBrandsCm += (m.total_cm || 0);
    });

    measurementMap.forEach((data) => {
      if (data.totalCm > 0) {
        measurementShares.push((data.ourBrandsCm / data.totalCm) * 100);
      }
    });

    const avgShare = measurementShares.length > 0
      ? measurementShares.reduce((a, b) => a + b, 0) / measurementShares.length
      : 0;

    return {
      totalMeasurements,
      avgShare,
      leadingBrand,
      growth: 0, // Would need historical data comparison
    };
  })();

  // Calculate brand distribution for pie chart
  const brandDistribution: BrandShareData[] = (() => {
    if (!brandMeasurements || brandMeasurements.length === 0) return [];

    const brandTotals: Record<string, number> = {};
    let grandTotal = 0;

    brandMeasurements.forEach((m) => {
      const brandName = m.our_brands?.brand_name || "Outros";
      const totalCm = m.total_cm || 0;
      brandTotals[brandName] = (brandTotals[brandName] || 0) + totalCm;
      grandTotal += totalCm;
    });

    return Object.entries(brandTotals)
      .map(([brandName, totalCm]) => ({
        brandName,
        totalCm,
        percentage: grandTotal > 0 ? (totalCm / grandTotal) * 100 : 0,
        color: BRAND_COLORS[brandName] || "hsl(var(--muted))",
      }))
      .sort((a, b) => b.totalCm - a.totalCm);
  })();

  // Calculate monthly evolution
  const monthlyEvolution: MonthlyEvolution[] = (() => {
    if (!brandMeasurements || brandMeasurements.length === 0) return [];

    const monthlyData: Record<string, Record<string, number>> = {};
    const allBrands = new Set<string>();

    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, "yyyy-MM");
      monthlyData[monthKey] = {};
    }

    brandMeasurements.forEach((m) => {
      const date = m.shelf_measurements?.measurement_date || m.created_at;
      if (!date) return;

      const monthKey = format(new Date(date), "yyyy-MM");
      const brandName = m.our_brands?.brand_name || "Outros";
      
      allBrands.add(brandName);

      if (monthlyData[monthKey]) {
        monthlyData[monthKey][brandName] = (monthlyData[monthKey][brandName] || 0) + (m.total_cm || 0);
      }
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, brands]) => {
        const result: MonthlyEvolution = { 
          month: format(new Date(month + "-01"), "MMM") 
        };
        allBrands.forEach((brand) => {
          result[brand] = brands[brand] || 0;
        });
        return result;
      });
  })();

  // Get unique brand names for the chart
  const brandNames = [...new Set(brandMeasurements?.map(m => m.our_brands?.brand_name).filter(Boolean) || [])];

  // Calculate store ranking
  const storeRanking: StoreRanking[] = (() => {
    if (!brandMeasurements || brandMeasurements.length === 0) return [];

    const storeData: Record<string, {
      storeName: string;
      storeCode: string;
      measurements: Set<string>;
      brandTotals: Record<string, number>;
      totalOurBrands: number;
      totalShelf: number;
    }> = {};

    brandMeasurements.forEach((m) => {
      const store = m.shelf_measurements?.stores;
      const storeId = m.shelf_measurements?.store_id;
      if (!store || !storeId) return;

      if (!storeData[storeId]) {
        storeData[storeId] = {
          storeName: store.name,
          storeCode: store.code,
          measurements: new Set(),
          brandTotals: {},
          totalOurBrands: 0,
          totalShelf: 0,
        };
      }

      const data = storeData[storeId];
      const measurementId = m.measurement_id;
      const brandName = m.our_brands?.brand_name || "Outros";

      data.brandTotals[brandName] = (data.brandTotals[brandName] || 0) + (m.total_cm || 0);
      data.totalOurBrands += (m.total_cm || 0);

      if (measurementId && !data.measurements.has(measurementId)) {
        data.measurements.add(measurementId);
        const shelfMeasurement = m.shelf_measurements;
        if (shelfMeasurement) {
          data.totalShelf += (shelfMeasurement.total_shelf_width_cm || 0) * (shelfMeasurement.shelf_count || 1);
        }
      }
    });

    return Object.entries(storeData)
      .map(([storeId, data]) => ({
        storeId,
        storeName: data.storeName,
        storeCode: data.storeCode,
        totalShare: data.totalShelf > 0 ? (data.totalOurBrands / data.totalShelf) * 100 : 0,
        measurementCount: data.measurements.size,
        brandShares: Object.fromEntries(
          Object.entries(data.brandTotals).map(([brand, cm]) => [
            brand,
            data.totalShelf > 0 ? (cm / data.totalShelf) * 100 : 0
          ])
        ),
      }))
      .sort((a, b) => b.totalShare - a.totalShare)
      .slice(0, 10);
  })();

  return {
    kpis,
    brandDistribution,
    monthlyEvolution,
    brandNames,
    storeRanking,
    isLoading: loadingMeasurements,
    refetch,
    brandColors: BRAND_COLORS,
  };
}
