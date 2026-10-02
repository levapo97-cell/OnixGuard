// Cliente REST de Sesiones (gateway). Reutiliza GATEWAY_URL de activity.ts.
// Las rutas /api/sessions/* las sirve el onix-agent de la PC a través del gateway.
// Controla las sesiones de Claude Code abiertas en la PC (listar, cerrar, pausar, reanudar).
// Si el agente local NO está corriendo, el gateway responde 502 con { error }.
import { GATEWAY_URL } from '@/lib/activity'
import { authHeaders, handleUnauthorized } from '@/lib/auth'
import { AgentUnavailableError } from '@/lib/projects'

// Reexporta el error compartido para que la pantalla lo importe desde aquí.
export { AgentUnavailableError }

// Sesión de Claude Code detectada en la PC (GET /api/sessions).
export interface Session {
  pid: number
  command: string
}

export interface ListSessionsResponse {
  ok: boolean
  error?: string
  sessions?: Session[]
}

export interface SessionActionResponse {
  ok: boolean
  error?: string
}

// Lee el JSON de forma tolerante (puede venir vacío o no-JSON en errores).
async function readJson<T>(res: Response): Promise<Partial<T>> {
  try {
    return (await res.json()) as Partial<T>
  } catch {
    return {}
  }
}

// Centraliza el manejo de respuestas: 401 (login) y 502 (agente no conectado).
async function handleResponse<T extends { ok: boolean; error?: string }>(
  res: Response,
  path: string,
): Promise<T> {
  if (res.status === 401) {
    handleUnauthorized()
    throw new Error(`${path} 401`)
  }
  const data = await readJson<T>(res)
  // El gateway devuelve 502 cuando el onix-agent de la PC no responde.
  if (res.status === 502) {
    throw new AgentUnavailableError(data.error || undefined)
  }
  if (!res.ok) {
    throw new Error(data.error || `${path} ${res.status}`)
  }
  return data as T
}

// GET /api/sessions → sesiones de Claude Code corriendo en la PC.
export async function listSessions(): Promise<ListSessionsResponse> {
  const res = await fetch(new URL('/api/sessions', GATEWAY_URL).toString(), {
    headers: { ...authHeaders() },
  })
  return handleResponse<ListSessionsResponse>(res, '/api/sessions')
}

// POST /api/sessions/close {pid} → cierra la sesión.
export async function closeSession(pid: number): Promise<SessionActionResponse> {
  const res = await fetch(new URL('/api/sessions/close', GATEWAY_URL).toString(), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid }),
  })
  return handleResponse<SessionActionResponse>(res, '/api/sessions/close')
}

// POST /api/sessions/pause {pid} → pausa la sesión.
export async function pauseSession(pid: number): Promise<SessionActionResponse> {
  const res = await fetch(new URL('/api/sessions/pause', GATEWAY_URL).toString(), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid }),
  })
  return handleResponse<SessionActionResponse>(res, '/api/sessions/pause')
}

// POST /api/sessions/resume {pid} → reanuda la sesión.
export async function resumeSession(pid: number): Promise<SessionActionResponse> {
  const res = await fetch(new URL('/api/sessions/resume', GATEWAY_URL).toString(), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid }),
  })
  return handleResponse<SessionActionResponse>(res, '/api/sessions/resume')
}
