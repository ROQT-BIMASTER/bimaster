
# Plano de Melhorias: Telas de Administração Trade Marketing

## Diagnóstico Completo

Após análise detalhada, identifiquei as seguintes áreas que precisam de melhorias:

---

## 1. Tela de Usuários (TradeAdminUsers) - PRIORIDADE ALTA

### Problemas Atuais:
- Apenas lista usuários - não permite nenhuma ação
- Não mostra quem tem permissão `trade_admin`
- Não permite atribuir/remover permissões do módulo Trade
- Não mostra nível de aprovação vinculado a cada usuário

### Melhorias Propostas:

| Funcionalidade | Descrição |
|----------------|-----------|
| **Coluna de Permissão Trade** | Mostrar se o usuário tem acesso ao Trade Marketing |
| **Coluna trade_admin** | Mostrar se o usuário tem acesso administrativo |
| **Coluna Nível de Aprovação** | Mostrar nível de alçada (se houver) |
| **Ação: Conceder/Revogar trade_admin** | Permitir que a Milene atribua permissão administrativa a outros |
| **Ação: Vincular Nível de Aprovação** | Permitir associar usuário a um nível de alçada |

---

## 2. Níveis de Aprovação (TradeAdminApprovalLevels) - PRIORIDADE ALTA

### Problemas Atuais:
- Define níveis mas não vincula usuários
- Não existe tabela `trade_user_approval_levels` no banco
- Não mostra quem são os aprovadores de cada nível
- Não há como gerenciar quem pode aprovar em cada alçada

### Melhorias Propostas:

#### Banco de Dados:
Criar tabela para vincular usuários aos níveis:
```text
trade_user_approval_levels
├── id (uuid, PK)
├── user_id (uuid, FK → profiles.id)
├── level_id (uuid, FK → trade_approval_levels.id)
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

#### Interface:
| Funcionalidade | Descrição |
|----------------|-----------|
| **Seção "Aprovadores"** | Mostrar lista de usuários vinculados a cada nível |
| **Botão "Gerenciar Aprovadores"** | Abrir modal para adicionar/remover usuários de um nível |
| **Indicador Visual** | Mostrar quantos aprovadores em cada nível |

---

## 3. Relatórios - PRIORIDADE MÉDIA

### Problemas Atuais:
- Sem paginação (pode ficar lento com muitos dados)
- Sem filtro por período/data
- Sem gráficos visuais complementares

### Melhorias Propostas:

| Funcionalidade | Descrição |
|----------------|-----------|
| **Paginação** | Limitar a 20 itens por página |
| **Filtro de Período** | Adicionar seletores de data inicial/final |
| **Gráfico de Resumo** | Adicionar gráfico de barras para top 5 (opcional) |

---

## 4. Módulo Admin (TradeAdminModule) - PRIORIDADE BAIXA

### Pontos Positivos:
- Bem estruturado com KPIs
- Links organizados por categoria
- Interface moderna e responsiva

### Melhorias Menores:
| Funcionalidade | Descrição |
|----------------|-----------|
| **Card "Aprovadores Ativos"** | Mostrar quantos usuários podem aprovar |
| **Alerta de Usuários Sem Nível** | Mostrar se há aprovadores sem nível definido |

---

## Resumo das Alterações

### Banco de Dados:
| Ação | Descrição |
|------|-----------|
| CREATE TABLE | `trade_user_approval_levels` - vincular usuários aos níveis |
| RLS | Políticas de segurança para a nova tabela |

### Arquivos a Modificar:

| Arquivo | Alterações |
|---------|------------|
| `TradeAdminUsers.tsx` | Adicionar colunas de permissões e nível, ações de gerenciamento |
| `TradeAdminApprovalLevels.tsx` | Adicionar seção de aprovadores por nível |
| `TradeReportCampaigns.tsx` | Adicionar filtro de período e paginação |
| `TradeReportClients.tsx` | Adicionar filtro de período e paginação |
| `TradeReportSellers.tsx` | Adicionar filtro de período e paginação |

### Novos Componentes (Opcional):
| Componente | Descrição |
|------------|-----------|
| `ApproverManagementDialog` | Modal para gerenciar aprovadores de um nível |
| `UserPermissionToggle` | Componente para ativar/desativar permissões |

---

## Ordem de Implementação Sugerida

1. **Fase 1**: Criar tabela `trade_user_approval_levels` + RLS
2. **Fase 2**: Atualizar `TradeAdminApprovalLevels` com gestão de aprovadores
3. **Fase 3**: Atualizar `TradeAdminUsers` com visualização de permissões e níveis
4. **Fase 4**: Adicionar funcionalidade de atribuir permissão `trade_admin`
5. **Fase 5**: Melhorar relatórios com paginação e filtros

---

## Resultado Esperado

Após as melhorias:
- Milene poderá gerenciar quem tem acesso administrativo
- Será possível definir quem são os aprovadores de cada nível
- Relatórios terão melhor performance com paginação
- Visão clara de toda a estrutura de permissões do Trade Marketing
