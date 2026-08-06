/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'bimaster'

interface Props {
  destinatarioNome?: string
  eventoTitulo?: string
  projetoNome?: string
  dataInicio?: string
  dataPrazo?: string
  antecedencia?: string
  eventoUrl?: string
}

const Email = ({
  destinatarioNome,
  eventoTitulo = 'Evento do calendário',
  projetoNome,
  dataInicio,
  dataPrazo,
  antecedencia,
  eventoUrl,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Lembrete: {eventoTitulo}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Lembrete de evento</Heading>
        <Text style={text}>{destinatarioNome ? `Olá ${destinatarioNome},` : 'Olá,'}</Text>
        <Text style={text}>
          Este é um lembrete{antecedencia ? ` (${antecedencia})` : ''} do evento agendado no seu calendário.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailLabel}>Evento</Text>
          <Text style={detailValue}>{eventoTitulo}</Text>

          {projetoNome && (
            <>
              <Text style={detailLabel}>Projeto</Text>
              <Text style={detailValue}>{projetoNome}</Text>
            </>
          )}

          {dataInicio && (
            <>
              <Text style={detailLabel}>Início</Text>
              <Text style={detailValue}>{dataInicio}</Text>
            </>
          )}

          {dataPrazo && (
            <>
              <Text style={detailLabel}>Prazo</Text>
              <Text style={detailValue}>{dataPrazo}</Text>
            </>
          )}
        </Section>

        {eventoUrl && (
          <Section style={{ textAlign: 'center', marginTop: 24 }}>
            <Button href={eventoUrl} style={button}>Abrir evento</Button>
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
  subject: (d: Record<string, any>) => `Lembrete: ${d?.eventoTitulo ?? 'evento do calendário'}`,
  displayName: 'Calendário — Lembrete de evento',
  previewData: {
    destinatarioNome: 'Ana',
    eventoTitulo: 'Reunião de planejamento',
    projetoNome: 'Redes Sociais',
    dataInicio: '10/06/2026',
    dataPrazo: '10/06/2026',
    antecedencia: '1 dia antes',
    eventoUrl: 'https://app.example.com/dashboard/projetos',
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
