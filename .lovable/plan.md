

## Diagnóstico Completo

### Problema 1: Telas faltantes para módulos China, Projetos, Config e Reuniões

A tabela `telas_sistema` **não possui nenhuma tela** vinculada aos módulos `china`, `projetos`, `config` e `reunioes`. Todas as telas existentes pertencem apenas a: `comercial`, `departamentos`, `eventos`, `fabrica`, `financeiro`, `marketing`, `precos`, `prospects`, `relatorios`, `trade`.

Isso significa que o sistema de permissões por tela não consegue controlar acesso granular a essas áreas.

### Problema 2: Permissões de módulos por role vazias (exceto admin)

A tabela `role_permissoes_modulos` só tem registros para `admin`. Supervisores, vendedores, promotores e gerentes **não têm nenhum módulo** atribuído por role. Os roles não-admin dependem exclusivamente de permissões individuais ou por departamento.

### Problema 3: Permissões por departamento incompletas

Vários departamentos não têm vínculos com módulos relevantes:
- **Projetos** (dept) -- sem vínculo ao módulo `projetos` ou `china`
- **Administrativo** -- sem vínculo a `config`
- **TI / Tecnologia** -- sem vínculos relevantes
- **Logística** -- sem vínculos
- **RH** -- sem vínculos

### Problema 4: Tabelas sem políticas RLS

Apenas 2 tabelas com RLS habilitado mas sem policies: `ddos_rate_limits` e `login_attempts`. Estas são tabelas de segurança que devem ser acessíveis apenas via service_role.

---

## Plano de Implementação

### Migration 1: Criar telas faltantes nos módulos

Inserir telas em `telas_sistema` para os 4 módulos sem cobertura:

**Módulo China** (`modulo_codigo = 'china'`):
- `china_dashboard` - Dashboard Fábrica China
- `china_submissoes` - Submissões de Produtos
- `china_recebimentos` - Recebimentos
- `china_ordens` - Ordens de Compra
- `china_fichas` - Fichas de Produto

**Módulo Projetos** (`modulo_codigo = 'projetos'`):
- `projetos_dashboard` - Dashboard Projetos
- `projetos_inbox` - Inbox
- `projetos_aprovacoes` - Aprovações de Cadastro
- `projetos_equipe` - Minha Equipe
- `projetos_vincular_china` - Vincular China
- `projetos_produto_brasil` - Produtos Brasil

**Módulo Reuniões** (`modulo_codigo = 'reunioes'`):
- `reunioes_dashboard` - Reuniões
- `reunioes_detalhe` - Detalhe da Reunião

**Módulo Config** (`modulo_codigo = 'config'`):
- `config_geral` - Configurações Gerais
- `config_storage` - Gestão de Storage

### Migration 2: Configurar permissões por role

Atribuir módulos aos roles não-admin em `role_permissoes_modulos`:
- **gerente**: dashboard, prospects, trade, projetos, comercial, precos
- **supervisor**: dashboard, prospects, trade, comercial, precos
- **vendedor**: dashboard, prospects, comercial
- **promotor**: dashboard, trade

Atribuir telas correspondentes em `role_permissoes_telas` para cada role conforme o módulo permitido.

### Migration 3: Configurar permissões por departamento

Vincular departamentos aos módulos e telas relevantes:
- **Projetos** (dept) → módulos `projetos`, `china` + telas correspondentes
- **Administrativo** → módulo `config`
- **Compras e Faturamento** → manter `fabrica` + adicionar `china`

### Migration 4: Políticas RLS para tabelas pendentes

Para `ddos_rate_limits` e `login_attempts`:
- Política SELECT restrita a admins via `has_role(auth.uid(), 'admin')`
- INSERT/UPDATE/DELETE bloqueados (apenas service_role via backend)

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| 1 migration SQL | Telas, permissões role/departamento, RLS |

Nenhuma alteração de código frontend necessária -- o sistema de permissões já lê dinamicamente de `telas_sistema`, `role_permissoes_*` e `departamento_permissoes_*`.

