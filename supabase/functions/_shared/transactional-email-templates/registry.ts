/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as syncAlert } from './sync-alert.tsx'
import { template as mencoesDigestDiario } from './mencoes-digest-diario.tsx'
import { template as b2cTarefaCriada } from './b2c-tarefa-criada.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'sync-alert': syncAlert,
  'mencoes-digest-diario': mencoesDigestDiario,
  'b2c-tarefa-criada': b2cTarefaCriada,
}
