
# Plano: Acesso de Michele ao Trade Marketing com Visibilidade da Equipe

## Visão Geral

Michele Silva (supervisora) precisa ter acesso ao módulo Trade Marketing e poder visualizar os dados lançados por sua equipe de 4 vendedores.

## Situação Atual

### Hierarquia Já Configurada
A equipe já está corretamente vinculada a Michele no banco de dados:

| Membro | Email | supervisor_id |
|--------|-------|---------------|
| Nathalia Martini | nathaliamartini@distribuidoraunion.com.br | Michele |
| Douglas Cruz | douglas.cruz@distribuidoraunion.com.br | Michele |
| Juliana Moura | j.moura@distribuidoraunion.com.br | Michele |
| Monique Campos | m.campos@rubyrosemaquiagem.com.br | Michele |

### Infraestrutura Existente
O sistema já possui toda a lógica para supervisores visualizarem dados da equipe:
- Função `get_subordinados`: Retorna subordinados recursivamente
- Componente `TeamHierarchyFilter`: Exibe hierarquia e permite filtrar por membro
- Lógica de impersonação: Permite "ver como" outro usuário

### Permissões Atuais de Michele
- Apenas: `dashboard` e `instalar_app`
- Não possui acesso ao módulo Trade

## Implementação

### Fase 1: Adicionar Permissões de Módulo e Telas

Executar migração SQL para conceder a Michele:

1. **Módulo Trade Marketing** (`trade`)
2. **Telas do Trade** (para visualização da equipe):
   - `TRADE_DASHBOARD` - Dashboard principal
   - `trade_marketing` - Tela principal
   - `trade_stores` - PDVs / Lojas
   - `trade_visits` - Visitas
   - `trade_photos` - Fotos
   - `TRADE_PERFORMANCE` - Performance
   - `TRADE_FOTOS` - Galeria de Fotos
   - `TRADE_VISITAS` - Registro de Visitas

**Telas que NÃO serão incluídas** (restritas a admins):
- `trade_admin` - Administrativo Trade
- `trade_insights` - Insights IA (restrito)
- `trade_competitors` - Análise Competitiva (restrito)

### Fase 2: Validar Funcionamento

Após a migração, Michele poderá:
1. Ver o módulo Trade Marketing no menu lateral
2. Acessar o dashboard de Trade
3. Ver visitas, fotos e dados de PDVs da sua equipe
4. Usar o filtro `TeamHierarchyFilter` para alternar entre membros

## Detalhes Técnicos

### Migração SQL

```sql
-- 1. Adicionar módulo Trade para Michele
INSERT INTO usuario_permissoes_modulos (usuario_id, modulo_id)
SELECT 
  '9b55c37f-e2c4-4064-9c89-1838f4e482fc',
  id
FROM modulos_sistema
WHERE codigo = 'trade'
ON CONFLICT DO NOTHING;

-- 2. Adicionar telas do Trade para Michele
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id)
SELECT 
  '9b55c37f-e2c4-4064-9c89-1838f4e482fc',
  id
FROM telas_sistema
WHERE codigo IN (
  'TRADE_DASHBOARD',
  'trade_marketing', 
  'trade_stores',
  'trade_visits',
  'trade_photos',
  'TRADE_PERFORMANCE',
  'TRADE_FOTOS',
  'TRADE_VISITAS',
  'TRADE_LOJAS',
  'TRADE_AUDITORIAS'
)
ON CONFLICT DO NOTHING;
```

### Como a Visualização da Equipe Funciona

O sistema já implementa a lógica de supervisor automaticamente:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Michele (Supervisora)                        │
│                          role: supervisor                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Ao acessar Trade Marketing:                                   │
│                                                                 │
│   1. Sistema detecta role = 'supervisor'                        │
│   2. Chama get_subordinados(michele_id)                         │
│   3. Retorna IDs: [Nathalia, Douglas, Juliana, Monique]         │
│   4. Exibe TeamHierarchyFilter com a equipe                     │
│   5. Dados mostrados: próprios + equipe                         │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  👨‍💼 Minha Equipe                                         │   │
│   │  ├── 💼 Nathalia Martini (Vendedor)                     │   │
│   │  ├── 💼 Douglas Cruz (Vendedor)                         │   │
│   │  ├── 💼 Juliana Moura (Vendedor)                        │   │
│   │  └── 💼 Monique Campos (Vendedor)                       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Benefícios

- **Sem código novo**: Apenas configuração de permissões
- **Hierarquia automática**: Sistema já respeita supervisor_id
- **Filtros disponíveis**: Michele pode ver todos ou filtrar por membro
- **Segurança mantida**: Não verá dados de outras equipes

## Arquivos Afetados

Apenas migração SQL - nenhum código precisa ser modificado.
