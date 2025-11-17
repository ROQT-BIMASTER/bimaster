# Guia de Testes

Este documento descreve a estratégia de testes do projeto e como executá-los.

## 📋 Índice

- [Stack de Testes](#stack-de-testes)
- [Executando Testes](#executando-testes)
- [Estrutura de Testes](#estrutura-de-testes)
- [Escrevendo Testes](#escrevendo-testes)
- [Boas Práticas](#boas-práticas)
- [Cobertura de Código](#cobertura-de-código)

## Stack de Testes

- **Vitest**: Framework de testes rápido e compatível com Vite
- **Testing Library**: Biblioteca para testes de componentes React
- **jsdom**: Ambiente DOM para testes
- **User Event**: Simulação de interações do usuário

## Executando Testes

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes com UI
npm run test:ui

# Gerar relatório de cobertura
npm run test:coverage
```

## Estrutura de Testes

```
src/
├── test/
│   ├── setup.ts              # Configuração global
│   └── utils/
│       └── test-utils.tsx    # Utilitários de teste
├── components/
│   └── __tests__/
│       └── Component.test.tsx
├── lib/
│   └── utils/
│       └── __tests__/
│           └── utility.test.ts
```

## Escrevendo Testes

### Testes Unitários

Teste funções e utilitários isoladamente:

```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/lib/formatters';

describe('formatCurrency', () => {
  it('deve formatar valor como moeda brasileira', () => {
    expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
  });

  it('deve lidar com valores negativos', () => {
    expect(formatCurrency(-1234.56)).toBe('-R$ 1.234,56');
  });
});
```

### Testes de Componentes

Teste componentes React com Testing Library:

```typescript
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils/test-utils';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('deve renderizar com texto', () => {
    renderWithProviders(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('deve chamar onClick quando clicado', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    renderWithProviders(<Button onClick={handleClick}>Click me</Button>);
    
    await user.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

### Testes de Integração

Teste fluxos completos da aplicação:

```typescript
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/utils/test-utils';
import { LoginForm } from '@/components/auth/LoginForm';

describe('LoginForm Integration', () => {
  it('deve fazer login com sucesso', async () => {
    const user = userEvent.setup();
    
    renderWithProviders(<LoginForm />);
    
    // Preencher formulário
    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'password123');
    
    // Submeter
    await user.click(screen.getByRole('button', { name: /entrar/i }));
    
    // Verificar resultado
    await waitFor(() => {
      expect(screen.getByText(/bem-vindo/i)).toBeInTheDocument();
    });
  });
});
```

## Boas Práticas

### 1. AAA Pattern (Arrange, Act, Assert)

```typescript
it('deve calcular total corretamente', () => {
  // Arrange: Preparar dados
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 },
  ];
  
  // Act: Executar ação
  const total = calculateTotal(items);
  
  // Assert: Verificar resultado
  expect(total).toBe(35);
});
```

### 2. Testes Descritivos

```typescript
// ❌ Ruim
it('teste 1', () => { ... });

// ✅ Bom
it('deve retornar erro quando email é inválido', () => { ... });
```

### 3. Isolar Dependências

Use mocks para isolar o código testado:

```typescript
import { vi } from 'vitest';

// Mock de serviço externo
vi.mock('@/services/api', () => ({
  fetchUser: vi.fn(() => Promise.resolve({ id: 1, name: 'John' })),
}));
```

### 4. Testar Comportamento, Não Implementação

```typescript
// ❌ Ruim: Testa detalhes de implementação
expect(component.state.isLoading).toBe(true);

// ✅ Bom: Testa comportamento observável
expect(screen.getByRole('progressbar')).toBeInTheDocument();
```

### 5. Usar Queries Corretas

```typescript
// Ordem de preferência (do melhor para o pior)

// 1. Queries acessíveis
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email/i)

// 2. Queries semânticas
screen.getByAltText(/profile picture/i)
screen.getByTitle(/close/i)

// 3. Test IDs (último recurso)
screen.getByTestId('custom-element')
```

### 6. Limpar Após Testes

```typescript
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
```

## Cobertura de Código

Mantemos uma meta de cobertura de código:

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

### Verificar Cobertura

```bash
npm run test:coverage
```

O relatório será gerado em `coverage/index.html`.

### Áreas Excluídas

Algumas áreas são excluídas da cobertura:

- Arquivos de configuração (`*.config.ts`)
- Arquivos de tipos (`*.d.ts`)
- Dados mockados (`mockData/`)
- Setup de testes (`test/`)
- Entry point (`main.tsx`)

## Debugging de Testes

### Modo Debug

```bash
# Executar teste específico em debug
npm test -- --reporter=verbose ComponentName
```

### Usar `screen.debug()`

```typescript
import { screen } from '@testing-library/react';

it('debug test', () => {
  renderWithProviders(<MyComponent />);
  
  // Imprime toda a árvore DOM
  screen.debug();
  
  // Imprime apenas um elemento
  screen.debug(screen.getByRole('button'));
});
```

### Testing Playground

```typescript
import { screen } from '@testing-library/react';

it('playground test', () => {
  renderWithProviders(<MyComponent />);
  
  // Abre UI interativa para explorar queries
  screen.logTestingPlaygroundURL();
});
```

## Recursos Adicionais

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Docs](https://testing-library.com/)
- [Testing Library Cheatsheet](https://testing-library.com/docs/react-testing-library/cheatsheet)
- [Common Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Dúvidas?** Consulte a documentação ou abra uma issue no repositório.
