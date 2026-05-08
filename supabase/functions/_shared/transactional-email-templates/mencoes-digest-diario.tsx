import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "bimaster"

interface MencaoItem {
  title: string
  message: string
  url: string
  context: string  // ex: "Tarefa", "Chat do projeto"
  ago: string      // ex: "há 3 horas"
}

interface MencoesDigestProps {
  recipientName?: string
  total?: number
  centralUrl?: string
  itens?: MencaoItem[]
}

const MencoesDigestEmail = ({
  recipientName,
  total = 0,
  centralUrl = "https://bimaster.online/dashboard/projetos/central?tab=inbox&subtab=mencoes",
  itens = [],
}: MencoesDigestProps) => {
  const greeting = recipientName ? `Olá, ${recipientName}` : "Olá"
  const plural = total === 1 ? "menção pendente" : "menções pendentes"

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        Você tem {total} {plural} no {SITE_NAME}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{greeting},</Heading>
          <Text style={text}>
            Você tem <strong>{total} {plural}</strong> que ainda não foram visualizadas no {SITE_NAME}.
            Veja abaixo um resumo das mais recentes:
          </Text>

          <Section style={listSection}>
            {itens.slice(0, 20).map((item, i) => (
              <Section key={i} style={card}>
                <Text style={cardLabel}>{item.context} · {item.ago}</Text>
                <Text style={cardTitle}>{item.title}</Text>
                <Text style={cardMessage}>{item.message}</Text>
              </Section>
            ))}
          </Section>

          {total > itens.length && (
            <Text style={moreText}>
              + {total - itens.length} outras menções na Central de Trabalho.
            </Text>
          )}

          <Section style={ctaSection}>
            <Button href={centralUrl} style={button}>
              Abrir Central de Trabalho
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Você está recebendo este resumo porque foi mencionado em tarefas ou chats e ainda não leu as notificações.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: MencoesDigestEmail,
  subject: (data: Record<string, any>) => {
    const total = data?.total ?? 0
    return total === 1
      ? "Você tem 1 menção pendente no bimaster"
      : `Você tem ${total} menções pendentes no bimaster`
  },
  displayName: "Resumo diário de menções",
  previewData: {
    recipientName: "Maria",
    total: 3,
    centralUrl: "https://bimaster.online/dashboard/projetos/central?tab=inbox&subtab=mencoes",
    itens: [
      { title: "João mencionou você", message: "@maria pode revisar a embalagem antes da reunião?", url: "#", context: "Tarefa", ago: "há 2 horas" },
      { title: "Ana mencionou você", message: "@maria os ajustes no protocolo China estão prontos", url: "#", context: "Chat do projeto", ago: "há 5 horas" },
      { title: "Carlos mencionou você", message: "@maria preciso da sua aprovação no processo", url: "#", context: "Processo", ago: "há 8 horas" },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px' }
const listSection = { margin: '12px 0 4px' }
const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '12px 14px',
  margin: '0 0 10px',
}
const cardLabel = { fontSize: '11px', color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.4px' }
const cardTitle = { fontSize: '14px', fontWeight: 600 as const, color: '#0f172a', margin: '0 0 4px' }
const cardMessage = { fontSize: '13px', color: '#475569', margin: '0', lineHeight: '1.5' }
const moreText = { fontSize: '12px', color: '#64748b', fontStyle: 'italic' as const, margin: '4px 0 16px' }
const ctaSection = { textAlign: 'center' as const, margin: '24px 0 8px' }
const button = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 600 as const,
  display: 'inline-block',
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0 16px' }
const footer = { fontSize: '11px', color: '#94a3b8', margin: '0', lineHeight: '1.5' }
