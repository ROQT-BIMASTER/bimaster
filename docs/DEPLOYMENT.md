# Guia de Deploy - BiMaster/Union CRM

## Pré-requisitos

- Conta Lovable Cloud ativa
- Git configurado
- Node.js 18+ (para desenvolvimento local)

## Deploy Automático (Lovable Cloud)

A aplicação é automaticamente deployada via Lovable Cloud:

1. **Push para Git**
   ```bash
   git add .
   git commit -m "feat: sua feature"
   git push origin main
   ```

2. **Build Automático**
   - Lovable Cloud detecta o push
   - Executa build via Vite
   - Deploy de edge functions
   - Migra banco de dados (se houver migrations)

3. **Preview URL**
   - Cada branch tem URL de preview
   - Branches são deployadas automaticamente
   - Preview persiste até merge

4. **Production URL**
   - Branch `main` é produção
   - URL: `https://seu-projeto.lovableproject.com`

## Variáveis de Ambiente

Configuradas automaticamente pela Lovable Cloud:

```env
VITE_SUPABASE_PROJECT_ID=xxx
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=xxx
```

### Secrets (via Lovable Cloud)

Secrets são gerenciados pela plataforma:

```
LOVABLE_API_KEY          # IA endpoints
OPENAI_API_KEY           # Análise com GPT
MAPBOX_ACCESS_TOKEN      # Mapas
STRIPE_SECRET_KEY        # Pagamentos
CNPJBIZ_API_KEY          # Consulta CNPJ
```

**Adicionar Secret:**
1. Lovable Cloud → Settings → Secrets
2. Add New Secret
3. Nome e valor
4. Salvar

## Edge Functions

### Deploy Manual

Caso precise deployar edge functions manualmente:

```bash
# Via Lovable Cloud UI
# Functions são auto-deployed com o código
```

### Logs de Edge Functions

```bash
# Ver logs via Lovable Cloud UI
# Ou via Supabase CLI:
supabase functions logs nome-funcao --project-ref SEU_PROJECT_ID
```

## Database Migrations

### Criar Migration

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_nome_migration.sql
CREATE TABLE nova_tabela (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);
```

### Aplicar Migration

Via Lovable Cloud:
1. Push código com migration
2. Migration é aplicada automaticamente no deploy

### Rollback

```sql
-- Criar migration de rollback manual
DROP TABLE IF EXISTS nova_tabela;
```

## Configurações de Produção

### Backend (Supabase)

**Auth Settings:**
- ✅ Auto-confirm email: HABILITADO
- ✅ Leaked password protection: HABILITADO
- ✅ MFA: DISPONÍVEL (opcional para usuários)

**Database:**
- ✅ Connection pooling: HABILITADO
- ✅ Backup automático: 30 dias
- ✅ Point-in-time recovery: 7 dias

**Storage:**
- ✅ Buckets privados
- ✅ Signed URLs (24h expiry)
- ✅ Compression automática

### Frontend

**Otimizações:**
- ✅ Code splitting por vendor
- ✅ Tree shaking
- ✅ Minificação (Terser)
- ✅ Source maps ocultos
- ✅ console.log removido

**PWA:**
- ✅ Service Worker
- ✅ Offline support
- ✅ Install prompt
- ✅ Cache strategy

## Monitoramento

### Health Checks

**Endpoints:**
- `GET /` - Frontend health
- `GET /api/health` - Backend health (TODO)

**Métricas:**
- Uptime
- Response time
- Error rate
- User count

### Logs

**Frontend:**
- Sentry para errors (TODO)
- Console logs apenas em dev

**Backend:**
- Edge function logs via Lovable Cloud
- Database logs via Supabase
- Audit logs na tabela `audit_logs`

## Performance

### Bundle Size

**Target:** < 500KB initial bundle

**Análise:**
```bash
npm run build
npx vite-bundle-visualizer
```

**Otimizações:**
- Lazy loading de rotas
- Code splitting por vendor
- Dynamic imports para componentes pesados

### Lighthouse Score

**Target:** > 90

**Métricas:**
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 100

## Troubleshooting

### Build Falha

```bash
# Limpar cache
rm -rf node_modules dist
npm install
npm run build
```

### Edge Function Falha

1. Ver logs em Lovable Cloud
2. Verificar secrets configurados
3. Testar localmente (se possível)
4. Verificar verify_jwt em config.toml

### Migration Falha

1. Ver logs em Lovable Cloud
2. Verificar SQL syntax
3. Testar migration localmente:
   ```bash
   supabase db reset
   supabase db push
   ```

### Performance Issues

1. Analisar bundle size
2. Verificar queries lentas (database logs)
3. Revisar cache strategy
4. Otimizar imagens

## Rollback de Deploy

### Rollback Completo

```bash
# Via Git
git revert HEAD
git push origin main
# Lovable Cloud faz deploy automático
```

### Rollback de Database

```bash
# Via Supabase Dashboard
# Restore point-in-time backup (últimos 7 dias)
```

## Disaster Recovery

### Backup Manual

```bash
# Exportar database
supabase db dump > backup.sql

# Exportar storage
# Via Supabase Dashboard → Storage → Export
```

### Restore

```bash
# Importar database
psql -h db.xxx.supabase.co -U postgres -f backup.sql

# Importar storage
# Via Supabase Dashboard → Storage → Import
```

### Procedure Completa

1. **Identificar problema** (< 15min)
2. **Avaliar impacto** (< 30min)
3. **Decidir restore vs fix** (< 1h)
4. **Executar restore** (< 2h)
5. **Validar** (< 30min)
6. **Comunicar usuários** (< 1h)

## Checklist de Deploy

### Pre-Deploy

- [ ] Todos testes passando
- [ ] Lint sem erros
- [ ] TypeScript sem erros
- [ ] Bundle size < 500KB
- [ ] Lighthouse score > 90
- [ ] Migrations testadas localmente
- [ ] Secrets configurados
- [ ] RLS policies revisadas

### Deploy

- [ ] Push para branch
- [ ] Verificar build bem-sucedido
- [ ] Testar preview URL
- [ ] Smoke test (login, navegação básica)
- [ ] Verificar edge functions
- [ ] Verificar migrations aplicadas

### Post-Deploy

- [ ] Monitorar logs (1h)
- [ ] Verificar error rate
- [ ] Testar fluxos críticos
- [ ] Notificar equipe
- [ ] Documentar mudanças
- [ ] Atualizar CHANGELOG

## Contatos

**DevOps:** [Definir]  
**Support:** support@union.com.br  
**Emergency:** [Definir]  
**Slack:** #deploy-notifications
