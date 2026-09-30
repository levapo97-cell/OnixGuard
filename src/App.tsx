import { useEffect, useRef, useState } from 'react'
import {
  type Activity,
  fetchRecent,
  rawToActivity,
  wsURL,
} from '@/lib/activity'

const MAX_ITEMS = 100

type ConnState = 'conectando' | 'en vivo' | 'reconectando'

function useActivity() {
  const [items, setItems] = useState<Activity[]>([])
  const [conn, setConn] = useState<ConnState>('conectando')
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout>

    // Carga inicial (historial reciente desde Postgres vía gateway).
    fetchRecent()
      .then((rows) => setItems(rows))
      .catch(() => {
        /* sin historial: seguimos solo con el vivo */
      })

    const connect = () => {
      if (closed) return
      const ws = new WebSocket(wsURL())
      wsRef.current = ws
      ws.onopen = () => setConn('en vivo')
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string)
          if (msg?.type === 'event' && msg.data) {
            const a = rawToActivity(msg.data)
            setItems((prev) => [a, ...prev].slice(0, MAX_ITEMS))
          }
        } catch {
          /* ignora mensajes no-JSON */
        }
      }
      ws.onclose = () => {
        if (closed) return
        setConn('reconectando')
        retry = setTimeout(connect, 2000) // reconexión simple
      }
      ws.onerror = () => ws.close()
    }
    connect()

    return () => {
      closed = true
      clearTimeout(retry)
      wsRef.current?.close()
    }
  }, [])

  return { items, conn }
}

function timeHHMMSS(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '--:--:--' : d.toLocaleTimeString('es', { hour12: false })
}

function roleClasses(role: string): string {
  // Color del chip por rol (reutiliza los tokens de estado del §10).
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

function App() {
  const { items, conn } = useActivity()

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-block size-3 rounded-full bg-brand" />
            <h1 className="text-2xl font-semibold tracking-tight">
              <span className="text-brand">Onix</span>
              <span className="text-foreground">Guard</span>
            </h1>
          </div>
          <ConnBadge conn={conn} />
        </header>

        {/* Lista de actividad en vivo */}
        <section className="rounded-card border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-medium text-muted-foreground">Actividad en vivo</h2>
            <span className="font-mono text-xs text-muted-foreground">{items.length} eventos</span>
          </div>

          {items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Esperando eventos… ejecuta una acción con un agente (onix-hook) para verla aquí.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((a) => (
                <li key={a.key} className="flex items-center gap-3 px-5 py-2.5">
                  <time className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                    {timeHHMMSS(a.ts)}
                  </time>
                  <span className={`shrink-0 rounded-[10px] px-2 py-0.5 text-xs ${roleClasses(a.agentRole)}`}>
                    {a.agentRole}
                  </span>
                  <span className="truncate font-mono text-sm text-foreground">{a.label}</span>
                  {a.isError && (
                    <span className="ml-auto shrink-0 rounded-[10px] bg-state-error px-2 py-0.5 text-xs text-state-error-fg">
                      error
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

function ConnBadge({ conn }: { conn: ConnState }) {
  const cls =
    conn === 'en vivo'
      ? 'bg-state-working text-state-working-fg'
      : conn === 'reconectando'
        ? 'bg-state-waiting text-state-waiting-fg'
        : 'bg-state-idle text-state-idle-fg'
  return (
    <span className={`inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5 font-mono text-xs ${cls}`}>
      <span aria-hidden className="inline-block size-2 rounded-full bg-current" />
      {conn}
    </span>
  )
}

export default App
