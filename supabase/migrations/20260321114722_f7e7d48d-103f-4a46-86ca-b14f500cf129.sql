-- Admin policies for managing dimensional tables

-- dim_vendedor: admin can update user_id
CREATE POLICY "admin_manage_dim_vendedor" ON public.dim_vendedor
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- dim_supervisor: admin can update user_id
CREATE POLICY "admin_manage_dim_supervisor" ON public.dim_supervisor
FOR ALL USING (public.has_role(auth.uid(), 'admin'));