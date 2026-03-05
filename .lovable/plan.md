

## Dados de Simulação para Testar o Modo Foco

Adicionar dados mock/demo diretamente no `TarefaFocusMode.tsx` para que a tela possa ser visualizada e testada mesmo sem dados reais no banco. Os dados simulados serão usados como fallback quando não houver dados reais.

### O que será adicionado

**Anexos simulados (6 itens)**:
- Briefing_HB-L6532.pdf (PDF, 2.4 MB)
- Rotulo_frente_v3.png (imagem, 1.1 MB)
- Ficha_Tecnica_final.pdf (PDF, 890 KB)
- Arte_embalagem.ai (arquivo, 5.2 MB)
- Laudo_estabilidade.pdf (PDF, 320 KB)
- Foto_amostra_01.jpg (imagem, 3.8 MB)

**Documentos no Cofre simulados (3 itens)**:
- Briefing_HB-L6532.pdf — categoria: briefing, status: aprovado
- Ficha_Tecnica_final.pdf — categoria: ficha_tecnica, status: ativo
- Laudo_estabilidade.pdf — categoria: laudo, status: ativo, visível fábrica

**Mensagens de chat simuladas (5 msgs)**: Conversa entre membros do time sobre aprovação de arte e revisão técnica.

**Comentários simulados (3 itens)**: Comentários sobre progresso da tarefa com @mentions.

**Marcos simulados (5 itens)**: 3 concluídos, 2 pendentes — para alimentar o gráfico de evolução.

### Mudança Técnica

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Editar | `src/components/projetos/TarefaFocusMode.tsx` | Adicionar constantes `MOCK_ANEXOS`, `MOCK_COFRE_DOCS`, `MOCK_MESSAGES`, `MOCK_COMENTARIOS` no topo. Usar `useMemo` para fazer merge: se os dados reais estiverem vazios, usar os mocks como fallback. Os mocks terão datas espalhadas nos últimos 30 dias para popular o gráfico de evolução. |

