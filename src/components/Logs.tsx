import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AGENT_ROLES,
  EVENT_TYPES,
  type ExportFormat,
  type ExportScope,
  type LogEvent,
  type LogEventDetail,
  type LogFilters,
  exportEvents,
  getEvent,
  listEvents,
  roleClasses,
} from '@/lib/logs'

const DEFAULT_LIMIT = 200

function timeHHMMSS(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '--:--:--' : d.toLocaleTimeString('es', { hour12: false })
}

const inputCls =
  'rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60'

export default function Logs() {
  const [q, setQ] = useState('')
  const [agent, setAgent] = useState('')
  const [type, setType] = useState('')
  const [stage, setStage] = useState('')

  const [events, setEvents] = useState<LogEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const filters: LogFilters = { limit: DEFAULT_LIMIT }
      if (agent) filters.agent = agent
      if (type) filters.type = type
      if (q.trim() !== '') filters.q = q
      const stageNum = Number.parseInt(stage, 10)
      if (stage.trim() !== '' && !Number.isNaN(stageNum)) filters.stage = stageNum

      const rows = await listEvents(filters)
      setEvents(rows)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando eventos')
    } finally {
      setLoading(false)
    }
  }, [agent, type, q, stage])

  // Re-fetch (con pequeño debounce) al cambiar cualquier filtro/buscador.
  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        q={q}
        agent={agent}
        type={type}
        stage={stage}
        onQ={setQ}
        onAgent={setAgent}
        onType={setType}
        onStage={setStage}
      />

      <ExportBar />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <EventsTable
          events={events}
          loading={loading}
          error={error}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <DetailPanel eventId={selectedId} />
      </div>
    </div>
  )
}

function FilterBar({
  q,
  agent,
  type,
  stage,
  onQ,
  onAgent,
  onType,
  onStage,
}: {
  q: string
  agent: string
  type: string
  stage: string
  onQ: (v: string) => void
  onAgent: (v: string) => void
  onType: (v: string) => void
  onStage: (v: string) => void
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Buscar</span>
        <input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Buscar en eventos…"
          className={`w-full ${inputCls}`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Agente</span>
        <select value={agent} onChange={(e) => onAgent(e.target.value)} className={inputCls}>
          <option value="">todos</option>
          {AGENT_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Tipo</span>
        <select value={type} onChange={(e) => onType(e.target.value)} className={inputCls}>
          <option value="">todos</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Etapa</span>
        <input
          type="number"
          min={1}
          value={stage}
          onChange={(e) => onStage(e.target.value)}
          placeholder="—"
          className={`w-24 ${inputCls}`}
        />
      </label>
    </section>
  )
}

function ExportBar() {
  const [scope, setScope] = useState<ExportScope>('todas')
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (format: ExportFormat) => {
    setBusy(format)
    setError(null)
    try {
      await exportEvents(scope, format)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Alcance</span>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as ExportScope)}
          className={inputCls}
        >
          <option value="todas">todas</option>
          <option value="etapa_actual">etapa_actual</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-state-error-fg">{error}</span>}
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run('jsonl')}>
          {busy === 'jsonl' ? 'Exportando…' : 'Exportar JSONL'}
        </Button>
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run('csv')}>
          {busy === 'csv' ? 'Exportando…' : 'Exportar CSV'}
        </Button>
      </div>
    </section>
  )
}

function RoleChip({ role }: { role: string }) {
  return (
    <span className={`shrink-0 rounded-[10px] px-2 py-0.5 text-xs ${roleClasses(role)}`}>
      {role}
    </span>
  )
}

