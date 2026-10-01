// Cliente REST de Reportes (gateway). Reutiliza GATEWAY_URL de activity.ts.
import { GATEWAY_URL } from '@/lib/activity'
import { authHeaders, handleUnauthorized } from '@/lib/auth'

export type ReportStatus = 'espera' | 'aprobado' | 'cambios' | 'respondido'

// Ítem de la bandeja: GET /api/reports
export interface ReportListItem {
  id: string
  title: string
  status: ReportStatus
  agent_role: string
  stage: number | null
  summary: string | null
  created_at: string
}

export interface ReportMessage {
  sender: 'jefe' | 'agente'
  body: string
  created_at: string
}

// Detalle: GET /api/reports/{id}
export interface ReportDetail {
  id: string
  title: string
  status: ReportStatus
  agent_role: string
  stage: number | null
  summary: string | null
  deliverables: string[]
  decisions: string[]
  tokens: number | null
  cost_usd: number | null
  errors: number | null
  repetitions: number | null
  created_at: string
  messages: ReportMessage[]
}

export type RespondAction = 'aprobar' | 'cambios' | 'responder'

export async function fetchReports(): Promise<ReportListItem[]> {
  const res = await fetch(new URL('/api/reports', GATEWAY_URL).toString(), {
    headers: { ...authHeaders() },
  })
  if (res.status === 401) handleUnauthorized()
  if (!res.ok) throw new Error(`/api/reports ${res.status}`)
  return (await res.json()) as ReportListItem[]
}

export async function fetchReport(id: string): Promise<ReportDetail> {
  const res = await fetch(new URL(`/api/reports/${id}`, GATEWAY_URL).toString(), {
    headers: { ...authHeaders() },
  })
  if (res.status === 401) handleUnauthorized()
  if (!res.ok) throw new Error(`/api/reports/${id} ${res.status}`)
  return (await res.json()) as ReportDetail
}

export async function respondReport(
  id: string,
  action: RespondAction,
  message?: string,
): Promise<void> {
  const res = await fetch(new URL(`/api/reports/${id}/respond`, GATEWAY_URL).toString(), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(message !== undefined ? { action, message } : { action }),
  })
  if (res.status === 401) handleUnauthorized()
  if (!res.ok) throw new Error(`/api/reports/${id}/respond ${res.status}`)
}

// Color del chip de ESTADO del reporte (tokens §10).
export function statusClasses(status: ReportStatus): string {
  switch (status) {
    case 'espera':
      return 'bg-state-waiting text-state-waiting-fg'
    case 'aprobado':
      return 'bg-state-working text-state-working-fg'
    case 'cambios':
      return 'bg-state-error text-state-error-fg'
    case 'respondido':
      return 'bg-state-idle text-state-idle-fg'
    default:
      return 'bg-state-idle text-state-idle-fg'
  }
}

// Color del chip por rol del agente (mismo criterio que la lista de actividad).
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
