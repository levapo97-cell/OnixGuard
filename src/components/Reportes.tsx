import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { wsURL } from '@/lib/activity'
import {
  type ReportDetail,
  type ReportListItem,
  type ReportStatus,
  fetchReport,
  fetchReports,
  respondReport,
  roleClasses,
  statusClasses,
} from '@/lib/reports'

function statusLabel(status: ReportStatus): string {
  switch (status) {
    case 'espera':
      return 'en espera'
    case 'aprobado':
      return 'aprobado'
    case 'cambios':
      return 'cambios'
    case 'respondido':
      return 'respondido'
    default:
      return status
  }
}

function StatusChip({ status }: { status: ReportStatus }) {
  return (
    <span className={`shrink-0 rounded-[10px] px-2 py-0.5 text-xs ${statusClasses(status)}`}>
      {statusLabel(status)}
    </span>
  )
}

function RoleChip({ role }: { role: string }) {
  return (
    <span className={`shrink-0 rounded-[10px] px-2 py-0.5 text-xs ${roleClasses(role)}`}>
      {role}
    </span>
  )
}

function timeHHMM(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function Reportes() {
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    try {
      const rows = await fetchReports()
      setReports(rows)
      setListError(null)
      // Selección por defecto: primer reporte si aún no hay nada seleccionado.
      setSelectedId((cur) => cur ?? rows[0]?.id ?? null)
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Error cargando reportes')
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  // Opcional: refresca la bandeja cuando llega un {type:"report"} por WS.
  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout>
    let ws: WebSocket | null = null

    const connect = () => {
      if (closed) return
      ws = new WebSocket(wsURL())
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string)
          if (msg?.type === 'report') loadList()
        } catch {
          /* ignora mensajes no-JSON */
        }
      }
      ws.onclose = () => {
        if (closed) return
        retry = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws?.close()
    }
    connect()

    return () => {
      closed = true
      clearTimeout(retry)
      ws?.close()
    }
  }, [loadList])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr_360px]">
      <Inbox
        reports={reports}
        loading={listLoading}
        error={listError}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <Detail reportId={selectedId} onChanged={loadList} />
    </div>
  )
}

