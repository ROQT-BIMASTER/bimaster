

## Pasta Digital China — Estilo TJSP

### Contexto
O sistema já possui uma **Pasta Digital** funcional no módulo Produto Brasil (estilo TJSP) com árvore hierárquica por fases, painel dividido com visualizador de documentos, parecer departamental e numeração de páginas. A proposta é criar uma **Pasta Digital dedicada para submissões da China**, reutilizando a arquitetura existente mas adaptada ao fluxo China-Brasil.

### O que será construído

**1. Tabela `china_pasta_digital`**

Tabela dedicada para organizar documentos que chegam da China (e do Brasil) em formato de autos processuais:

```text
china_pasta_digital
├── id (uuid PK)
├── submissao_id (uuid FK → china_produto_submissoes)
├── fase (text) — categoria do documento no processo
├── titulo (text)
├── paginas (text) — "1-4", "5", "6-8" (numeração sequencial tipo TJSP)
├── arquivo_url / arquivo_path (text)
├── documento_origem_id (uuid FK nullable → china_produto_documentos) — vínculo com doc existente
├── ordem (int)
├── parent_id (uuid FK nullable — para sub-itens)
├── departamento_id (uuid FK nullable → departamentos)
├── parecer_status (text default 'pendente') — pendente/aprovado/com_pendencia/rejeitado
├── parecer_por / parecer_data / parecer_observacao
├── despacho_modulo (text nullable) — ex: "composicao", "etiqueta_bula", "fluxo_artes"
├── despacho_descricao (text nullable)
├── despacho_data (timestamp nullable)
├── despacho_por (uuid nullable)
├── created_by / created_at
```

**Fases específicas China:**
- Dados Oficiais (Planilha Excel)
- Formulação / Composição
- Documentação Regulatória
- Embalagem — Facas
- Embalagem — Fotos/Vídeos
- Rotulagem
- Etiquetas (Brasil Envia)
- EANs (Brasil Envia)
- Artes (Brasil/China)
- Despachos
- Correspondência

**2. Componente `ChinaPastaDigitalPanel.tsx`**

Painel split-view estilo TJSP com:

- **Esquerda**: Árvore hierárquica colapsável por fase, com numeração de páginas, ícones de status (parecer) e contadores por fase
- **Direita**: Visualizador de documento (PDF/imagem inline) + painel de parecer departamental + **botão "Despachar para Módulo"**

**3. Funcionalidade "Despacho para Módulo"**

Diferencial principal — permite direcionar um documento da pasta digital para um módulo específico do sistema:

- **Composição INCI** → abre o documento para análise de formulação
- **Etiqueta/Bula** → envia para o fluxo de aprovação de artes
- **Motor de Artes** → despacha arte para o workflow de aprovação
- **Análise de Embalagem** → envia facas/fotos para o módulo de embalagem
- **Regulatório** → despacha para análise regulatória

Cada despacho registra: quem despachou, quando, para qual módulo, e cria um vínculo na tabela `modulo_projeto_vinculos` automaticamente.

**4. Auto-importação de documentos existentes**

Ao abrir a Pasta Digital de uma submissão pela primeira vez, o sistema importa automaticamente todos os documentos já existentes em `china_produto_documentos` para a pasta, organizando-os nas fases corretas com numeração de páginas automática.

**5. Integração na tela de detalhe da submissão**

Nova tab "Pasta Digital 数字档案" na página `ChinaSubmissaoDetalhe` ou `ChinaFichaProduto`.

### Arquivos

| Arquivo | Ação |
|---|---|
| 1 migration SQL | Tabela `china_pasta_digital` + RLS + índices |
| `src/hooks/useChinaPastaDigital.ts` | CRUD + despacho + auto-importação |
| `src/components/china/ChinaPastaDigitalPanel.tsx` | UI split-view estilo TJSP |
| `src/components/china/DespachoModuloDialog.tsx` | Dialog para despachar doc para módulo |
| `src/pages/ChinaFichaProduto.tsx` | Integrar tab Pasta Digital |

