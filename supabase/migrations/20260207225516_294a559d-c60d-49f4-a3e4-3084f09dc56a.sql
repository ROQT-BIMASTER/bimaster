
-- Create financial payment policies table
CREATE TABLE public.financial_payment_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cutoff_day_of_week INTEGER NOT NULL CHECK (cutoff_day_of_week BETWEEN 0 AND 6),
  cutoff_time TIME NOT NULL DEFAULT '18:00',
  payment_day_of_week INTEGER NOT NULL CHECK (payment_day_of_week BETWEEN 0 AND 6),
  allows_exceptions BOOLEAN NOT NULL DEFAULT false,
  exception_requires_approval BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_payment_policies ENABLE ROW LEVEL SECURITY;

-- Everyone can read active policies (they need to see the rules)
CREATE POLICY "Everyone can view active policies"
ON public.financial_payment_policies
FOR SELECT
USING (true);

-- Only admins/supervisors can manage policies
CREATE POLICY "Admins can insert policies"
ON public.financial_payment_policies
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor')
  )
);

CREATE POLICY "Admins can update policies"
ON public.financial_payment_policies
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor')
  )
);

CREATE POLICY "Admins can delete policies"
ON public.financial_payment_policies
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor')
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_financial_payment_policies_updated_at
BEFORE UPDATE ON public.financial_payment_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
