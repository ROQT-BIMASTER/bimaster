
# Plano: Adicionar Opções de Cores de Fundo

## Objetivo
Permitir que os usuários escolham diferentes cores de fundo para o sistema, com opções de contraste pré-definidas.

## O que Será Adicionado

### Novas Opções de Fundo Disponíveis

| Nome | Cor de Fundo | Cor do Texto | Preview |
|------|--------------|--------------|---------|
| Branco (Padrão) | Branco puro | Escuro | Atual |
| Cinza Claro | Cinza suave | Escuro | Neutro elegante |
| Azul Gelo | Azul muito claro | Escuro | Profissional |
| Verde Menta | Verde muito suave | Escuro | Fresco |
| Lavanda | Lilás muito claro | Escuro | Suave |
| Creme | Bege claro | Escuro | Aconchegante |
| Modo Escuro | Escuro azulado | Claro | Para baixa luz |

### Nova Seção na Interface

Uma nova seção "Cor de Fundo" será adicionada ao componente de personalização de cores, exibindo as opções como botões visuais com preview da cor.

```text
+------------------------------------------+
|  Personalizar Cores do Sistema           |
+------------------------------------------+
|                                          |
|  Temas Predefinidos                      |
|  [Padrão] [Oceano] [Floresta] ...        |
|                                          |
|  ==> NOVA SEÇÃO <==                      |
|  Cor de Fundo                            |
|  [Branco] [Cinza] [Azul] [Verde] ...     |
|                                          |
|  Cores Personalizadas                    |
|  [...]                                   |
+------------------------------------------+
```

---

## Detalhes Técnicos

### Arquivo a Modificar
`src/components/configuracoes/PersonalizarCores.tsx`

### Alterações Previstas

1. **Adicionar array de opções de fundo** com cores HSL e foreground correspondente
2. **Criar nova seção na UI** para seleção de fundo
3. **Atualizar função `applyTheme`** para aplicar também `--card`, `--popover`, `--sidebar-background` (manter consistência visual)
4. **Salvar preferência de fundo** no localStorage junto com as outras cores
5. **Aplicar contraste automático** - cada opção de fundo terá o foreground adequado pré-definido

### Cores HSL Propostas
- Branco: `0 0% 100%` / foreground: `222 47% 11%`
- Cinza Claro: `220 14% 96%` / foreground: `222 47% 11%`
- Azul Gelo: `210 40% 98%` / foreground: `222 47% 11%`
- Verde Menta: `150 40% 97%` / foreground: `160 60% 10%`
- Lavanda: `260 30% 97%` / foreground: `260 50% 10%`
- Creme: `40 30% 96%` / foreground: `30 50% 10%`
- Modo Escuro: `222 47% 8%` / foreground: `220 14% 96%`
