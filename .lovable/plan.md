

## Gerenciamento de API Keys — Plano

### Contexto

O sistema usa 14 secrets no backend (N8N_API_KEY, POLLO_API_KEY, ELEVENLABS_API_KEY, etc.). Secrets são gerenciados pela infraestrutura Cloud e **não podem ser lidos pelo frontend** (são criptografados). Portanto, a página será um **painel de gestão visual** com:

- Lista das API keys do sistema com status e mascaramento
- Tabela no banco para registrar metadata das chaves (nome, última rotação, status ativo/inativo)
- Funcionalidade de rotação (gerar nova chave + registrar no log)
- Logs de uso via `api_security_log` já existente

### Implementação

#### 1. Migração — Tabela `api_keys_management`

Nova tabela para rastrear metadata das chaves:
- `id`, `key_name` (text, unique), `description`, `masked_value` (últimos 4 chars), `is_active` (bool), `last_rotated_at` (timestamptz), `rotated_by` (uuid), `created_at`
- RLS: somente admins leem/escrevem (via `has_role`)
- Seed com as 14 chaves atuais do sistema

#### 2. Componente — `GerenciamentoAPIKeys.tsx`

Em `src/components/configuracoes/GerenciamentoAPIKeys.tsx`:
- Tabela com: Nome da chave, Valor mascarado (`****xxxx`), Status (ativo/inativo badge), Última rotação, Ações
- Toggle ativo/inativo por chave
- Botão "Rotacionar" — abre dialog de confirmação, registra nova data de rotação e quem fez
- Card com estatísticas: total de chaves, ativas, última rotação
- Seção de logs recentes da `api_security_log`

#### 3. Integração na página Configurações

Adicionar nova tab "API Keys" dentro da seção protegida por senha ("Outras opções") em `Configuracoes.tsx`, visível apenas para admins.

#### Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/configuracoes/GerenciamentoAPIKeys.tsx` |
| Editar | `src/pages/Configuracoes.tsx` (nova tab) |
| Migração | Tabela `api_keys_management` + RLS + seed data |

