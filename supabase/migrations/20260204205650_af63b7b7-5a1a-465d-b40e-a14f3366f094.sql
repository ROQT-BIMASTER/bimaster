-- Add shelf_count column to shelf_measurements
ALTER TABLE public.shelf_measurements 
ADD COLUMN IF NOT EXISTS shelf_count integer DEFAULT 1;

-- Create shelf_measurement_brands table for per-brand details
CREATE TABLE public.shelf_measurement_brands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  measurement_id uuid NOT NULL REFERENCES public.shelf_measurements(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.our_brands(id) ON DELETE CASCADE,
  width_cm numeric(10,2) NOT NULL DEFAULT 0,
  shelf_count integer NOT NULL DEFAULT 1,
  total_cm numeric(10,2) GENERATED ALWAYS AS (width_cm * shelf_count) STORED,
  facings integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_measurement_brand UNIQUE(measurement_id, brand_id)
);

-- Create indexes for performance
CREATE INDEX idx_shelf_measurement_brands_measurement ON public.shelf_measurement_brands(measurement_id);
CREATE INDEX idx_shelf_measurement_brands_brand ON public.shelf_measurement_brands(brand_id);

-- Enable RLS
ALTER TABLE public.shelf_measurement_brands ENABLE ROW LEVEL SECURITY;

-- RLS Policies - inherit from parent measurement access
CREATE POLICY "Users can view shelf measurement brands"
ON public.shelf_measurement_brands
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shelf_measurements sm
    WHERE sm.id = measurement_id
  )
);

CREATE POLICY "Users can insert shelf measurement brands"
ON public.shelf_measurement_brands
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shelf_measurements sm
    WHERE sm.id = measurement_id
  )
);

CREATE POLICY "Users can update shelf measurement brands"
ON public.shelf_measurement_brands
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.shelf_measurements sm
    WHERE sm.id = measurement_id
  )
);

CREATE POLICY "Users can delete shelf measurement brands"
ON public.shelf_measurement_brands
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.shelf_measurements sm
    WHERE sm.id = measurement_id
  )
);

-- Add comment for documentation
COMMENT ON TABLE public.shelf_measurement_brands IS 'Detalhamento de medições de prateleira por marca';
COMMENT ON COLUMN public.shelf_measurement_brands.total_cm IS 'Calculado automaticamente: width_cm × shelf_count';