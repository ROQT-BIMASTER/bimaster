

# Correcao: Contas a Receber — Valores e Controle de Acesso por Empresa

## Diagnostico

### Problema 1: Controle de Acesso por Empresa (CRITICO)

As 6 RPCs de Contas a Receber sao `SECURITY DEFINER` (bypassam RLS) e confiam no parametro `p_empresas` enviado pelo frontend. Se o frontend enviar `null` ou IDs de empresas nao autorizadas, a RPC retorna dados de TODAS as empresas.

RPCs afetadas:
- `get_contas_receber_dashboard_kpis`
- `get_contas_receber_evolucao_mensal`
- `get_contas_receber_filter_options`
- `get_contas_receber_status_dist`
- `get_contas_receber_pmr_detalhes`
- `get_contas_receber_totais_filtrados`

A funcao `get_empresa_ids_do_usuario()` ja existe mas NAO e usada nas RPCs. Cada RPC faz apenas `AND (p_empresas IS NULL OR empresa_id = ANY(p_empresas))` — confiando cegamente no cliente.

### Problema 2: Valores nao carregando

O `get_contas_receber_filter_options` nao filtra por empresa do usuario. Isso faz o dropdown de empresas mostrar TODAS as empresas do sistema, incluindo as que o usuario nao tem acesso. Quando o usuario seleciona uma empresa nao autorizada, a query direta (que USA RLS) retorna zero registros, criando a impressao de que os valores nao carregam.

## Solucao

### Migration SQL — Reescrever as 6 RPCs com validacao server-side

Em cada RPC, adicionar no inicio:

```sql
-- Forcar intersecao entre p_empresas e empresas autorizadas
v_empresas_permitidas := get_empresa_ids_do_usuario();
IF p_empresas IS NOT NULL THEN
  v_empresas := ARRAY(SELECT unnest(p_empresas) INTERSECT SELECT unnest(v_empresas_permitidas));
ELSE
  v_empresas := v_empresas_permitidas;
END IF;
```

E substituir `AND (p_empresas IS NULL OR empresa_id = ANY(p_empresas))` por `AND empresa_id = ANY(v_empresas)`.

### RPCs a alterar

| RPC | Mudanca |
|-----|---------|
| `get_contas_receber_dashboard_kpis` | Adicionar `v_empresas` com intersecao |
| `get_contas_receber_evolucao_mensal` | Idem |
| `get_contas_receber_filter_options` | Idem — corrige dropdown mostrando empresas nao autorizadas |
| `get_contas_receber_status_dist` | Idem |
| `get_contas_receber_pmr_detalhes` | Idem |
| `get_contas_receber_totais_filtrados` | Idem |

### Sem alteracoes no frontend

O frontend ja passa `filterEmpresas` corretamente via `useEmpresaFilter`. O problema e exclusivamente no backend que nao valida esses IDs. Apos a correcao, mesmo que o frontend envie IDs nao autorizados, o servidor restringe automaticamente.

## Arquivos

| Arquivo | Acao |
|---------|------|
| Migration SQL | ALTER 6 RPCs para validar empresa server-side |

