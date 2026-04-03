

# Itens em Revisão — Layout Tabela Desktop

## Problema
A listagem atual usa cards empilhados verticalmente, ocupando muito espaço e dificultando a varredura rápida de dados. Para desktop, um formato de tabela/planilha é mais eficiente e profissional.

## Proposta

Substituir a lista de `RevisaoGastosCard` no modo "Lista" por uma **tabela de alta densidade** com todas as informações e ações inline, mantendo os cards apenas para mobile.

### Layout da Tabela

```text
| Tipo     | Fornecedor / Item       | Prioridade | Status       | Valor Atual    | Meta Redução   | Prazo      | Ações          |
|----------|-------------------------|------------|--------------|----------------|----------------|------------|----------------|
| Reduzir  | ROYALTIES               | Média      | Em Andamento | R$ 121.325,82  | 20% / R$ 24k   | 30/03 (4d) | ✓  ✎  🗑      |
| Monitorar| FABULOUS COSMETICOS     | Média      | Em Andamento | R$ 934.860,69  | —              | 29/01      | ✓  +  ✎  🗑   |
```

### Detalhes da Implementação

| Arquivo | Mudança |
|---|---|
| `src/components/financeiro/PlanoReducaoGastos.tsx` | No modo "lista", renderizar tabela no desktop (`hidden md:block`) e manter cards no mobile (`md:hidden`). Remover seletor "Visualização" (os 3 modos ficam como tabs ou se simplifica para tabela única). |

### Colunas da tabela:
1. **Tipo** — badge colorido com ícone (Reduzir, Eliminar, etc.)
2. **Fornecedor / Item** — nome principal + fornecedor em subtitle
3. **Prioridade** — dot colorido + label
4. **Status** — badge com ícone
5. **Valor Atual** — formatado BRL
6. **Meta Redução** — percentual + valor absoluto (quando aplicável)
7. **Prazo** — data + indicador de dias restantes/vencido
8. **Ações** — botões icon-only: Concluir, Editar, Eventos (+), Deletar

### Interações:
- Clicar na linha expande detalhes inline (fornecedor, documento, empresa) em uma sub-row
- Ações mantêm a mesma lógica atual (`onUpdateStatus`, `onDelete`)
- Sorting nativo nas colunas Valor, Prazo, Prioridade
- Reutilizar `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell` do design system

### Mobile:
- Abaixo de `md`, exibir os `RevisaoGastosCard` compactos existentes (já funcionam bem em tela pequena)

