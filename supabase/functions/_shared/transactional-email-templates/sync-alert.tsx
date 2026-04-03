import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "bimaster"

interface SyncAlertProps {
  alertType?: 'error' | 'partial'
  entity?: string
  empresaId?: number
  consecutiveCount?: number
  lastError?: string
  lastDuration?: string
  timestamp?: string
}

const SyncAlertEmail = ({
  alertType = 'error',
  entity = 'contas_receber',
  empresaId,
  consecutiveCount = 1,
  lastError,
  lastDuration,
  timestamp,
}: SyncAlertProps) => {
  const isError = alertType === 'error'
  const statusLabel = isError ? '❌ FALHA' : '⚠️ PARCIAL'
  const statusColor = isError ? '#dc2626' : '#f59e0b'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        {statusLabel} Sync {entity} — {consecutiveCount} ciclo(s) consecutivo(s)
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ ...statusBanner, backgroundColor: statusColor }}>
            <Text style={statusText}>{statusLabel}</Text>
          </Section>

          <Heading style={h1}>
            Alerta de Sincronização
          </Heading>

          <Text style={text}>
            A sincronização <strong>{entity}</strong>
            {empresaId ? ` (empresa ${empresaId})` : ''} está com status{' '}
            <strong style={{ color: statusColor }}>
              {isError ? 'erro' : 'parcial'}
            </strong>{' '}
            por <strong>{consecutiveCount}</strong> ciclo(s) consecutivo(s).
          </Text>

          <Section style={detailsBox}>
            <Text style={detailLabel}>Entidade</Text>
            <Text style={detailValue}>{entity}</Text>

            {empresaId && (
              <>
                <Text style={detailLabel}>Empresa ID</Text>
                <Text style={detailValue}>{empresaId}</Text>
              </>
            )}

            <Text style={detailLabel}>Ciclos consecutivos</Text>
            <Text style={detailValue}>{consecutiveCount}</Text>

            {lastDuration && (
              <>
                <Text style={detailLabel}>Última duração</Text>
                <Text style={detailValue}>{lastDuration}</Text>
              </>
            )}

            {timestamp && (
              <>
                <Text style={detailLabel}>Horário</Text>
                <Text style={detailValue}>{timestamp}</Text>
              </>
            )}
          </Section>

          {lastError && (
            <>
              <Text style={detailLabel}>Erro</Text>
              <Section style={errorBox}>
                <Text style={errorText}>{lastError}</Text>
              </Section>
            </>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            Alerta automático do {SITE_NAME} — Módulo de Sincronização ERP
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SyncAlertEmail,
  subject: (data: Record<string, any>) =>
    `[${data.alertType === 'error' ? 'FALHA' : 'PARCIAL'}] Sync ${data.entity || 'ERP'} — ${data.consecutiveCount || 1} ciclo(s)`,
  displayName: 'Alerta de Sync ERP',
  previewData: {
    alertType: 'error',
    entity: 'contas_receber',
    empresaId: 11,
    consecutiveCount: 3,
    lastError: 'SQL Server connection timeout after 15000ms',
    lastDuration: '15.2s',
    timestamp: '2026-04-03 20:30:00',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }
const container = { padding: '0 25px 30px' }
const statusBanner = { padding: '12px 20px', borderRadius: '8px 8px 0 0', marginBottom: '0' }
const statusText = { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, margin: '0', textAlign: 'center' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1e293b', margin: '24px 0 16px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px' }
const detailsBox = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', margin: '0 0 20px' }
const detailLabel = { fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' as const, fontWeight: 'bold' as const, margin: '8px 0 2px', letterSpacing: '0.5px' }
const detailValue = { fontSize: '14px', color: '#1e293b', margin: '0 0 8px', fontWeight: '500' as const }
const errorBox = { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px 16px', margin: '0 0 20px' }
const errorText = { fontSize: '12px', color: '#991b1b', margin: '0', fontFamily: 'monospace', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { fontSize: '11px', color: '#94a3b8', margin: '0' }
