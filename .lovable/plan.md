

# Plano: Devolução de Etapa com Senha e Rastreabilidade

## Conceito

Criar um componente reutilizável **`DevolucaoEtapaDialog`** que qualquer módulo pode usar para devolver um item à etapa anterior. O dialog exige **senha do usuário** + **justificativa obrigatória** + **seleção da etapa destino**, e registra tudo no histórico/auditoria.

## Componente: `DevolucaoEtapaDialog`

Baseado no padrão existente do `PasswordConfirmDialog`, mas específico para devoluções:

- **Select de etapa destino** (lista apenas etapas anteriores à atual)
- **Justificativa obrigatória** (Textarea)
- **Senha do usuário** (verificada via `signInWithPassword`)
- **Ícone visual**: `RotateCcw` (já usado em FluxoAprovacaoDetalhe)
- Cor de destaque: `amber` (padrão de "atenção")

O `onConfirm` retorna: `{ etapaDestino, justificativa, userInfo: { id, email, nome } }`

## Integração por Módulo

### 1. Motor de Artes (`useFluxoArtesMotor.ts`)
- Nova mutation `useDevolverEtapaArte` — recebe `etapa_destino`, grava no `historico[]` com `acao: "devolucao"`, incrementa `numero_rodada`, seta `status_geral: "devolvido"`
- Botão "Devolver" no `FluxoArtesDetalhe.tsx` ao lado dos botões de aprovar/reprovar

### 2. Etiqueta Bula (`useEtiquetaBula.ts`)
- Nova mutation `useDevolverEtapaBula` — mesma lógica, grava em `aprovacoes[]` e `historico[]`
- Botão no detalhe da etiqueta

### 3. Fluxo Aprovação de Artes (`useFluxoAprovacaoArtes.ts`)
- Já tem `useReprovarEtapa` — adicionar `useDevolverEtapa` separado com senha obrigatória (reprovar ≠ devolver)
- Botão "Devolver para Ajuste" no `FluxoAprovacaoDetalhe.tsx`

### 4. Análise Embalagem (`useAnaliseEmbalagem.ts`)
- Nova mutation para devolução com registro no campo de aprovações
- Botão no painel de análise

### 5. Recebimento Amostra (`useAmostras.ts`)
- Nova mutation — devolve para etapa de envio com instrução
- Botão no painel de amostra

### 6. Composição INCI (`useComposicao.ts`)
- Devolução da validação regulatória para reenvio da planilha
- Botão no painel

## Auditoria

Cada devolução grava na tabela `audit_logs` via `auditSensitiveAction` existente:
```
action: "ACCESS:devolucao_etapa"
entity_type: "fluxo_artes" | "etiqueta_bula" | etc.
metadata: { etapa_de, etapa_para, justificativa, rodada }
```

## Registro no Histórico (JSONB)

Cada devolução adiciona ao array `historico` do registro:
```json
{
  "etapa_de": "desenvolvimento",
  "etapa_para": "criacao",
  "acao": "devolucao",
  "responsavel_id": "uuid",
  "responsavel_nome": "Maria Silva",
  "descricao": "Arte com Pantone incorreto, ajustar cor GL03",
  "data": "2026-03-13T...",
  "rodada": 2
}
```

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/shared/DevolucaoEtapaDialog.tsx` | **Criar** — Dialog reutilizável |
| `src/hooks/useFluxoArtesMotor.ts` | Adicionar `useDevolverEtapaArte` |
| `src/hooks/useEtiquetaBula.ts` | Adicionar `useDevolverEtapaBula` |
| `src/hooks/useFluxoAprovacaoArtes.ts` | Adicionar `useDevolverEtapaAprovacao` |
| `src/hooks/useAnaliseEmbalagem.ts` | Adicionar mutation de devolução |
| `src/hooks/useAmostras.ts` | Adicionar mutation de devolução |
| `src/hooks/useComposicao.ts` | Adicionar mutation de devolução |
| `src/pages/FluxoArtesDetalhe.tsx` | Botão "Devolver" + integração |
| `src/pages/ChecklistEtiquetaBula.tsx` | Botão "Devolver" + integração |
| `src/pages/FluxoAprovacaoDetalhe.tsx` | Botão "Devolver" + integração |
| `src/pages/AnaliseEmbalagem.tsx` | Botão "Devolver" + integração |
| `src/pages/RecebimentoAmostra.tsx` | Botão "Devolver" + integração |
| `src/pages/ChecklistComposicao.tsx` | Botão "Devolver" + integração |

