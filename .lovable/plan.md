
# Drill-Down Interativo na Tabela Whitespace

## O que vai mudar

Ao clicar em uma linha da tabela de municipios, abre um painel lateral (Sheet) com 3 niveis de exploracao progressiva:

### Nivel 1 - Detalhe do Municipio (abre ao clicar na linha)
Painel lateral mostrando:
- **Cabecalho**: Nome do municipio, UF, populacao, PIB per capita
- **Contexto da Microrregiao**: Card com nome da microrregiao, penetracao atual (barra visual), total de municipios vs ativos
- **Score de Expansao**: Destaque visual grande com o score e explicacao dos fatores
- **Lista de Clientes Vizinhos**: Tabela com os clientes ativos na mesma microrregiao (nome, cidade, telefone, email, ultima compra, valor). Cada cliente e clicavel

### Nivel 2 - Clicou em um cliente vizinho
Abre o **Cliente 360** (componente que ja existe no projeto), reutilizando o `Cliente360Drawer` existente. Mostra perfil de credito, historico de pagamentos, score e alertas do cliente selecionado.

### Fluxo visual

```text
Tabela Whitespace
  |
  |--> [clica linha] --> Sheet: Detalhe do Municipio
                            |
                            |--> Dados do municipio + score
                            |--> Lista clientes vizinhos (microrregiao)
                                   |
                                   |--> [clica cliente] --> Sheet: Cliente 360
```

## Detalhes Tecnicos

### 1. Novo componente: `WhitespaceMunicipioSheet.tsx`
- Recebe o `WhitespaceRow` selecionado
- Usa `Sheet` (side panel) com `ScrollArea`
- Faz query para buscar clientes da mesma microrregiao:
  ```
  SELECT codigo, nome, cidade, uf, telefone, celular, email,
         data_ultima_compra, valor_ultima_compra, status_bloqueio
  FROM clientes
  JOIN ibge_municipios ON clientes.ibge_municipio_id = ibge_municipios.id
  WHERE ibge_municipios.microrregiao_id = [microrregiao_id do municipio]
  ORDER BY data_ultima_compra DESC
  ```
- Cada cliente na lista mostra: nome, cidade, telefone clicavel (tel:), email clicavel (mailto:), data/valor da ultima compra
- Botao "Ver 360" em cada cliente que abre o Cliente360Drawer

### 2. Modificar `WhitespaceTable.tsx`
- Adicionar estado `selectedRow` e handler `onClick` nas linhas
- Linhas ganham `cursor-pointer` e hover highlight
- Ao clicar, abre o `WhitespaceMunicipioSheet`

### 3. Integrar `Cliente360Drawer`
- Reutilizar o componente existente (`src/components/financeiro/cliente360/Cliente360Drawer.tsx`)
- Gerenciar estado de qual cliente esta aberto no nivel da pagina

### 4. Modificar `WhitespaceAnalysis.tsx`
- Adicionar estados para municipio selecionado e cliente 360
- Passar callbacks para a tabela e o sheet

### Arquivos novos (1)
- `src/components/comercial/whitespace/WhitespaceMunicipioSheet.tsx`

### Arquivos modificados (2)
- `src/components/comercial/whitespace/WhitespaceTable.tsx` - Adicionar clique nas linhas
- `src/pages/WhitespaceAnalysis.tsx` - Gerenciar estados dos paineis e integrar os componentes Sheet + Cliente360
