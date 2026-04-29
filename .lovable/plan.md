## Diagnóstico

Os elementos que piscam na Central de Trabalho usam a classe utilitária `animate-pulse` do Tailwind, cujo ciclo padrão é de 2 segundos — o usuário percebe como rápido demais. Os pontos atuais são:

- `src/components/projetos/central/CentralKPIs.tsx` (linhas 91 e 116) — KPI "Sem prazo" e correlato
- `src/components/projetos/central/MinhasTarefasContent.tsx` (linha 115) — badge de aviso na lista
- `src/components/projetos/central/HojeTab.tsx` (linhas 56 e 157) — badge e ícone "sem prazo"

## Mudança proposta

1. **Adicionar uma nova animação mais lenta** em `tailwind.config.ts`:
   - Reaproveitar o keyframe `pulse-soft` já existente.
   - Criar `"pulse-slow": "pulse-soft 4s ease-in-out infinite"` (dobro do tempo atual, suave).

2. **Substituir `animate-pulse` por `animate-pulse-slow`** apenas nos cinco pontos acima da Central de Trabalho. Nenhuma outra tela é alterada.

## Não escopo

- Sem mudanças em lógica, dados, layout ou cores.
- Sem alterar animações em outras áreas do app que continuam usando `animate-pulse` (skeletons, etc.).

## Verificação

- Recarregar `/dashboard/projetos/central`: o KPI "Sem prazo" e os badges piscam com cadência claramente mais lenta (~4s por ciclo) e suave, sem sumir totalmente.
