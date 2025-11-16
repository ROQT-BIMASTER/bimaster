# Arquitetura do Sistema BiMaster/Union CRM

## Visão Geral

O BiMaster é uma aplicação web moderna de CRM e Trade Marketing construída com React, TypeScript e Supabase.

### Stack Tecnológica

**Frontend:**
- **React 18** - Framework UI principal
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS utility-first
- **Shadcn/UI** - Componentes UI acessíveis
- **React Router** - Roteamento client-side
- **TanStack Query** - Gerenciamento de estado server
- **Recharts** - Visualização de dados

**Backend (Lovable Cloud):**
- **Supabase** - Backend-as-a-Service
- **PostgreSQL** - Banco de dados principal
- **Supabase Auth** - Autenticação e autorização
- **Supabase Storage** - Armazenamento de arquivos
- **Edge Functions** - Serverless functions (Deno)
- **Row Level Security (RLS)** - Segurança no nível de linha

**Integrações:**
- Stripe para pagamentos
- Mapbox para mapas
- OpenAI para análises com IA
- APIs de redes sociais (Instagram, Facebook, etc.)

## Arquitetura de Pastas

```
src/
├── components/          # Componentes React
│   ├── ui/             # Componentes base (Shadcn)
│   ├── admin/          # Componentes de administração
│   ├── auth/           # Autenticação
│   ├── chat/           # Sistema de chat
│   ├── crm/            # CRM features
│   ├── dashboard/      # Dashboard principal
│   ├── kanban/         # Board Kanban
│   ├── marketing/      # Marketing & redes sociais
│   ├── prospects/      # Gestão de prospects
│   ├── relatorios/     # Relatórios
│   ├── trade/          # Trade marketing
│   └── whatsapp/       # Integração WhatsApp
├── hooks/              # Custom React hooks
├── lib/                # Utilitários e helpers
│   ├── utils/          # Funções utilitárias
│   └── validations/    # Schemas de validação (Zod)
├── pages/              # Páginas da aplicação
└── integrations/       # Integrações externas
    └── supabase/       # Cliente Supabase (auto-gerado)
```

## Fluxo de Dados

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                     │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐   ┌────────────┐ │
│  │  Components  │───▶│ React Query  │──▶│   Supabase │ │
│  │              │    │   (Cache)    │   │   Client   │ │
│  └──────────────┘    └──────────────┘   └────────────┘ │
│         │                                       │        │
│         │                                       ▼        │
│         │                            ┌──────────────────┐│
│         └───────────────────────────▶│   Local State    ││
│                                      │  (useState, etc) ││
│                                      └──────────────────┘│
└──────────────────────────────────────────┬───────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      ▼                      │
        ┌───────────┴───────────────────────────────────────┐    │
        │       LOVABLE CLOUD (Supabase Backend)            │    │
        │                                                    │    │
        │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │    │
        │  │ PostgreSQL │  │  Storage   │  │    Auth    │  │    │
        │  │    (RLS)   │  │  (Private) │  │    (JWT)   │  │    │
        │  └────────────┘  └────────────┘  └────────────┘  │    │
        │         │               │               │         │    │
        │         └───────────────┴───────────────┘         │    │
        │                         │                         │    │
        │                ┌────────▼────────┐                │    │
        │                │  Edge Functions │                │    │
        │                │  (Serverless)   │                │    │
        │                └─────────────────┘                │    │
        └────────────────────────────────────────────────────┘    │
                                                                  │
                    ┌─────────────────────────────────────────────┘
                    │
        ┌───────────▼─────────────────┐
        │  EXTERNAL APIs              │
        ├─────────────────────────────┤
        │  - Stripe (Payments)        │
        │  - OpenAI (AI Analysis)     │
        │  - Mapbox (Maps)            │
        │  - Social Media APIs        │
        └─────────────────────────────┘
```

## Segurança

### Autenticação
- JWT tokens gerenciados pelo Supabase Auth
- Sessions persistentes em localStorage
- Auto-refresh de tokens
- Offline support com cache validado

### Autorização
- **Hierarquia de Roles:**
  1. **admin** - Acesso total ao sistema
  2. **supervisor** - Gerencia equipe e vê subordinados
  3. **vendedor** - Gestão de prospects e visitas
  4. **promotor** - Execução de atividades de trade

- **Row Level Security (RLS):**
  - Todas tabelas principais têm RLS habilitado
  - Políticas baseadas em roles e hierarquia
  - Security Definer functions para queries complexas

### Dados Sensíveis
- Tokens de APIs armazenados em tabela `social_media_credentials`
- Storage buckets privados com políticas RLS
- Signed URLs para acesso temporário a arquivos
- Audit logs para rastreabilidade

## Performance

### Otimizações de Build
- Code splitting por vendor (react, ui, supabase, charts)
- Tree shaking automático
- Terser para minificação
- Remoção de console.logs em produção
- Source maps ocultos em produção

### Cache
- TanStack Query para cache de dados
- Service Worker para assets estáticos
- IndexedDB para dados offline
- Cache de permissões no cliente

### Bundle Size
- Target: < 500KB initial bundle
- Lazy loading de rotas pesadas
- Componentes UI code-split
- Imagens otimizadas (webp quando possível)

## Offline Support

### PWA Features
- Service Worker com Workbox
- Cache de assets estáticos
- NetworkFirst para APIs
- CacheFirst para imagens e storage
- Sincronização quando online

### Dados Offline
- IndexedDB para operações CRUD
- Queue de sincronização
- Detecção de conflitos
- UI feedback de status de sync

## Monitoramento

### Logging
- Sistema estruturado com níveis (debug, info, warn, error)
- Contexto de usuário e componente
- Performance tracking
- Conditional logging (dev vs prod)

### Error Tracking
- ErrorBoundary global para React errors
- Tratamento centralizado de erros Supabase
- Mensagens amigáveis para usuários
- Stack traces em desenvolvimento

### Métricas (Planejado)
- Sentry para error tracking
- Google Analytics para uso
- Performance monitoring
- Uptime monitoring

## Deploy

### Pipeline CI/CD
- GitHub Actions (planejado)
- Testes automatizados em PR
- Deploy automático para preview
- Deploy manual para produção

### Ambientes
- **Development:** Local com hot-reload
- **Preview:** Branches do Git
- **Production:** Branch main

## Manutenção

### Database Migrations
- SQL migrations versionadas
- Supabase CLI para deploy
- Backup automático
- Rollback procedures

### Secrets Management
- Lovable Cloud Secrets para chaves
- Variáveis de ambiente
- Rotação de secrets (manual)

### Monitoring
- Health checks em edge functions
- Database performance metrics
- Storage usage tracking