function Inbox({
  reports,
  loading,
  error,
  selectedId,
  onSelect,
}: {
  reports: ReportListItem[]
  loading: boolean
  error: string | null
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="flex flex-col rounded-card border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-muted-foreground">Bandeja</h2>
        <span className="font-mono text-xs text-muted-foreground">{reports.length}</span>
      </div>

      {loading ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Cargando reportes…</p>
      ) : error ? (
        <p className="px-4 py-10 text-center text-sm text-state-error-fg">{error}</p>
      ) : reports.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">No hay reportes todavía</p>
      ) : (
        <ul className="divide-y divide-border">
          {reports.map((r) => {
            const active = r.id === selectedId
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  className={`flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-accent ${
                    active ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{r.title}</span>
                    <StatusChip status={r.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleChip role={r.agent_role} />
                    {r.stage != null && (
                      <span className="font-mono text-xs text-muted-foreground">etapa {r.stage}</span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-foreground">{value}</div>
    </div>
  )
}

function Detail({ reportId, onChanged }: { reportId: string | null; onChanged: () => void }) {
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!reportId) {
      setReport(null)
      return
    }
    setLoading(true)
    try {
      const d = await fetchReport(reportId)
      setReport(d)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando el reporte')
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    load()
  }, [load])

  // Refresca el detalle y avisa al padre para refrescar la bandeja.
  const handleChanged = useCallback(async () => {
    await load()
    onChanged()
  }, [load, onChanged])

  if (!reportId) {
    return (
      <section className="flex items-center justify-center rounded-card border border-border bg-card px-6 py-10 lg:col-span-2">
        <p className="text-sm text-muted-foreground">Selecciona un reporte de la bandeja</p>
      </section>
    )
  }

  if (loading && !report) {
    return (
      <section className="flex items-center justify-center rounded-card border border-border bg-card px-6 py-10 lg:col-span-2">
        <p className="text-sm text-muted-foreground">Cargando reporte…</p>
      </section>
    )
  }

  if (error && !report) {
    return (
      <section className="flex items-center justify-center rounded-card border border-border bg-card px-6 py-10 lg:col-span-2">
        <p className="text-sm text-state-error-fg">{error}</p>
      </section>
    )
  }

  if (!report) return null

  const fmt = (n: number | null, suffix = '') => (n == null ? '—' : `${n}${suffix}`)
  const cost = report.cost_usd == null ? '—' : `$${report.cost_usd.toFixed(4)}`

  return (
    <>
      {/* Centro: detalle */}
      <section className="flex flex-col gap-5 rounded-card border border-border bg-card p-5">
        <header className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">{report.title}</h2>
            <StatusChip status={report.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RoleChip role={report.agent_role} />
            {report.stage != null && (
              <span className="font-mono text-xs text-muted-foreground">etapa {report.stage}</span>
            )}
          </div>
        </header>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Tokens" value={fmt(report.tokens)} />
          <Metric label="Costo" value={cost} />
          <Metric label="Errores" value={fmt(report.errors)} />
          <Metric label="Repeticiones" value={fmt(report.repetitions)} />
        </div>

        {/* Resumen */}
        <div>
          <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">Resumen</h3>
          <p className="text-sm text-foreground">
            {report.summary ?? <span className="text-muted-foreground">Sin resumen.</span>}
          </p>
        </div>

        {/* Entregables */}
        <div>
          <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">Entregables</h3>
          {report.deliverables.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin entregables.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {report.deliverables.map((d, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <span aria-hidden className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-state-working-fg" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Decisiones */}
        <div>
          <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">Necesitan tu decisión</h3>
          {report.decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada pendiente.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {report.decisions.map((d, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-[10px] border border-state-waiting bg-state-waiting px-3 py-2 text-sm text-state-waiting-fg"
                >
                  <span aria-hidden className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-current" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Chat (derecha) */}
      <Chat report={report} onChanged={handleChanged} />
    </>
  )
}

function Chat({ report, onChanged }: { report: ReportDetail; onChanged: () => Promise<void> }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Baja al último mensaje al cambiar de reporte o recibir nuevos.
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [report.messages.length, report.id])

  const send = async (action: 'aprobar' | 'cambios' | 'responder') => {
    if ((action === 'cambios' || action === 'responder') && text.trim() === '') {
      setSendError('Escribe un mensaje primero.')
      return
    }
    setSending(true)
    setSendError(null)
    try {
      const message = action === 'aprobar' ? undefined : text.trim()
      await respondReport(report.id, action, message)
      setText('')
      await onChanged()
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="flex max-h-[80vh] flex-col rounded-card border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-muted-foreground">Conversación</h2>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {report.messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin mensajes todavía.</p>
        ) : (
          report.messages.map((m, i) => {
            const mine = m.sender === 'jefe'
            return (
              <div key={i} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-[12px] px-3 py-2 text-sm ${
                    mine
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-background text-foreground'
                  }`}
                >
                  {m.body}
                </div>
                <span className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {m.sender} · {timeHHMM(m.created_at)}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Controles */}
      <div className="flex flex-col gap-2 border-t border-border p-3">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1"
            disabled={sending}
            onClick={() => send('aprobar')}
          >
            Aprobar etapa
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={sending}
            onClick={() => send('cambios')}
          >
            Pedir cambios
          </Button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe una respuesta…"
          rows={2}
          disabled={sending}
          className="w-full resize-none rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={sending}
          onClick={() => send('responder')}
        >
          {sending ? 'Enviando…' : 'Enviar respuesta'}
        </Button>
        {sendError && <p className="text-xs text-state-error-fg">{sendError}</p>}
      </div>
    </section>
  )
}
