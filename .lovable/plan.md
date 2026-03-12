

## Melhorias para a tela "Vincular Envio China"

Analisando a imagem, identifiquei os seguintes problemas e oportunidades:

### Problemas atuais
1. **Submissão com dados nulos** — a primeira linha mostra "null" como código e nome em branco, poluindo a lista
2. **Badges de status sem cor** — todos os status (rascunho, enviado, em_revisao, aprovado, arte_enviada) usam o mesmo estilo `outline` cinza, dificultando leitura rápida
3. **Painel direito ocioso** — quando nenhuma submissão está selecionada, mostra apenas texto vazio; espaço desperdiçado
4. **Vínculos Existentes vazio sem contexto** — seção inferior sempre visível mesmo sem dados, ocupa espaço
5. **Sem indicação visual do projeto selecionado no dropdown** — difícil saber se o projeto combina com a submissão
6. **Sem filtro por status** — não é possível filtrar submissões por rascunho/enviado/aprovado

### Plano de melhorias

**1. Filtrar submissões com dados inválidos e adicionar filtro por status**
- Ocultar submissões com `produto_codigo` ou `produto_nome` nulo/vazio da lista
- Adicionar chips de filtro por status acima da busca (Todos, Rascunho, Enviado, Em Revisão, Aprovado, Arte Enviada)

**2. Badges de status coloridos**
- `rascunho` → cinza (secondary)
- `enviado` → azul
- `em_revisao` → amarelo/amber
- `aprovado` → verde
- `arte_enviada` → roxo
- `rejeitado` → vermelho (destructive)

**3. Painel direito com resumo da submissão selecionada**
- Quando uma submissão é selecionada mas nenhum projeto escolhido, mostrar um resumo compacto: código, nome, fórmula, EANs, pesos, quantidades
- Isso dá contexto antes de vincular

**4. Ocultar "Vínculos Existentes" quando vazio**
- Mostrar a seção apenas quando houver vínculos, ou colapsar por padrão

**5. Contadores no header**
- Mostrar contadores: "8 submissões | 3 vinculadas" no header da lista esquerda

### Arquivos a modificar
- `src/pages/ProjetoVincularChina.tsx` — todas as melhorias acima

