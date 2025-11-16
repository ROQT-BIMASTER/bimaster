# Guia de Contribuição - BiMaster/Union CRM

## Bem-vindo!

Obrigado por considerar contribuir para o BiMaster! Este guia ajudará você a configurar seu ambiente e entender nosso processo de desenvolvimento.

## Código de Conduta

- Seja respeitoso e profissional
- Aceite críticas construtivas
- Foque no que é melhor para a comunidade
- Mostre empatia com outros contribuidores

## Começando

### 1. Fork e Clone

```bash
# Fork via GitHub UI, depois:
git clone https://github.com/SEU-USERNAME/bimaster.git
cd bimaster
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Environment

```bash
# Copiar .env.example
cp .env.example .env

# Preencher com valores de desenvolvimento
# (solicitar ao time se precisar)
```

### 4. Rodar Localmente

```bash
npm run dev
# App estará em http://localhost:8080
```

## Estrutura do Projeto

```
src/
├── components/      # Componentes React reutilizáveis
│   ├── ui/         # Componentes base (Shadcn)
│   └── feature/    # Componentes de features
├── hooks/          # Custom React hooks
├── lib/            # Utilitários e helpers
│   ├── utils/      # Funções utilitárias
│   └── validations/# Schemas Zod
├── pages/          # Páginas da aplicação
└── integrations/   # Integrações externas
    └── supabase/   # Cliente Supabase (auto-gerado)

docs/               # Documentação
supabase/           # Backend
├── functions/      # Edge functions
└── migrations/     # SQL migrations
```

## Workflow de Desenvolvimento

### 1. Criar Branch

```bash
# Partir de main atualizado
git checkout main
git pull origin main

# Criar branch feature
git checkout -b feat/nome-da-feature

# Ou branch de fix
git checkout -b fix/nome-do-bug
```

### 2. Fazer Mudanças

```typescript
// Adicionar código
// Seguir style guide
// Adicionar testes (TODO)
```

### 3. Commit

```bash
# Seguir Conventional Commits
git commit -m "feat: adicionar filtro de data no dashboard"
git commit -m "fix: corrigir crash ao abrir modal de prospect"
git commit -m "docs: atualizar guia de contribuição"
```

**Tipos de Commit:**
- `feat`: Nova feature
- `fix`: Bug fix
- `docs`: Documentação
- `style`: Formatação (não afeta código)
- `refactor`: Refatoração
- `perf`: Performance
- `test`: Testes
- `chore`: Manutenção

### 4. Push e Pull Request

```bash
git push origin feat/nome-da-feature
```

Depois, criar PR no GitHub com:
- Título descritivo
- Descrição clara das mudanças
- Screenshots (se UI)
- Checklist de review

## Style Guide

### TypeScript

```typescript
// ✅ BOM
interface User {
  id: string;
  name: string;
  email: string;
}

function getUserName(user: User): string {
  return user.name;
}

// ❌ RUIM
function getUserName(user: any) {
  return user.name;
}
```

### React Components

```typescript
// ✅ BOM
import { Button } from '@/components/ui/button';

export function MyComponent() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <Button onClick={() => setCount(count + 1)}>
        Contador: {count}
      </Button>
    </div>
  );
}

// ❌ RUIM
export default function MyComponent() {
  let count = 0; // Não usar variáveis soltas
  
  return <div>...</div>;
}
```

### Naming Conventions

```typescript
// Componentes: PascalCase
export function UserProfile() {}

// Funções: camelCase
function formatCurrency() {}

// Constantes: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Interfaces: PascalCase com "I" opcional
interface IUser {}
interface User {}  // Preferido
```

### Imports

```typescript
// Ordem de imports:
// 1. External
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';

// 3. Types
import type { User } from '@/types';
```

### Error Handling

```typescript
// ✅ BOM
import { handleError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

try {
  await supabase.from('users').insert(data);
  logger.info('User created', { userId: data.id });
} catch (error) {
  const message = handleError(error);
  toast.error(message);
}

// ❌ RUIM
try {
  await supabase.from('users').insert(data);
  console.log('User created'); // Não usar console
} catch (error: any) {
  alert(error.message); // Não usar alert
}
```

### Performance

```typescript
// ✅ BOM
const memoizedValue = useMemo(() => expensiveCalculation(), [deps]);
const callback = useCallback(() => { /* ... */ }, [deps]);

// ❌ RUIM
const value = expensiveCalculation(); // Re-calcula todo render
```

## Testing (TODO)

```typescript
// Testes unitários com Vitest
import { describe, it, expect } from 'vitest';

describe('formatCurrency', () => {
  it('formata valores em BRL', () => {
    expect(formatCurrency(1000)).toBe('R$ 1.000,00');
  });
});
```

## Database Migrations

### Criar Migration

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_nome.sql
CREATE TABLE nova_tabela (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE nova_tabela ENABLE ROW LEVEL SECURITY;

-- Criar política
CREATE POLICY "Users see own records"
ON nova_tabela FOR SELECT
USING (auth.uid() = user_id);
```

### Guidelines

- Sempre incluir RLS policies
- Usar `IF NOT EXISTS` quando apropriado
- Incluir indexes para foreign keys
- Documentar mudanças complexas

## Edge Functions

### Criar Edge Function

```typescript
// supabase/functions/minha-funcao/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Sua lógica aqui
    const data = await req.json();
    
    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## Review Process

### O que os reviewers vão verificar:

- [ ] Código segue style guide
- [ ] TypeScript types corretos
- [ ] Error handling adequado
- [ ] Performance considerada
- [ ] UI responsiva (se aplicável)
- [ ] Acessibilidade (se aplicável)
- [ ] Documentação atualizada
- [ ] Migrations testadas
- [ ] RLS policies corretas

### Como ser um bom reviewer:

- Seja construtivo e educado
- Explique o "porquê" das sugestões
- Aprove quando estiver bom o suficiente
- Não seja perfeccionista demais

## Dúvidas?

- **Chat:** Slack #dev-team
- **Email:** dev@union.com.br
- **Issues:** GitHub Issues

## Recursos

- [React Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## Agradecimentos

Obrigado por contribuir! 🎉
