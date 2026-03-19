

## Plano: Exibir Detalhes Completos nos Despachos + Cronômetro de Ciência

### Problema
A lista de despachos mostra apenas nome do documento e status. Falta:
1. Para quem foi despachado (usuário/módulo destino)
2. Fase do fluxo (etapa atual vs total de etapas)
3. Percentual de conclusão
4. Cronômetro contando tempo desde a ciência do usuário

### Alterações

#### 1. Migração: adicionar campo `despachado_para_nome` na tabela
- Adicionar `despachado_para_nome TEXT` em `process_despacho_documento` para armazenar o nome do destinatário no momento do despacho

#### 2. Atualizar hook `useDespachoDocumentos.ts`
- Expandir a interface `DespachoDocumento` com os campos já existentes (`ciencia_em`, `ciencia_por_nome`, `prazo_ciencia_horas`, `modulo_destino`) e o novo `despachado_para_nome`
- No `useCriarDespachoLote`, gravar `despachado_para_nome` ao criar o despacho
- Criar hook `useDarCiencia` que atualiza `ciencia_em`, `ciencia_por`, `ciencia_por_nome` e registra uma transição

#### 3. Redesenhar `DespachosPanel.tsx` — linha expandida
Cada item na lista passará a exibir:
- **Destinatário**: ícone de usuário + nome (`despachado_para_nome`) e badge do módulo destino (`modulo_destino`)
- **Fase do fluxo**: indicador visual "Etapa X de Y" usando `etapa_atual` do despacho e total de etapas do workflow config (se vinculado). Se não houver workflow, mostrar fase textual baseada no status
- **Barra de progresso**: percentual calculado como `(etapa_atual / total_etapas) * 100` ou mapeamento fixo por status (pendente=0%, em_analise=50%, aprovado=100%, rejeitado=100%)
- **Cronômetro de ciência**: quando `ciencia_em` estiver preenchido, exibir tempo decorrido formatado (ex: "2h 30min", "3d 5h", "1m 12d") com atualização a cada minuto via `setInterval`
- **Botão "Dar Ciência"**: visível quando `ciencia_em` é null; ao clicar, registra a ciência e inicia o cronômetro

#### 4. Componente auxiliar `CienciaTimer`
- Componente que recebe `ciencia_em: string` e calcula o tempo decorrido
- Usa `useEffect` com `setInterval` de 60s para atualizar
- Formata em "Xh Ymin", "Xd Yh", "Xm Xd" conforme magnitude

### Arquivos a Modificar
- **Nova migração**: Adicionar `despachado_para_nome` à tabela
- `src/hooks/useDespachoDocumentos.ts` — Expandir interface, criar `useDarCiencia`
- `src/components/processo/DespachosPanel.tsx` — Redesenhar cards com destinatário, fase, progresso e cronômetro

