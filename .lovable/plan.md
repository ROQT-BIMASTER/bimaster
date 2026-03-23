
# Auditoria Frontend vs Backend — Módulo Financeiro

## Status: ✅ Fase 1 Concluída

## Correções Implementadas (v1.5.0)

### 1. Portal de Integração
- ✅ Botão "Voltar" adicionado ao header
- ✅ Fornecedores migrados de "Geral" para "Cadastros Auxiliares"

### 2. Documentação API — Divergências Corrigidas
- ✅ CP `/registrar-pagamento`: body corrigido `id` → `conta_pagar_id`
- ✅ CP `/query`: response inclui `pagination` e `meta`
- ✅ CP `/cancelar`: response inclui `success` e `ids`
- ✅ CP `/upsert`: `empresa_id` documentado como obrigatório
- ✅ CP `/listar`: 7 filtros faltantes adicionados (emissão, conta corrente, CPF/CNPJ, vendedor, observações)
- ✅ Seção "Estrutura de Erros" com exemplos de 400/401/429/500
- ✅ Changelog atualizado para v1.5.0

### 3. Endpoints CR — Já Documentados
- ✅ `/lancar-recebimento`, `/cancelar-recebimento`, `/conciliar`, `/desconciliar`, `/cancelar` já estavam no `contasReceberIntegracao`

## Gaps Remanescentes (Futuro)

| Prioridade | Gap | Status |
|---|---|---|
| Média | CP Form sem campos tributários no drawer de criação | Pendente |
| Média | CP/CR: Impostos retidos não editáveis (apenas visualização) | Pendente |
| Baixa | BASE_URL hardcoded com URL real do Supabase | Pendente |
| Baixa | CR detail drawer sem dados de conciliação | Pendente |
