

# Comunicação — Definir lados por papel (Diretoria vs Compras/Faturamento)

## Problema
Atualmente, o alinhamento das mensagens usa `isOwn` (se o usuário logado enviou). Isso causa confusão porque o lado muda dependendo de quem está visualizando.

## Solução
Trocar a lógica de alinhamento de `isOwn` para `msg.tipo`:
- **Diretoria** (`msg.tipo === "diretoria"`) → lado **direito**, bolha azul
- **Compras / Faturamento** (`msg.tipo === "usuario"`) → lado **esquerdo**, bolha cinza

## Alterações em `RevisaoChatPanel.tsx`

1. **Linha 464** — Alinhamento do container: trocar `isOwn` por `msg.tipo === "diretoria"`
2. **Linhas 475-476** — Cor da bolha: usar `msg.tipo === "diretoria"` para azul vs cinza
3. **Linhas 480-481** — Cor do reply quote: mesma lógica
4. **Linhas 489, 492, 496-500** — Cor do header/texto/badge/check: mesma lógica
5. **Linha 507** — Badge de insumo: ajustar
6. **Linha 530+** — Cor dos anexos: ajustar

A variável `isOwn` será substituída por `isDiretoria = msg.tipo === "diretoria"` em cada mensagem renderizada.

