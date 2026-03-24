

# Configurar Acesso de Modulos ao Ambiente do Processo

## Situacao Atual

- A tabela `process_modulos_despacho` ja gerencia modulos dinamicos (Composicao, Regulatorio, etc.) com ativacao/desativacao
- O componente `ProcessoAmbiente` aceita qualquer `moduloOrigem` como prop — nao valida se o modulo tem permissao de participar do processo
- O `ModulosDespachoManager` permite criar/ativar/desativar modulos, mas apenas para fins de despacho — nao controla quais acoes cada modulo pode executar dentro do processo

## O que sera feito

### 1. Adicionar colunas de controle na tabela `process_modulos_despacho`

Nova migration adicionando colunas booleanas que definem quais capacidades cada modulo tem dentro do ambiente do processo:

| Coluna | Tipo | Default | Descricao |
|--------|------|---------|-----------|
| `ambiente_habilitado` | boolean | true | Modulo pode acessar o Ambiente do Processo |
| `pode_ciencia` | boolean | true | Pode dar ciencia |
| `pode_aprovar` | boolean | true | Pode aprovar |
| `pode_rejeitar` | boolean | true | Pode rejeitar |
| `pode_juntada` | boolean | true | Pode juntar documentos |
| `pode_submeter` | boolean | true | Pode submeter |
| `pode_contestar` | boolean | true | Pode contestar |
| `pode_replicar` | boolean | true | Pode replicar |

### 2. Atualizar `ModulosDespachoManager` — UI de configuracao

Expandir a interface de gerenciamento existente para incluir:
- Toggle principal "Ambiente do Processo" (habilita/desabilita acesso total)
- Grid de checkboxes para cada acao permitida (ciencia, aprovar, rejeitar, juntada, submeter, contestar, replicar)
- Quando `ambiente_habilitado = false`, o grid de acoes fica desabilitado visualmente

### 3. Atualizar `ProcessoAmbiente` — respeitar configuracao

- Buscar configuracao do modulo via `useModulosDespacho` usando a `key` do `moduloOrigem`
- Se `ambiente_habilitado = false`: nao renderizar o componente (retorna null ou mensagem)
- Filtrar os botoes de acao: so exibir acoes onde a coluna correspondente e `true`
- Exemplo: se `pode_aprovar = false` para "composicao", o botao "Aprovar" nao aparece nesse modulo

### 4. Atualizar hook `useModulosDespacho`

- Incluir as novas colunas no tipo `ModuloDespacho`
- Criar helper `getModuleCapabilities(key)` que retorna as permissoes do modulo

## Fluxo resultante

```text
Admin configura no ModulosDespachoManager:
  Composicao INCI → Ambiente: ON | Ciencia ✓ | Aprovar ✓ | Rejeitar ✗ | Submeter ✓
  Design        → Ambiente: ON | Ciencia ✓ | Aprovar ✗ | Rejeitar ✗ | Submeter ✓
  Qualidade     → Ambiente: OFF (nao participa do processo)

Ao renderizar ProcessoAmbiente em cada modulo:
  - Composicao: mostra botoes Ciencia, Aprovar, Submeter (sem Rejeitar)
  - Design: mostra botoes Ciencia, Submeter (sem Aprovar/Rejeitar)
  - Qualidade: componente nao renderiza
```

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| Nova migration SQL | ALTER TABLE add columns |
| `src/hooks/useModulosDespacho.ts` | Tipo + helper |
| `src/components/processo/ModulosDespachoManager.tsx` | UI de permissoes |
| `src/components/processo/ProcessoAmbiente.tsx` | Filtrar acoes por config |

