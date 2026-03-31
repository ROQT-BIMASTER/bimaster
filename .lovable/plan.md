

# Estrategia: Migrar Plano de Contas e Reclassificar 47K+ Titulos

## Dimensao do Problema

| Item | Valor |
|------|-------|
| Contas atuais (`trade_chart_of_accounts`) | 208 registros |
| Contas novas (planilha) | ~120 contas |
| Titulos em `contas_pagar` com `plano_contas_id` | 47.344 |
| Arquivos que referenciam a tabela | 39 arquivos (front + edge functions) |
| Categorias ERP distintas (`categoria_codigo`) | 100+ |

## Estrutura do Novo Plano

```text
1     RECEITA BRUTA (Faturamento)
├─1.1   Boletos
├─1.2   Depósitos
├─...
2     CUSTOS VARIÁVEIS
├─2.1   Fornecedores de Produtos
├─2.4   Fretes
├─2.6   Despesas Comerciais
├─2.7   Tarifas
3     DESPESAS FIXAS
├─3.1   Administrativas (~24 subcontas)
├─3.2   Pessoal (~14 subcontas)
├─3.3   Marketing (~13 subcontas)
├─3.4   Financeiras
├─3.5   Retirada Sócios
4     PATRIMÔNIO
├─4.1   Não Operacionais
├─4.2   Investimentos
├─4.3   Financeiras
├─4.4   Sócios
```

## Estrategia em 4 Fases

### Fase 1 — Preparacao (sem impacto em producao)

1. **Importar novo plano** na mesma tabela `trade_chart_of_accounts` com flag `is_active = false` e um campo `versao = 'v2'` para diferenciar
2. **Criar tabela de mapeamento** `plano_contas_migração` com colunas:
   - `old_account_id` → conta antiga
   - `new_account_id` → conta nova correspondente
   - `confianca` → alta/media/baixa
   - `mapeado_por` → 'manual' ou 'ia'
3. **Mapear manualmente** as contas obvias (ex: "Aluguel" antigo → "3.1.1 Aluguel do estabelecimento" novo)
4. **Usar IA** para sugerir mapeamento das restantes baseado em similaridade de nome

### Fase 2 — Mapeamento e Validacao

1. **Tela de revisao** para o admin validar cada mapeamento antes de aplicar
2. Mostrar: conta antiga (codigo + nome) → conta nova sugerida → confianca
3. Admin confirma, corrige ou ignora cada linha
4. Ao final, gerar relatorio de cobertura (% de titulos mapeados)

### Fase 3 — Execucao (migração atomica)

1. **Backup**: snapshot da tabela `contas_pagar` (campos `plano_contas_id/codigo/nome`)
2. **UPDATE em batch** de `contas_pagar` usando a tabela de mapeamento:
   ```sql
   UPDATE contas_pagar cp
   SET plano_contas_id = m.new_account_id,
       plano_contas_codigo = new.code,
       plano_contas_nome = new.name
   FROM plano_contas_migracao m
   JOIN trade_chart_of_accounts new ON new.id = m.new_account_id
   WHERE cp.plano_contas_id = m.old_account_id;
   ```
3. **Desativar contas antigas**: `UPDATE trade_chart_of_accounts SET is_active = false WHERE versao != 'v2'`
4. **Ativar contas novas**: `UPDATE trade_chart_of_accounts SET is_active = true WHERE versao = 'v2'`

### Fase 4 — Classificacao IA dos nao-mapeados

1. Titulos sem mapeamento direto → rodar `classificar-contas-batch` com o novo plano
2. Atualizar edge function de classificacao para usar apenas contas v2
3. Marcar reclassificados com `classificado_automaticamente = true`

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| FK constraints quebram durante migracao | Manter contas antigas (desativadas), nao deletar |
| DRE historica muda | Campo `ativo_dre` preserva dados passados |
| Edge functions referenciam contas antigas | Filtro `is_active = true` ja existe em 90% dos queries |
| Titulos sem mapeamento | Fase 4 com IA + flag para revisao manual |

## Arquivos a Criar/Modificar

| Recurso | Acao |
|---------|------|
| Migration SQL | Importar ~120 contas novas + tabela de mapeamento |
| Script de mapeamento | Cruzar nomes antigos vs novos por similaridade |
| Tela de revisao de mapeamento | UI para admin validar/corrigir |
| Migration SQL (Fase 3) | UPDATE batch de 47K registros |
| Edge functions de classificacao | Atualizar para usar apenas plano v2 |

## Decisao Necessaria

Antes de implementar, preciso saber:
- **Quer uma tela no sistema** para revisar os mapeamentos antes de aplicar?
- **Ou prefere** que eu gere o mapeamento automatico e aplique direto, com possibilidade de correcao depois?
- A empresa quer **manter historico** das contas antigas (apenas desativadas) ou **deletar tudo**?

