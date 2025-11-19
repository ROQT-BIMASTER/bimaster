-- Políticas RLS para fabrica_notas_fiscais
CREATE POLICY "Usuários autenticados podem ver notas fiscais"
  ON fabrica_notas_fiscais FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir notas fiscais"
  ON fabrica_notas_fiscais FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar notas fiscais"
  ON fabrica_notas_fiscais FOR UPDATE
  TO authenticated
  USING (true);

-- Políticas RLS para fabrica_itens_nf
CREATE POLICY "Usuários autenticados podem ver itens de NF"
  ON fabrica_itens_nf FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir itens de NF"
  ON fabrica_itens_nf FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar itens de NF"
  ON fabrica_itens_nf FOR UPDATE
  TO authenticated
  USING (true);

-- Políticas RLS para fabrica_processamento_logs
CREATE POLICY "Usuários autenticados podem ver logs"
  ON fabrica_processamento_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir logs"
  ON fabrica_processamento_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);