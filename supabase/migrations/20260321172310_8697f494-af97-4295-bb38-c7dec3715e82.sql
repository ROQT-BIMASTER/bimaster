
-- FIX 3: Remove anonymous read access from ai_training_examples
-- Drop both broken policies and create a proper one
DROP POLICY IF EXISTS "Anyone can read training examples" ON public.ai_training_examples;
DROP POLICY IF EXISTS "ai_training_block_authenticated" ON public.ai_training_examples;

CREATE POLICY "Authenticated users can read training examples"
ON public.ai_training_examples
FOR SELECT TO authenticated
USING (true);
