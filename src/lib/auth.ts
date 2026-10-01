// Autenticación del panel: token Bearer en localStorage + login contra el gateway.
// Reutiliza GATEWAY_URL de activity.ts (http://localhost:8080 por defecto).
import { GATEWAY_URL } from '@/lib/activity'

const TOKEN_KEY = 'onix_token'

// Evento global para que App vuelva al login si el token falta o expira (401).
export const UNAUTHORIZED_EVENT = 'onix:unauthorized'

export interface AuthUser {
  username?: string
  [k: string]: unknown
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(t: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, t)
  } catch {
    // Ignora entornos sin localStorage (modo privado, etc.).
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Ignora.
  }
}

// Cabecera de autorización para los fetch; vacío si no hay token.
export function authHeaders(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// Limpia el token y avisa a la app (App escucha UNAUTHORIZED_EVENT para volver al login).
export function handleUnauthorized(): void {
  clearToken()
  try {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  } catch {
    // Ignora entornos sin window.
  }
}

// POST /auth/login -> si 200 guarda token y devuelve true; si no, false.
export async function login(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(new URL('/auth/login', GATEWAY_URL).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { token?: string; user?: AuthUser }
    if (!data.token) return false
    setToken(data.token)
    return true
  } catch {
    return false
  }
}

export function logout(): void {
  clearToken()
}
