// Cliente REST de Proyectos (gateway). Reutiliza GATEWAY_URL de activity.ts.
// Las rutas /api/projects/* las sirve el onix-agent de la PC a través del gateway.
// Si el agente local NO está corriendo, el gateway responde 502 con
// { error: "onix-agent no disponible (¿está corriendo en tu PC?)" }.
import { GATEWAY_URL } from '@/lib/activity'
import { authHeaders, handleUnauthorized } from '@/lib/auth'

// Proyecto detectado en la PC (GET /api/projects).
export interface Project {
  name: string
  path: string
  is_git: boolean
}

export interface ListProjectsResponse {
  ok: boolean
  error?: string
  projects?: Project[]
}

export interface CheckRepoResponse {
  ok: boolean
  error?: string
  exists?: boolean
  path?: string
}

export interface CloneRepoResponse {
  ok: boolean
  error?: string
  path?: string
  output?: string
}

// Error específico: el agente local (onix-agent) no está conectado (gateway → 502).
export class AgentUnavailableError extends Error {
  constructor(message = 'Agente local (onix-agent) no conectado') {
    super(message)
    this.name = 'AgentUnavailableError'
  }
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

// GET /api/projects → lista de proyectos de la PC.
export async function listProjects(): Promise<ListProjectsResponse> {
  const res = await fetch(new URL('/api/projects', GATEWAY_URL).toString(), {
    headers: { ...authHeaders() },
  })
  return handleResponse<ListProjectsResponse>(res, '/api/projects')
}

// POST /api/projects/check {name} → ¿existe el repo por nombre?
export async function checkRepo(name: string): Promise<CheckRepoResponse> {
  const res = await fetch(new URL('/api/projects/check', GATEWAY_URL).toString(), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return handleResponse<CheckRepoResponse>(res, '/api/projects/check')
}

// POST /api/projects/clone {url} → clona el repo en la PC.
export async function cloneRepo(url: string): Promise<CloneRepoResponse> {
  const res = await fetch(new URL('/api/projects/clone', GATEWAY_URL).toString(), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return handleResponse<CloneRepoResponse>(res, '/api/projects/clone')
}
