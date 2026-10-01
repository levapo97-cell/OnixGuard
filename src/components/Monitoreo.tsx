import { useEffect, useRef, useState } from 'react'
import {
  type Activity,
  fetchRecent,
  rawToActivity,
  wsURL,
} from '@/lib/activity'
import {
  type Agent,
  type AgentStatus,
  type Overview,
  type Stage,
  fetchAgents,
  fetchOverview,
  fetchStages,
  formatCost,
  formatInt,
} from '@/lib/metrics'

const MAX_ITEMS = 100

// Tipos de mensaje WS que invalidan las métricas y disparan un refetch.
const METRIC_MSG_TYPES = new Set(['event', 'metrics', 'stage', 'agent_status'])
const REFRESH_MS = 5000 // fallback por polling
const DEBOUNCE_MS = 250 // agrupa ráfagas de mensajes WS

// Hook de métricas: carga inicial + refetch por WS (debounce) + polling fallback.
function useMetrics() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let closed = false
    let wsRetry: ReturnType<typeof setTimeout>
    let debounce: ReturnType<typeof setTimeout> | undefined
    let ws: WebSocket | null = null

    const load = () => {
      Promise.allSettled([fetchOverview(), fetchStages(), fetchAgents()])
        .then(([ov, st, ag]) => {
          if (closed) return
          if (ov.status === 'fulfilled') setOverview(ov.value)
          if (st.status === 'fulfilled') setStages(st.value)
          if (ag.status === 'fulfilled') setAgents(ag.value)
          const failed = ov.status === 'rejected' && st.status === 'rejected' && ag.status === 'rejected'
          setError(failed ? 'No se pudo conectar con el gateway' : null)
        })
        .finally(() => {
          if (!closed) setLoading(false)
        })
    }

    const scheduleLoad = () => {
      clearTimeout(debounce)
      debounce = setTimeout(load, DEBOUNCE_MS)
    }

    // Carga inicial.
    load()

    // Suscripción WS: refetch al llegar un mensaje relevante.
    const connect = () => {
      if (closed) return
      ws = new WebSocket(wsURL())
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string)
          if (msg?.type && METRIC_MSG_TYPES.has(msg.type)) scheduleLoad()
        } catch {
          /* ignora mensajes no-JSON */
        }
      }
      ws.onclose = () => {
        if (closed) return
        wsRetry = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws?.close()
    }
    connect()

    // Fallback: polling cada 5s.
    const interval = setInterval(load, REFRESH_MS)

    return () => {
      closed = true
      clearTimeout(wsRetry)
      clearTimeout(debounce)
      clearInterval(interval)
      ws?.close()
    }
  }, [])

  return { overview, stages, agents, error, loading }
}

export type ConnState = 'conectando' | 'en vivo' | 'reconectando'

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

export function ConnBadge({ conn }: { conn: ConnState }) {
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

// ── Bloque 1: fila de métricas ───────────────────────────────────────────────
function MetricTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-card border border-border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-mono text-xl font-semibold ${accent ? 'text-brand' : 'text-foreground'}`}
      >
        {value}
      </div>
    </div>
  )
}

function MetricsHeader({ overview }: { overview: Overview | null }) {
  const total = overview?.total_stages ?? 12
  const current = overview?.current_stage ?? 0
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricTile label="Herramientas" value={formatInt(overview?.tools)} />
      <MetricTile label="Tokens" value={formatInt(overview?.tokens)} />
      <MetricTile label="Costo (USD)" value={formatCost(overview?.cost_usd)} />
      <MetricTile label="Errores" value={formatInt(overview?.errors)} />
      <MetricTile label="Repeticiones" value={formatInt(overview?.repetitions)} />
      <MetricTile label="Etapa" value={`${current}/${total}`} accent />
    </div>
  )
}

// ── Bloque 2: barra de 12 etapas ──────────────────────────────────────────────
function stageClasses(status: Stage['status']): string {
  switch (status) {
    case 'hecha':
      return 'bg-state-working text-state-working-fg'
    case 'activa':
      return 'bg-brand text-white'
    default:
      return 'bg-state-idle text-state-idle-fg'
  }
}

function StagesBar({ stages }: { stages: Stage[] }) {
  const TOTAL = 12
  // Normaliza a 12 segmentos aunque el gateway devuelva menos/ninguno.
  const segments: Stage[] = Array.from({ length: TOTAL }, (_, i) => {
    const found = stages.find((s) => s.number === i + 1)
    return found ?? { number: i + 1, name: `Etapa ${i + 1}`, status: 'pendiente' }
  })

  return (
    <section className="rounded-card border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Etapas (12)</h2>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
        {segments.map((s) => (
          <div
            key={s.number}
            title={`${s.number}. ${s.name} — ${s.status}`}
            className={`flex h-9 items-center justify-center rounded-[8px] font-mono text-xs font-medium ${stageClasses(s.status)}`}
          >
            {s.number}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Bloque 3: tarjetas por agente ─────────────────────────────────────────────
function agentStatusLabel(status: AgentStatus): { text: string; cls: string } {
  switch (status) {
    case 'activa':
      return { text: 'activa', cls: 'bg-state-working text-state-working-fg' }
    case 'pausada':
      return { text: 'pausada', cls: 'bg-state-waiting text-state-waiting-fg' }
    case 'cerrada':
      return { text: 'cerrada', cls: 'bg-state-idle text-state-idle-fg' }
    default:
      return { text: 'inactivo', cls: 'bg-state-idle text-state-idle-fg' }
  }
}

function AgentCard({ agent }: { agent: Agent }) {
  const badge = agentStatusLabel(agent.status)
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {agent.display_name ?? agent.role}
          </div>
          <div className="truncate font-mono text-xs text-muted-foreground">{agent.role}</div>
        </div>
        <span
          className={`shrink-0 rounded-[10px] px-2 py-0.5 text-xs ${badge.cls}`}
        >
          {badge.text}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-y-2 text-xs">
        <Stat label="Eventos" value={formatInt(agent.events)} />
        <Stat label="Errores" value={formatInt(agent.errors)} />
        <Stat label="Repet." value={formatInt(agent.repetitions)} />
        <Stat label="Tokens" value={formatInt(agent.tokens)} />
        <Stat label="Costo" value={formatCost(agent.cost_usd)} />
      </dl>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-foreground">{value}</dd>
    </div>
  )
}

function AgentsGrid({ agents }: { agents: Agent[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Agentes</h2>
      {agents.length === 0 ? (
        <div className="rounded-card border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          Sin agentes activos.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function Monitoreo() {
  const { items, conn } = useActivity()
  const { overview, stages, agents, error } = useMetrics()

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-card border border-border bg-state-error px-4 py-2 text-sm text-state-error-fg">
          {error}
        </div>
      )}

      <MetricsHeader overview={overview} />
      <StagesBar stages={stages} />
      <AgentsGrid agents={agents} />

      <section className="rounded-card border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Actividad en vivo</h2>
            <ConnBadge conn={conn} />
          </div>
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
  )
}
