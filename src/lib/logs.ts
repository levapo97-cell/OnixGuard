// Cliente REST de Logs/Eventos (gateway). Reutiliza GATEWAY_URL de activity.ts.
import { GATEWAY_URL } from '@/lib/activity'
import { authHeaders, handleUnauthorized } from '@/lib/auth'

// Roles de agente conocidos (para el filtro).
export const AGENT_ROLES = [
  'project_lead',
  'fullstack',
  'designer',
  'growth',
  'sales',
  'gm',
  'qa',
] as const
export type AgentRole = (typeof AGENT_ROLES)[number]

// Tipos de evento conocidos (para el filtro).
export const EVENT_TYPES = [
  'tool',
  'error',
  'repeticion',
  'credencial',
  'tarea',
  'reporte',
  'nota',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

// Fila de la lista: GET /api/events
export interface LogEvent {
  id: string
  ts: string
  type: string
  tool: string | null
  summary: string | null
  agent_role: string
  stage: number | null
  is_error: boolean
  is_repetition: boolean
}

// Credencial detectada: SOLO el hash (nunca el valor en claro).
export interface Credential {
  kind: string
  sha256: string
  label: string
}

// Detalle: GET /api/events/{id}
export interface LogEventDetail extends LogEvent {
  params_normalized: string | null
  params_hash: string | null
  exit_code: number | null
  duration_ms: number | null
  credentials: Credential[]
}

// Filtros para el listado.
export interface LogFilters {
  agent?: string
  type?: string
  stage?: number | null
  q?: string
  limit?: number
}

export type ExportScope = 'todas' | 'etapa_actual'
export type ExportFormat = 'jsonl' | 'csv'

// GET /api/events con query params agent,type,stage,q,limit
export async function listEvents(filters: LogFilters = {}): Promise<LogEvent[]> {
  const url = new URL('/api/events', GATEWAY_URL)
  if (filters.agent) url.searchParams.set('agent', filters.agent)
  if (filters.type) url.searchParams.set('type', filters.type)
  if (filters.stage != null) url.searchParams.set('stage', String(filters.stage))
  if (filters.q && filters.q.trim() !== '') url.searchParams.set('q', filters.q.trim())
  if (filters.limit != null) url.searchParams.set('limit', String(filters.limit))

  const res = await fetch(url.toString(), { headers: { ...authHeaders() } })
  if (res.status === 401) handleUnauthorized()
  if (!res.ok) throw new Error(`/api/events ${res.status}`)
  return (await res.json()) as LogEvent[]
}

// GET /api/events/{id}
export async function getEvent(id: string): Promise<LogEventDetail> {
  const res = await fetch(new URL(`/api/events/${id}`, GATEWAY_URL).toString(), {
    headers: { ...authHeaders() },
  })
  if (res.status === 401) handleUnauthorized()
  if (!res.ok) throw new Error(`/api/events/${id} ${res.status}`)
  return (await res.json()) as LogEventDetail
}

// POST /api/export -> la respuesta es un ARCHIVO (Content-Disposition).
// Lee el blob, crea un object URL y dispara la descarga en el navegador.
export async function exportEvents(scope: ExportScope, format: ExportFormat): Promise<void> {
  const res = await fetch(new URL('/api/export', GATEWAY_URL).toString(), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, format }),
  })
  if (res.status === 401) handleUnauthorized()
  if (!res.ok) throw new Error(`/api/export ${res.status}`)

  const blob = await res.blob()

  // Nombre de archivo: toma el de Content-Disposition si existe; si no, uno por defecto.
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  const filename = match ? decodeURIComponent(match[1]) : `onixguard-logs-${scope}.${format}`

  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

// Color del chip por ROL del agente (reutiliza los tokens de estado §10, como en Monitoreo).
export function roleClasses(role: string): string {
  switch (role) {
    case 'fullstack':
      return 'bg-state-working text-state-working-fg'
    case 'designer':
      return 'bg-state-repeat text-state-repeat-fg'
    case 'project_lead':
      return 'bg-state-waiting text-state-waiting-fg'
    default:
      return 'bg-state-idle text-state-idle-fg'
  }
}
