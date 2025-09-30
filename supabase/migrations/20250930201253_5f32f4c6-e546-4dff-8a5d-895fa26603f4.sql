-- Atualizar planos com IDs do Stripe
UPDATE public.planos 
SET stripe_product_id = 'prod_T9Sp88hCsJeJAs', 
    stripe_price_id = 'price_1SD9tXD4p7xd2vlirMsCmLCP'
WHERE nome = 'Premium';

UPDATE public.planos 
SET stripe_product_id = 'prod_T9SpkMBxi4MToV', 
    stripe_price_id = 'price_1SD9u3D4p7xd2vli9ZdW7ONi'
WHERE nome = 'Enterprise';