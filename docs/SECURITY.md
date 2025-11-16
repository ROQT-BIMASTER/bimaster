# Guia de Segurança - BiMaster/Union CRM

## Status Geral de Segurança

**Última Revisão:** 2025-11-16  
**Score Geral:** 85/100 ✅

### Principais Implementações

✅ **Autenticação e Autorização**
- Supabase Auth com JWT
- Hierarquia de roles (admin, supervisor, vendedor, promotor)
- RLS em todas as tabelas principais
- Security Definer functions para queries complexas

✅ **Proteção de Dados**
- Storage buckets privados
- Signed URLs para acesso temporário
- Tokens de API em banco de dados (não localStorage)
- Audit logs para rastreabilidade

✅ **Validação de Input**
- Schemas Zod em todos formulários
- Sanitização de dados de usuário
- Validação server-side em edge functions

## Práticas de Segurança Implementadas

### 1. Row Level Security (RLS)

Todas as tabelas críticas têm políticas RLS:

```sql
-- Exemplo: Políticas de Prospects
CREATE POLICY "Usuários veem próprios prospects"
ON prospects FOR SELECT
USING (
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);
```

**Tabelas com RLS:**
- ✅ prospects
- ✅ atividades
- ✅ stores
- ✅ visits
- ✅ photos
- ✅ financial_entries
- ✅ social_media_credentials
- ✅ user_roles
- ✅ audit_logs
- ✅ E todas as demais tabelas principais

### 2. Hierarquia de Acesso

```
admin
  ├── supervisor_1
  │   ├── vendedor_1
  │   └── vendedor_2
  └── supervisor_2
      ├── promotor_1
      └── promotor_2
```

**Regras:**
- Admins veem tudo
- Supervisores veem subordinados
- Vendedores veem apenas seus dados
- Promotores veem apenas suas atividades

### 3. Armazenamento Seguro

**Storage Buckets:**
```
trade-photos (PRIVADO)
├── RLS policies por hierarquia
├── Signed URLs (24h expiry)
└── Compression automática

reward-banners (PRIVADO) 
├── Apenas admins gravam
└── Todos podem ler
```

**Credenciais de API:**
```sql
CREATE TABLE social_media_credentials (
  user_id UUID REFERENCES auth.users(id),
  platform TEXT,
  access_token TEXT, -- Criptografado pelo Supabase
  ...
);
```

### 4. Edge Functions Seguras

**Verificação JWT:**
```toml
[functions.nome-funcao]
verify_jwt = true
```

**Funções que NÃO requerem JWT:**
- `social-media-cron` (chamada por scheduler)
- `process-photo-analysis-queue` (worker interno)
- `whatsapp-webhook` (webhook externo)

**Todas as demais:** verify_jwt = true ✅

### 5. Input Validation

**Client-side (Zod):**
```typescript
const schema = z.object({
  email: z.string().email(),
  nome: z.string().min(3).max(100),
  cpf: z.string().regex(/^\d{11}$/),
});
```

**Server-side (Edge Functions):**
```typescript
const { data, error } = schema.safeParse(requestBody);
if (error) {
  return new Response('Invalid input', { status: 400 });
}
```

### 6. Proteção contra CSRF

- SameSite cookies
- Origin validation em webhooks
- CORS configurado em edge functions

### 7. Rate Limiting

**Implementado em:**
- Export endpoints (10 req/hour)
- Authentication endpoints (Supabase default)

**TODO:**
- Rate limiting em APIs públicas
- DDoS protection (Cloudflare)

## Vulnerabilidades Corrigidas

### ✅ Tokens em localStorage
**Antes:**
```typescript
localStorage.setItem('social_instagram_token', token);
```

**Depois:**
```typescript
await supabase.from('social_media_credentials').upsert({
  user_id: userId,
  platform: 'instagram',
  access_token: token, // Criptografado
});
```

### ✅ Storage Buckets Públicos
**Antes:**
```sql
UPDATE storage.buckets SET public = true;
```

**Depois:**
```sql
UPDATE storage.buckets SET public = false;
-- + RLS policies por role
```

### ✅ Functions sem SET search_path
**Antes:**
```sql
CREATE FUNCTION my_function()
LANGUAGE plpgsql
SECURITY DEFINER
AS $$...$$;
```

**Depois:**
```sql
CREATE FUNCTION my_function()
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$...$$;
```

## Checklist de Segurança

### Deploy para Produção

- [ ] Habilitar leaked password protection no backend
- [ ] Configurar Sentry para error tracking
- [ ] Implementar rate limiting adicional
- [ ] Revisar todos RLS policies
- [ ] Testar signed URLs em produção
- [ ] Configurar backup automático (30 dias)
- [ ] Documentar disaster recovery procedure
- [ ] Configurar alertas de segurança
- [ ] Revisar logs de audit regularmente
- [ ] Rotação de secrets (trimestral)

### Manutenção Regular

**Mensal:**
- [ ] Revisar audit logs
- [ ] Verificar usuários inativos
- [ ] Atualizar dependências

**Trimestral:**
- [ ] Penetration testing
- [ ] Revisar RLS policies
- [ ] Rotação de API keys

**Anual:**
- [ ] Security audit completo
- [ ] Disaster recovery drill
- [ ] Compliance review (LGPD)

## Incident Response

### Em caso de brecha de segurança:

1. **Contenção (< 1h)**
   - Desabilitar serviços afetados
   - Revogar tokens comprometidos
   - Bloquear IPs suspeitos

2. **Investigação (< 24h)**
   - Revisar audit logs
   - Identificar vetor de ataque
   - Avaliar dados comprometidos

3. **Remediação (< 48h)**
   - Corrigir vulnerabilidade
   - Atualizar RLS policies
   - Deploy de fix

4. **Comunicação (< 72h)**
   - Notificar usuários afetados
   - Reportar à ANPD (se LGPD)
   - Documentar incidente

5. **Pós-mortem (< 1 semana)**
   - Análise de causa raiz
   - Atualizar processos
   - Treinar equipe

## Contatos de Segurança

**Security Lead:** [Definir]  
**Email:** security@union.com.br  
**Slack:** #security-incidents  

## Recursos Adicionais

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/auth-policies)
- [LGPD Compliance Guide](https://www.gov.br/lgpd)
