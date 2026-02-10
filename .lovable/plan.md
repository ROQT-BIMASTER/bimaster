

# Formulario Compartilhado com Token Unico

## Mudanca Principal

Em vez de gerar um token individual para cada vendedor, sera criado **um unico token/codigo de acesso** que o administrador gera e compartilha com todos os 280 vendedores. O token fica ativo por 24 horas e pode ser usado multiplas vezes.

## Como Funciona

1. O administrador acessa "Minha Equipe" e clica em "Gerar Link do Formulario"
2. O sistema cria um token unico (ex: `EQUIPE2024`) valido por 24 horas
3. O admin compartilha o link `seusite.com/formulario-equipe?token=EQUIPE2024` via WhatsApp/grupo
4. Cada vendedor abre o link, informa o token, preenche seus dados pessoais
5. Os dados sao salvos na tabela intermediaria `team_form_submissions`
6. O admin pode acompanhar quantos ja preencheram e vincular os dados futuramente

## Arquitetura de Seguranca

- Token de uso multiplo, mas com expiracao de 24h (configuravel)
- Edge Function valida o token e insere os dados (sem acesso anonimo direto ao banco)
- Validacao de CPF duplicado para evitar preenchimentos repetidos
- Rate limiting por IP na Edge Function

## Detalhamento Tecnico

### 1. Nova tabela: `team_form_tokens`

```sql
CREATE TABLE public.team_form_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  label text NOT NULL,              -- ex: "Formulario Equipe Fev/2026"
  equipe_comercial text,
  supervisor_nome text,
  max_uses integer,                 -- NULL = ilimitado
  use_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 2. Nova tabela: `team_form_submissions`

```sql
CREATE TABLE public.team_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES public.team_form_tokens(id),
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  rg text,
  data_nascimento date,
  email_pessoal text,
  whatsapp text NOT NULL,
  tamanho_camiseta text,
  equipe_comercial text,
  supervisor_nome text,
  observacoes text,
  vinculado boolean DEFAULT false,
  vinculado_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(cpf)                      -- impede duplicatas pelo CPF
);
```

- A constraint `UNIQUE(cpf)` garante que cada vendedor preencha apenas uma vez
- Se precisar atualizar, a Edge Function faz `upsert` pelo CPF

### 3. Edge Function: `team-form-submit`

- Recebe: `{ token, dados_do_formulario }`
- Valida: token existe, status = 'active', nao expirado
- Valida dados (CPF, WhatsApp, campos obrigatorios)
- Faz upsert em `team_form_submissions` pelo CPF (permite correcao se preencher de novo com mesmo CPF)
- Incrementa `use_count` no token
- Retorna sucesso ou erro com mensagem clara

### 4. Pagina publica: `/formulario-equipe`

- Rota publica (sem `ProtectedRoute`)
- Tela 1: Campo para informar o codigo de acesso
- Tela 2: Formulario com os campos (reutilizando validacoes do `teamMemberFormSchema`)
- Campos pre-preenchidos: equipe_comercial e supervisor_nome (vindos do token, editaveis)
- Tela 3: Confirmacao de sucesso apos envio
- Design limpo e responsivo (muitos vendedores acessarao pelo celular)

### 5. Painel do administrador (dentro de "Minha Equipe")

- Botao "Gerar Link Formulario" abre modal com:
  - Campo: nome/label do formulario
  - Campo: equipe comercial (opcional, pre-preenche no form)
  - Campo: supervisor (opcional, pre-preenche no form)
  - Validade: 24h (padrao, editavel)
- Apos gerar, exibe link para copiar e compartilhar
- Lista de tokens ativos/expirados com contagem de preenchimentos
- Tabela de submissions recebidas com status de vinculacao

### 6. Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabelas `team_form_tokens` e `team_form_submissions` com RLS |
| `supabase/functions/team-form-submit/index.ts` | Edge Function para validar token e salvar dados |
| `src/pages/FormularioEquipe.tsx` | Pagina publica do formulario |
| `src/components/trade/supervisor/GenerateFormLinkDialog.tsx` | Modal para gerar token e link |
| `src/components/trade/supervisor/FormSubmissionsPanel.tsx` | Painel de acompanhamento das submissoes |
| `src/hooks/useTeamFormTokens.ts` | Hook para gerenciar tokens |
| `src/App.tsx` | Adicionar rota publica `/formulario-equipe` |

### Resumo de Seguranca

- Token com expiracao de 24h (nao e permanente)
- Admin pode revogar o token a qualquer momento
- Edge Function faz toda validacao server-side
- CPF unico impede preenchimento duplicado
- Sem acesso anonimo direto ao banco de dados
- Dados sensiveis trafegam apenas pela Edge Function com service role

