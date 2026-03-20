
-- Enable realtime for AP tables (contas_pagar already added)
ALTER PUBLICATION supabase_realtime ADD TABLE fornecedores;
ALTER PUBLICATION supabase_realtime ADD TABLE parcelas;
ALTER PUBLICATION supabase_realtime ADD TABLE pagamentos;
