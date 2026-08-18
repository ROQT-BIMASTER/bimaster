# Limpeza de controles duplicados (China / Pareceres)

Correções apenas de interface. Nenhuma regra de negócio, permissão, rota ou dado é alterada — risco zero para produção.

## O que foi confirmado no código

1. **Botão de fechar duplicado no painel de foco do item (China)**
   O painel lateral já traz um "X" nativo no canto superior direito e, além dele, um segundo "X" desenhado manualmente no cabeçalho. Aparecem os dois, colados, exatamente como na captura enviada.

2. **Mesmo problema no visualizador Antes/Depois do Trade**
   O mesmo padrão (X nativo + X manual) existe na tela de comparação de fotos.

3. **Abas "Pareceres / Comentários" repetidas**
   O painel de foco já tem as abas Documento / Pareceres / Comentários. Ao entrar em "Pareceres", o conteúdo interno renderiza **outra** barra de abas Pareceres / Comentários — duas navegações iguais, uma dentro da outra. Mesma coisa na aba Comentários.

4. **"Baixar" duplicado no anexo do parecer**
   Cada anexo de parecer tem o nome do arquivo já clicável para baixar e, ao lado, um menu "..." com o item "Baixar" — a mesma ação em dois lugares no mesmo chip.

5. **Envio de arquivo aparecendo duas vezes no fluxo de parecer**
   Na aba Documento existe "Substituir arquivo" e, na aba Pareceres, "Substituir com parecer" — ações diferentes com nomes quase idênticos, o que o time lê como duplicidade.

## Correções propostas

- Remover o "X" manual do cabeçalho do painel de foco e do visualizador Antes/Depois, mantendo só o fechar nativo (que já responde a Esc e clique fora).
- Suprimir a barra de abas interna quando o painel já está dentro de abas: o conteúdo passa a renderizar só a seção pedida (parecer ou comentários), sem repetir a navegação.
- No chip de anexo do parecer, manter o clique no nome como download e retirar o item "Baixar" do menu "...", que fica só com "Promover ao Checklist".
- Diferenciar os dois envios por rótulo e texto de apoio: na aba Documento, "Substituir arquivo (sem parecer)"; na aba Pareceres, "Substituir com parecer técnico". Nenhuma das duas ações é removida, pois têm efeitos distintos na trilha de auditoria.

## Detalhes técnicos

- `FlowItemFocusDrawer.tsx`: remover o `Button` com `title="Fechar"` do `SheetHeader` (o `SheetContent` já renderiza `SheetPrimitive.Close`); passar nova prop `hideTabs` ao `ChecklistItemAdminPanel` nas duas `TabsContent`.
- `ChecklistItemAdminPanel.tsx`: aceitar `hideTabs?: boolean`; quando verdadeiro, renderizar diretamente a seção de `defaultTab` sem `Tabs/TabsList`. Comportamento padrão inalterado para os demais consumidores (`ChecklistItemPainel`, `ChecklistItemAdminSheet`, `ChecklistC2BSheet`).
- `PareceresSubmissaoCard.tsx`: remover o `DropdownMenuItem` "Baixar"; se o anexo já estiver promovido e o menu ficar vazio, não renderizar o gatilho `MoreVertical`.
- `PhotoBeforeAfterView.tsx`: remover o botão `aria-label="Fechar"` manual (ou aplicar `hideClose` e manter o customizado — será mantido apenas um).
- Sem migração, sem alteração em hooks de dados, sem mudança em `uploadCore`.
- Bump de `APP_VERSION` com entrada correspondente no changelog em `ApiDocumentation.tsx`.

## Verificação

- Varredura para garantir que nenhum outro `DialogContent`/`SheetContent` sem `hideClose` traga um fechar manual (os lightboxes do chat já usam `[&>button]:hidden` e estão corretos).
- Conferência visual do painel de foco nas três abas e do chip de anexo do parecer.
