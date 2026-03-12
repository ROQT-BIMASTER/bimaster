

## Plano: Painel de detalhes do membro ao clicar

Ao clicar em um membro na hierarquia ou no ranking, abrir um **Sheet** (painel lateral direito) com visual premium contendo:

### Layout do painel

1. **Header**: Foto grande (120px, circular) centralizada com overlay de upload, nome em destaque, badge de cargo com alto contraste, email
2. **KPIs em grid 2x2**: Projetos ativos, Tarefas concluídas, Tarefas atrasadas, Taxa de conclusão (com Progress bar circular ou linear)
3. **Score de produtividade**: Destaque visual com ícone de troféu e pontuação
4. **Barra de progresso geral**: Taxa de conclusão com label

### Implementação

**Arquivo:** `src/pages/ProjetosMinhaEquipe.tsx`

- Adicionar estado `selectedMember: ProjetoTeamMember | null`
- Importar `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` de `@/components/ui/sheet`
- Tornar as linhas da hierarquia e do ranking clicáveis (cursor-pointer, `onClick` → `setSelectedMember`)
- Criar componente `MemberDetailSheet` que recebe o membro selecionado e renderiza:
  - Avatar grande (h-28 w-28) centralizado com `AvatarWithUpload` (novo size `"lg"`)
  - Nome + badge de cargo
  - Grid de métricas com ícones coloridos e valores grandes
  - Barra de progresso da taxa de conclusão
  - Score com destaque visual
- Restringir abertura do painel a admin/gerente/supervisor (conforme solicitado: "para o Gerente ao clicar")

**Componente `AvatarWithUpload`**: adicionar suporte a `size="lg"` com classes `h-28 w-28` e ícone `h-7 w-7`.

