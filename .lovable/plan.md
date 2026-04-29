Vou ajustar a tela de Checklist para que os botões de editar e excluir campos fiquem claramente visíveis e utilizáveis.

Plano:
1. Ajustar o cabeçalho das colunas do checklist para exibir ações em um bloco visível, com ícones maiores e área de clique mais clara.
2. Garantir que os botões não fiquem escondidos por cor, contraste, largura da coluna ou sobreposição do texto.
3. Manter a regra atual: usuários sem permissão de edição continuam sem ver os botões.
4. Validar visualmente o componente após a alteração, especialmente na tabela horizontal do checklist.

Detalhes técnicos:
- Alterar `src/components/china/ChecklistEmbalagensTable.tsx`.
- Trocar os botões pequenos absolutos no canto do cabeçalho por controles mais explícitos dentro do próprio cabeçalho da coluna.
- Não alterar banco de dados nem regras de permissão.