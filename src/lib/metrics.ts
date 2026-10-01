// Métricas en vivo del panel (Fase 1): overview + etapas + agentes vía REST.
// Reutiliza GATEWAY_URL de activity.ts (http://localhost:8080 por defecto).

import { GATEWAY_URL } from '@/lib/activity'

// GET /api/overview
export interface Overview {
  tools: number
  tokens: number
  cost_usd: number
  errors: number
  repetitions: number
  current_stage: number
  total_stages: number
}

// GET /api/stages
export type StageStatus = 'pendiente' | 'activa' | 'hecha'
export interface Stage {
  number: number
  name: string
  status: StageStatus
}

// GET /api/agents
export type AgentStatus = 'activa' | 'pausada' | 'cerrada' | 'inactivo'
export interface Agent {
  id: string
  role: string
  display_name: string | null
  status: AgentStatus
  events: number
  errors: number
  repetitions: number
  tokens: number
  cost_usd: number
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, GATEWAY_URL).toString())
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return (await res.json()) as T
}

export function fetchOverview(): Promise<Overview> {
  return getJSON<Overview>('/api/overview')
}

export function fetchStages(): Promise<Stage[]> {
  return getJSON<Stage[]>('/api/stages')
}

export function fetchAgents(): Promise<Agent[]> {
  return getJSON<Agent[]>('/api/agents')
}

// Formatea costo como $x.xxxx; null/undefined -> $0.0000
export function formatCost(v: number | null | undefined): string {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  return `$${n.toFixed(4)}`
}

// Entero legible; null/undefined -> 0
export function formatInt(v: number | null | undefined): string {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  return n.toLocaleString('es')
}
