import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AgentUnavailableError,
  type Session,
  closeSession,
  listSessions,
  pauseSession,
  resumeSession,
} from '@/lib/sessions'

type ActionKind = 'close' | 'pause' | 'resume'

// Aviso reutilizable cuando el onix-agent de la PC no está conectado (gateway → 502).
function AgentOfflineNotice() {
  return (
    <p className="rounded-[10px] border border-state-error bg-state-error px-3 py-2 text-xs text-state-error-fg">
      Agente local (onix-agent) no conectado — inícialo en tu PC para controlar las sesiones de
      Claude Code.
    </p>
  )
}

export default function Sesiones() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agentOffline, setAgentOffline] = useState(false)
  // PID -> acción en curso, para deshabilitar botones y mostrar estado por fila.
  const [busy, setBusy] = useState<Record<number, ActionKind>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listSessions()
      if (!res.ok) {
        setError(res.error || 'No se pudieron cargar las sesiones')
        setSessions([])
      } else {
        setSessions(res.sessions ?? [])
        setError(null)
      }
      setAgentOffline(false)
    } catch (e) {
      if (e instanceof AgentUnavailableError) {
        setAgentOffline(true)
        setError(null)
      } else {
        setError(e instanceof Error ? e.message : 'Error cargando sesiones')
      }
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const runAction = useCallback(
    async (pid: number, kind: ActionKind) => {
      if (kind === 'close' && !window.confirm(`¿Cerrar la sesión PID ${pid}?`)) {
        return
      }
      setBusy((b) => ({ ...b, [pid]: kind }))
      setNotice(null)
      setError(null)
      try {
        const res =
          kind === 'close'
            ? await closeSession(pid)
            : kind === 'pause'
              ? await pauseSession(pid)
              : await resumeSession(pid)
        if (res.ok) {
          const verbo =
            kind === 'close' ? 'cerrada' : kind === 'pause' ? 'pausada' : 'reanudada'
          setNotice(`Sesión PID ${pid} ${verbo}.`)
          setAgentOffline(false)
        } else {
          setError(res.error || `No se pudo completar la acción sobre PID ${pid}`)
        }
      } catch (e) {
        if (e instanceof AgentUnavailableError) {
          setAgentOffline(true)
        } else {
          setError(e instanceof Error ? e.message : `Error en la acción sobre PID ${pid}`)
        }
      } finally {
        setBusy((b) => {
          const next = { ...b }
          delete next[pid]
          return next
        })
        // Re-lista al terminar para reflejar el estado real de la PC.
        await load()
      }
    },
    [load],
  )

  return (
    <section className="flex flex-col rounded-card border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Sesiones de Claude Code</h2>
          <span className="font-mono text-xs text-muted-foreground">{sessions.length}</span>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Controla las sesiones de Claude Code abiertas en tu PC (p. ej. cerrar una que olvidaste).
          Requiere el demonio onix-agent corriendo.
        </p>

        {agentOffline && <AgentOfflineNotice />}
        {notice && (
          <p className="rounded-[10px] border border-state-working bg-state-working px-3 py-2 text-xs text-state-working-fg">
            {notice}
          </p>
        )}
        {error && <p className="text-xs text-state-error-fg">{error}</p>}

        {loading ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">Cargando sesiones…</p>
        ) : agentOffline ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            El agente local (onix-agent) no está conectado.
          </p>
        ) : sessions.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            No hay sesiones de Claude Code corriendo
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-[10px] border border-border">
            {sessions.map((s) => {
              const current = busy[s.pid]
              const disabled = Boolean(current)
              return (
                <li
                  key={s.pid}
                  className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-sm text-foreground">PID {s.pid}</span>
                    <span
                      className="truncate font-mono text-xs text-muted-foreground"
                      title={s.command}
                    >
                      {s.command}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={disabled}
                      onClick={() => runAction(s.pid, 'close')}
                    >
                      {current === 'close' ? 'Cerrando…' : 'Cerrar'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => runAction(s.pid, 'pause')}
                    >
                      {current === 'pause' ? 'Pausando…' : 'Pausar'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => runAction(s.pid, 'resume')}
                    >
                      {current === 'resume' ? 'Reanudando…' : 'Reanudar'}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
