/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'bimaster'

interface Props {
  responsavelNome?: string
  documentoNome?: string
  categoria?: string
  submissaoCodigo?: string
  produtoNome?: string
  prazo?: string
  tarefaUrl?: string
}

const Email = ({
  responsavelNome,
  documentoNome = 'Documento',
  categoria,
  submissaoCodigo,
  produtoNome,
  prazo,
  tarefaUrl,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Nova tarefa criada: {documentoNome}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nova tarefa atribuída a você</Heading>
        <Text style={text}>
          {responsavelNome ? `Olá ${responsavelNome},` : 'Olá,'}
        </Text>
        <Text style={text}>
          Um documento foi anexado ao checklist Brasil → China e uma tarefa foi
          criada automaticamente no projeto espelho sob sua responsabilidade.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailLabel}>Documento</Text>
          <Text style={detailValue}>{documentoNome}</Text>

          {categoria && (
            <>
              <Text style={detailLabel}>Categoria</Text>
              <Text style={detailValue}>{categoria}</Text>
            </>
          )}

          {produtoNome && (
            <>
              <Text style={detailLabel}>Produto</Text>
              <Text style={detailValue}>{produtoNome}</Text>
            </>
          )}

          {submissaoCodigo && (
            <>
              <Text style={detailLabel}>Submissão</Text>
              <Text style={detailValue}>{submissaoCodigo}</Text>
            </>
          )}

          {prazo && (
            <>
              <Text style={detailLabel}>Prazo</Text>
              <Text style={detailValue}>{prazo}</Text>
            </>
          )}
        </Section>

        {tarefaUrl && (
          <Section style={{ textAlign: 'center', marginTop: 24 }}>
            <Button href={tarefaUrl} style={button}>Abrir tarefa</Button>
          </Section>
        )}

        <Hr style={hr} />
        <Text style={footer}>{SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Nova tarefa: ${d?.documentoNome ?? 'documento'}${d?.submissaoCodigo ? ` (${d.submissaoCodigo})` : ''}`,
  displayName: 'B2C — Tarefa criada no projeto espelho',
  previewData: {
    responsavelNome: 'Ana',
    documentoNome: 'Ficha técnica revisada',
    categoria: 'Regulatório',
    submissaoCodigo: 'SUB-0421',
    produtoNome: 'Sérum Facial 30ml',
    prazo: '20/06/2026',
    tarefaUrl: 'https://app.example.com/projetos/abc/tarefas/xyz',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: 560 }
const h1 = { fontSize: 20, color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: 14, color: '#334155', lineHeight: '22px', margin: '0 0 12px' }
const detailsBox = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: 16,
  marginTop: 12,
}
const detailLabel = { fontSize: 11, color: '#64748b', textTransform: 'uppercase' as const, margin: '8px 0 2px' }
const detailValue = { fontSize: 14, color: '#0f172a', margin: 0, fontWeight: 600 }
const button = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '10px 18px',
  borderRadius: 6,
  textDecoration: 'none',
  fontSize: 14,
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const footer = { fontSize: 12, color: '#94a3b8', textAlign: 'center' as const }
