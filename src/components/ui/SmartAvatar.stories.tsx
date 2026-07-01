import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { SmartAvatar } from "./SmartAvatar";


/**
 * Stories de validação visual do SmartAvatar cobrindo os casos-limite de
 * `nome` (nulo, whitespace, literais "null"/"undefined", placeholder "Membro")
 * e de `fallbackNome` custom. O componente prioriza `fallbackNome` sobre
 * `nome` sempre que este último for inutilizável, garantindo tooltip,
 * aria-label e iniciais consistentes.
 *
 * Observação: o projeto não roda Storybook em CI hoje. Este arquivo segue o
 * padrão CSF3 (`@storybook/react`) e passa a ser reconhecido automaticamente
 * assim que o Storybook for adicionado — sem depender de nenhum decorator
 * global custom.
 */
const meta: Meta<typeof SmartAvatar> = {
  title: "UI/SmartAvatar",
  component: SmartAvatar,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Avatar que auto-resolve signed URLs quebradas do bucket privado " +
          "`avatars` e cai para iniciais quando a imagem falha. Sempre " +
          "prioriza `fallbackNome` quando `nome` é nulo, whitespace, " +
          '"null"/"undefined" literal ou o placeholder genérico "Membro".',
      },
    },
  },
  argTypes: {
    src: { control: "text" },
    nome: { control: "text" },
    identifier: { control: "text" },
    fallbackNome: { control: "text" },
    className: { control: "text" },
  },
  args: {
    className: "h-12 w-12",
  },
};

export default meta;
type Story = StoryObj<typeof SmartAvatar>;

export const NomeValido: Story = {
  args: {
    nome: "Ana Dona",
    identifier: "ana@example.com",
    src: null,
  },
};

export const NomeNulo: Story = {
  name: "nome = null",
  args: {
    nome: null,
    identifier: "u-123",
    src: null,
  },
};

export const NomeUndefined: Story = {
  name: "nome = undefined",
  args: {
    nome: undefined,
    identifier: "u-456",
    src: null,
  },
};

export const NomeApenasEspacos: Story = {
  name: "nome = '   ' (whitespace)",
  args: {
    nome: "   ",
    identifier: "u-789",
    src: null,
  },
};

export const NomeStringNullLiteral: Story = {
  name: 'nome = "null" (literal)',
  args: {
    nome: "null",
    identifier: "u-null",
    src: null,
  },
};

export const NomeStringUndefinedLiteral: Story = {
  name: 'nome = "undefined" (literal)',
  args: {
    nome: "undefined",
    identifier: "u-undef",
    src: null,
  },
};

export const NomePlaceholderMembro: Story = {
  name: 'nome = "Membro" + fallbackNome custom',
  args: {
    nome: "Membro",
    fallbackNome: "Convidado",
    identifier: "u-guest",
    src: null,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Quando `nome` chega como o placeholder genérico "Membro" ' +
          "(hidratação parcial via RPC/RLS) e o caller passou um " +
          "`fallbackNome` custom, o fallback vence — o tooltip mostra " +
          '"Convidado (u-guest)" em vez de "Membro (u-guest)".',
      },
    },
  },
};

export const FallbackNomeCustomComNomeNulo: Story = {
  name: "fallbackNome custom + nome null",
  args: {
    nome: null,
    fallbackNome: "Fornecedor",
    identifier: "cnpj@example.com",
    src: null,
  },
};

export const SemIdentifier: Story = {
  name: "sem identifier (tooltip = só nome)",
  args: {
    nome: "Beto",
    src: null,
  },
};

export const ImagemQuebrada: Story = {
  name: "imagem quebrada (onError → '— foto indisponível')",
  args: {
    nome: "Carla",
    identifier: "carla@example.com",
    src: "https://invalid.example.com/does-not-exist.png",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Ao falhar o carregamento, `title`, `aria-label` e o `aria-label` " +
          'do fallback recebem o sufixo "— foto indisponível" ' +
          "simultaneamente, e o `<img>` desmonta cedendo lugar às iniciais.",
      },
    },
  },
};

export const PilhaDeAvatares: Story = {
  name: "Pilha (visualização em grupo)",
  render: () => (
    <div className="flex -space-x-2">
      <SmartAvatar
        className="h-10 w-10 border-2 border-background"
        nome="Ana Dona"
        identifier="ana@x.com"
        src={null}
      />
      <SmartAvatar
        className="h-10 w-10 border-2 border-background"
        nome={null}
        fallbackNome="Convidado"
        identifier="u-2"
        src={null}
      />
      <SmartAvatar
        className="h-10 w-10 border-2 border-background"
        nome="   "
        identifier="u-3"
        src={null}
      />
      <SmartAvatar
        className="h-10 w-10 border-2 border-background"
        nome="Membro"
        fallbackNome="Fornecedor"
        identifier="cnpj@x.com"
        src={null}
      />
    </div>
  ),
};
