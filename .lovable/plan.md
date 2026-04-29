## Convites para Projetos

Sistema de convite explícito para acessar um projeto, com aceite obrigatório, papel + seções pré-definidos no envio, e suporte tanto a usuários internos quanto a e-mails externos (que criam conta no aceite).

---

### Fluxo do usuário

```text
[Coordenador/Gestor/Admin]
   │
   ▼ abre "Membros do Projeto" → aba "Convites"
   ├─ busca interno por nome/email   ─┐
   └─ digita e-mail externo livre     ├─► escolhe papel + seções → "Enviar convite"
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
   [Convidado interno]                            [Convidado externo]
   recebe sino + badge no menu                    recebe e-mail com link único (token)
   /dashboard/projetos/convites                   abre link → cadastra conta → cai no aceite
                │                                             │
                ▼                                             ▼
   Aceitar → vira membro com papel/seções pré-definidos | Recusar → convite "recusado"
```

Convites pendentes ficam visíveis para o coordenador na aba "Convites" do diálogo, com ações: reenviar, cancelar, copiar link.

---

### Escopo da entrega

1. **Banco** (`projeto_convites`):
   - `id`, `projeto_id`, `email` (lowercased), `convidado_user_id` (nullable, preenchido se interno), `convidado_por`, `papel`, `secoes_ids[]`, `mensagem`, `token` (uuid único), `status` (`pending|accepted|declined|cancelled|expired`), `expires_at` (default 14 dias), `created_at`, `accepted_at`, `accepted_by`.
   - RLS: leitura pelo convidante, pelo convidado (match por `auth.uid()` ou por email do `auth.users`), e por coordenadores/gestores do projeto + admin. Insert restrito a coordenador/gestor/admin (via `EXISTS` em `projeto_membros` com papel apto, sem function recursiva). Update restrito ao convidado (aceitar/recusar) e ao convidante (cancelar).
   - RPC `accept_projeto_convite(_token uuid)` SECURITY DEFINER: valida token, expiração, status; cria linha em `projeto_membros` com papel e seções; marca convite `accepted`; idempotente.
   - RPC `cancel_projeto_convite(_id uuid)` e `resend_projeto_convite(_id uuid)`.
   - Trigger ao inserir convite: se `email` casa com algum `profiles.email`, preenche `convidado_user_id` automaticamente.

2. **Notificações internas**:
   - Ao criar convite com `convidado_user_id` preenchido → cria notificação (mesmo padrão já existente em `notifications`/sino) apontando para `/dashboard/projetos/convites`.

3. **E-mail externo (opcional, se domínio de e-mail estiver configurado)**:
   - Edge function `send-projeto-convite` que monta link `https://<app>/projetos/convite/<token>` e dispara via `send-transactional-email` (infra Lovable Emails). Se domínio não configurado, exibir banner: "Convites por e-mail desativados — usuário pode acessar via link copiado".
   - Botão "Copiar link" sempre disponível como fallback, independente de e-mail.

4. **Frontend**:
   - **Novo componente** `ConvidarMembroPanel` dentro de `ProjetoMembrosDialog` (substitui/complementa o bloco atual de busca): campo de e-mail/nome, papel (`Select` reaproveitando `papelOptions`), grade de seções (igual à atual), mensagem opcional. Validação Zod estrita (email, papel enum).
   - **Nova aba** "Convites pendentes" no mesmo diálogo, listando convites com status, expiração, botões reenviar/cancelar/copiar link.
   - **Nova página** `/dashboard/projetos/convites` (`PageConvitesRecebidos`): lista convites recebidos pelo usuário logado, com botões Aceitar/Recusar. Aceitar chama a RPC e redireciona para `/dashboard/projetos/<id>`.
   - **Nova rota pública** `/projetos/convite/:token` (`PageConviteAceitar`): se não autenticado, redireciona para `/auth/login?redirect=...`; após login (ou signup com o mesmo e-mail do convite), exibe resumo do convite e botão Aceitar.
   - Badge no item de menu "Projetos" com a contagem de convites pendentes do usuário.

5. **Permissões**:
   - Quem pode convidar: coordenador/gestor do projeto + admin (mesma checagem `isCoordinator` já em `useProjetoMembros`).
   - Quem pode aceitar: apenas o destinatário (match por `auth.uid()` ou por e-mail do convite).

---

### Detalhes técnicos

- **Hook novo**: `useProjetoConvites(projetoId)` — list/create/cancel/resend.
- **Hook novo**: `useMeusConvitesPendentes()` — para badge + página de convites recebidos.
- **Validação**: `src/lib/validations/projetoConvite.ts` com Zod `.strict()` (email, papel enum, secoes_ids uuid[], mensagem opcional ≤ 500 chars).
- **Política Zero Public Exposure**: RPC `get_convite_by_token(_token uuid)` SECURITY DEFINER para a tela de aceite (retorna apenas nome do projeto, papel, e-mail mascarado, expiração). Sem SELECT anônimo na tabela.
- **Auditoria**: registrar em `security_audit_log` ações `projeto_convite_sent|accepted|declined|cancelled|expired`.
- **Job de expiração**: trigger ou cron simples (não bloqueante para MVP) que marca `expired` após `expires_at`.
- **E-mail**: usar fluxo transacional Lovable Emails. Se domínio ainda não configurado, o sistema funciona normalmente via link copiado e notificação interna; o agente oferece configurar depois.

---

### Fora do escopo (próximas iterações)

- Convite em massa (CSV).
- Convite com expiração customizável por usuário.
- Aprovação dupla (coordenador → admin).
- Convite por workspace (atalho para múltiplos projetos).