function EventsTable({
  events,
  loading,
  error,
  selectedId,
  onSelect,
}: {
  events: LogEvent[]
  loading: boolean
  error: string | null
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="flex flex-col rounded-card border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-muted-foreground">Eventos</h2>
        <span className="font-mono text-xs text-muted-foreground">{events.length}</span>
      </div>

      {loading && events.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Cargando eventos…</p>
      ) : error ? (
        <p className="px-4 py-10 text-center text-sm text-state-error-fg">{error}</p>
      ) : events.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Sin eventos</p>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((e) => {
            const active = e.id === selectedId
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onSelect(e.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left font-mono text-sm transition-colors hover:bg-accent ${
                    active ? 'bg-accent' : ''
                  }`}
                >
                  <time className="w-20 shrink-0 text-xs text-muted-foreground">
                    {timeHHMMSS(e.ts)}
                  </time>
                  <RoleChip role={e.agent_role} />
                  <span className="shrink-0 text-xs text-muted-foreground">{e.type}</span>
                  <span className="truncate text-foreground">{e.tool ?? e.summary ?? '—'}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    {e.is_error && (
                      <span className="rounded-[10px] bg-state-error px-2 py-0.5 text-xs text-state-error-fg">
                        error
                      </span>
                    )}
                    {e.is_repetition && (
                      <span className="rounded-[10px] bg-state-repeat px-2 py-0.5 text-xs text-state-repeat-fg">
                        rep
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function DetailPanel({ eventId }: { eventId: string | null }) {
  const [detail, setDetail] = useState<LogEventDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId) {
      setDetail(null)
      return
    }
    setLoading(true)
    try {
      const d = await getEvent(eventId)
      setDetail(d)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando el evento')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  if (!eventId) {
    return (
      <section className="flex items-center justify-center rounded-card border border-border bg-card px-6 py-10">
        <p className="text-sm text-muted-foreground">Selecciona un evento de la lista</p>
      </section>
    )
  }

  if (loading && !detail) {
    return (
      <section className="flex items-center justify-center rounded-card border border-border bg-card px-6 py-10">
        <p className="text-sm text-muted-foreground">Cargando evento…</p>
      </section>
    )
  }

  if (error && !detail) {
    return (
      <section className="flex items-center justify-center rounded-card border border-border bg-card px-6 py-10">
        <p className="text-sm text-state-error-fg">{error}</p>
      </section>
    )
  }

  if (!detail) return null

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-card p-5">
      <header className="flex flex-wrap items-center gap-2">
        <RoleChip role={detail.agent_role} />
        <span className="font-mono text-xs text-muted-foreground">{detail.type}</span>
        {detail.is_error && (
          <span className="rounded-[10px] bg-state-error px-2 py-0.5 text-xs text-state-error-fg">
            error
          </span>
        )}
        {detail.is_repetition && (
          <span className="rounded-[10px] bg-state-repeat px-2 py-0.5 text-xs text-state-repeat-fg">
            rep
          </span>
        )}
      </header>

      <Field label="Tool" value={detail.tool} />
      <Field label="Resumen" value={detail.summary} />

      <div>
        <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">params_normalized</h3>
        {detail.params_normalized ? (
          <pre className="overflow-auto rounded-[10px] border border-border bg-background px-3 py-2 font-mono text-xs whitespace-pre-wrap text-foreground">
            {detail.params_normalized}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <MonoStat label="params_hash" value={detail.params_hash} />
        <MonoStat
          label="exit_code"
          value={detail.exit_code != null ? String(detail.exit_code) : null}
        />
        <MonoStat
          label="duration_ms"
          value={detail.duration_ms != null ? String(detail.duration_ms) : null}
        />
        <MonoStat label="stage" value={detail.stage != null ? String(detail.stage) : null} />
      </dl>

      <div>
        <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">Credenciales detectadas</h3>
        {detail.credentials.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin credenciales detectadas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.credentials.map((c, i) => (
              <li
                key={`${c.sha256}-${i}`}
                className="flex flex-col gap-1 rounded-[10px] border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">{c.kind}</span>
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                </div>
                <code className="truncate font-mono text-xs text-muted-foreground" title={c.sha256}>
                  {c.sha256}
                </code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium text-muted-foreground">{label}</h3>
      <p className="text-sm break-words text-foreground">{value ?? '—'}</p>
    </div>
  )
}

function MonoStat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-foreground" title={value ?? undefined}>
        {value ?? '—'}
      </dd>
    </div>
  )
}
