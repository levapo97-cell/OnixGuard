// Cliente REST de Tickets (gateway). Reutiliza GATEWAY_URL de activity.ts.
import { GATEWAY_URL } from '@/lib/activity'
import { authHeaders, handleUnauthorized } from '@/lib/auth'

// Estado de un ticket (flujo de ejecución).
export type TicketStatus =
  | 'nuevo'
  | 'en_plan'
  | 'plan_espera'
  | 'aprobado'
  | 'en_curso'
  | 'hecho'
  | 'cancelado'

// Estado de una fase del plan.
export type StageStatus = 'pendiente' | 'activa' | 'hecha'

// Ítem de la lista: GET /api/tickets
export interface TicketListItem {
  id: string
  title: string
  status: string
  source: string
  created_at: string
}

export interface TicketStage {
  number: number
  name: string
  status: StageStatus
}

// Detalle: GET /api/tickets/{id}
export interface TicketDetail {
  id: string
  title: string
  status: string
  source: string
  created_at: string
  body: string | null
  stages: TicketStage[]
}

export async function listTickets(): Promise<TicketListItem[]> {
  const res = await fetch(new URL('/api/tickets', GATEWAY_URL).toString(), {
    headers: { ...authHeaders() },
  })
  if (res.status === 401) handleUnauthorized()
  if (!res.ok) throw new Error(`/api/tickets ${res.status}`)
  return (await res.json()) as TicketListItem[]
}

export async function getTicket(id: string): Promise<TicketDetail> {
  const res = await fetch(new URL(`/api/tickets/${id}`, GATEWAY_URL).toString(), {
    headers: { ...authHeaders() },
  })
  if (res.status === 401) handleUnauthorized()
  if (!res.ok) throw new Error(`/api/tickets/${id} ${res.status}`)
  return (await res.json()) as TicketDetail
}

export async function createTicket(title: string, body: string): Promise<{ id: string }> {
  const res = await fetch(new URL('/api/tickets', GATEWAY_URL).toString(), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, source: 'plataforma' }),
  })
  if (res.status === 401) handleUnauthorized()
  if (!res.ok) throw new Error(`/api/tickets ${res.status}`)
  return (await res.json()) as { id: string }
}

// Color del chip por ESTADO del ticket (tokens §10).
export function ticketStatusClasses(status: string): string {
  switch (status) {
    case 'nuevo':
      return 'bg-state-idle text-state-idle-fg'
    case 'en_plan':
    case 'plan_espera':
      return 'bg-state-waiting text-state-waiting-fg'
    case 'aprobado':
    case 'en_curso':
    case 'hecho':
      return 'bg-state-working text-state-working-fg'
    case 'cancelado':
      return 'bg-state-error text-state-error-fg'
    default:
      return 'bg-state-idle text-state-idle-fg'
  }
}

// Color del chip por ESTADO de la fase del plan.
export function stageStatusClasses(status: StageStatus): string {
  switch (status) {
    case 'activa':
      return 'bg-brand text-white'
    case 'hecha':
      return 'bg-state-working text-state-working-fg'
    case 'pendiente':
    default:
      return 'bg-state-idle text-state-idle-fg'
  }
}

// Etiqueta legible del estado del ticket.
export function ticketStatusLabel(status: string): string {
  switch (status) {
    case 'nuevo':
      return 'nuevo'
    case 'en_plan':
      return 'en plan'
    case 'plan_espera':
      return 'plan en espera'
    case 'aprobado':
      return 'aprobado'
    case 'en_curso':
      return 'en curso'
    case 'hecho':
      return 'hecho'
    case 'cancelado':
      return 'cancelado'
    default:
      return status
  }
}
