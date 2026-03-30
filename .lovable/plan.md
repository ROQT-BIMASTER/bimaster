

# Analise de Conflitos entre Camadas de Permissao

## Como funciona HOJE (a RPC `get_all_user_permissions`)

A funcao que resolve as permissoes finais de um usuario usa **OR (uniao)** entre 3 fontes:

```text
Permissao Final = role_permissoes ∪ usuario_permissoes ∪ departamento_permissoes
```

Isso significa: se QUALQUER uma das 3 fontes libera um modulo/tela, o usuario TEM acesso. Nao ha conceito de "negar" — so de "conceder".

## O Problema Central: Nao ha como RESTRINGIR individualmente

**Cenario do usuario:**
1. Em "Permissoes por Role", libero o modulo Trade para `promotor`
2. Em "Permissoes por Usuario", NAO ativo Trade para o promotor Joao
3. **Resultado atual:** Joao TEM acesso ao Trade, porque a permissao por role ja concede

A logica OR na RPC faz com que a permissao por role funcione como um "piso minimo". Nao e possivel REMOVER acesso de um usuario individual se o role dele ja concede.

**Cenario inverso (funciona):**
1. Role `promotor` NAO tem Trade
2. Individualmente, libero Trade para Joao
3. **Resultado:** Joao tem Trade (OK — a permissao individual ADICIONA)

### Onde isso fica confuso na UI

- `GerenciamentoPermissoesModulos` diz: "Permissoes especificas por usuario (**sobrescrevem** as permissoes da funcao)" — isso e **FALSO**. Elas nao sobrescrevem, elas somam.
- `PermissoesDeAcesso` pede "Sincronizar com Usuarios" que chama `sincronizar_permissoes_usuario` — esta funcao COPIA as permissoes do role para `usuario_permissoes_*`, mas a RPC consulta AMBAS as tabelas com OR. Isso gera duplicacao de dados sem efeito pratico.
- Se o admin desativa um modulo para um usuario em "Por Usuario", mas o role ainda tem, o usuario continua com acesso.

### Inconsistencia no Fallback

A funcao fallback `get_user_combined_module_permissions` tem logica DIFERENTE da principal: ela so aplica `role_permissoes` se o usuario NAO tem departamento. A principal aplica ambos com OR sempre. Comportamento diverge dependendo de qual funcao e usada.

## Plano de Correcao

### Modelo proposto: Role como BASE + Usuario como OVERRIDE

```text
Permissao Final = (role_permissoes ∪ departamento_permissoes) 
                  FILTRADO por usuario_permissoes (quando customizado)
```

Logica:
- Se o usuario tem registros em `usuario_permissoes_modulos`, usar **somente esses** (override explícito)
- Se NAO tem registros (nunca foi customizado), usar role + departamento como fallback
- Flag `permissoes_customizadas` na tabela para distinguir "nenhuma permissao" de "nunca customizado"

### Fase 1 — Corrigir a RPC `get_all_user_permissions`

Alterar a logica de resolucao de modulos e telas:

```sql
-- Para modulos:
-- Se usuario tem registros em usuario_permissoes_modulos, usar APENAS esses
-- Senao, usar role_permissoes ∪ departamento_permissoes
IF EXISTS (SELECT 1 FROM usuario_permissoes_modulos WHERE usuario_id = p_user_id) THEN
  -- Override: apenas permissoes individuais
  SELECT array_agg(DISTINCT m.codigo) INTO v_modules
  FROM modulos_sistema m
  JOIN usuario_permissoes_modulos upm ON upm.modulo_id = m.id
  WHERE upm.usuario_id = p_user_id AND m.ativo = true;
ELSE
  -- Fallback: role + departamento
  SELECT array_agg(DISTINCT m.codigo) INTO v_modules
  FROM modulos_sistema m
  WHERE m.ativo = true AND (
    EXISTS (SELECT 1 FROM role_permissoes_modulos rpm WHERE rpm.role = v_role AND rpm.modulo_id = m.id)
    OR EXISTS (SELECT 1 FROM departamento_permissoes_modulos dpm WHERE dpm.departamento_id = v_dept AND dpm.modulo_id = m.id)
  );
END IF;
-- Mesma logica para telas
```

### Fase 2 — Corrigir a UI de "Permissoes por Usuario"

No `GerenciamentoPermissoesModulos`, ao exibir permissoes de um usuario:

1. Mostrar quais modulos vem do **role** (badge "Via Role", toggle desabilitado ou cinza)
2. Mostrar quais foram **adicionados individualmente** (badge "Custom")
3. Permitir DESATIVAR modulos que vem do role (criando override negativo)
4. Corrigir o texto de "sobrescrevem" para explicar a logica real

### Fase 3 — Corrigir `sincronizar_permissoes_usuario`

Atualmente a sincronizacao copia role → usuario, mas como a RPC ja consulta role diretamente, isso gera duplicacao. Opcoes:

**Opcao A (recomendada):** Remover a sincronizacao e deixar a RPC resolver em tempo real. A tabela `usuario_permissoes_*` so e usada para overrides individuais.

**Opcao B:** Manter a sincronizacao mas mudar a RPC para consultar APENAS `usuario_permissoes_*` (role seria resolvido pela sync). Risco: sync precisa rodar sempre que role muda.

### Fase 4 — Atualizar o fallback

Alinhar `get_user_combined_module_permissions` e `get_user_combined_screen_permissions` com a mesma logica da funcao principal.

### Fase 5 — UI de feedback visual

Em todas as telas de permissoes, mostrar indicadores claros:
- Badge verde "Role" = vem da permissao por funcao
- Badge azul "Departamento" = vem do departamento
- Badge roxo "Individual" = configurado manualmente
- Indicador de conflito quando role libera mas usuario nao tem

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| Migration SQL | Recriar `get_all_user_permissions` com logica de override |
| Migration SQL | Alinhar `get_user_combined_module/screen_permissions` |
| `src/components/configuracoes/GerenciamentoPermissoesModulos.tsx` | Badges de origem; permitir override negativo |
| `src/components/configuracoes/GerenciamentoPermissoesTelas.tsx` | Badges de origem; indicar conflitos |
| `src/components/configuracoes/PermissoesDeAcesso.tsx` | Corrigir texto explicativo; remover "Sincronizar" ou mudar comportamento |

## Impacto

Esta mudanca afeta TODOS os usuarios nao-admin. Antes de aplicar, e necessario:
1. Mapear quais usuarios hoje tem permissoes APENAS via role (sem registros em `usuario_permissoes_*`)
2. Para esses, a nova logica cairia no fallback (role) — sem mudanca
3. Para usuarios que JA tem registros individuais (criados pela sincronizacao), a nova logica usaria APENAS esses — precisam ser auditados para garantir que estao completos

