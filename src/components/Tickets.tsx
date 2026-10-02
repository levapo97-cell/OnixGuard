import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { wsURL } from '@/lib/activity'
import {
  type TicketDetail,
  type TicketListItem,
  type TicketStage,
  createTicket,
  getTicket,
  listTickets,
  stageStatusClasses,
  ticketStatusClasses,
  ticketStatusLabel,
  uploadAttachment,
} from '@/lib/tickets'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`shrink-0 rounded-[10px] px-2 py-0.5 text-xs ${ticketStatusClasses(status)}`}>
      {ticketStatusLabel(status)}
    </span>
  )
}

export default function Tickets() {
  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    try {
      const rows = await listTickets()
      setTickets(rows)
      setListError(null)
      setSelectedId((cur) => cur ?? rows[0]?.id ?? null)
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Error cargando tickets')
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  // Refresco en vivo: al recibir {type:"report"|"stage"} refrescamos la lista.
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
          if (msg?.type === 'report' || msg?.type === 'stage') loadList()
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

  const handleCreated = useCallback(
    async (id: string) => {
      await loadList()
      setSelectedId(id)
    },
    [loadList],
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-4">
        <CreateForm onCreated={handleCreated} />
        <TicketList
          tickets={tickets}
          loading={listLoading}
          error={listError}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRefresh={loadList}
        />
      </div>
      <Detail ticketId={selectedId} />
    </div>
  )
}

function CreateForm({ onCreated }: { onCreated: (id: string) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim() === '') {
      setError('El título es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { id } = await createTicket(title.trim(), body.trim())
      setTitle('')
      setBody('')
      await onCreated(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el ticket')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <h2 className="text-sm font-medium text-muted-foreground">Crear ticket</h2>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        disabled={saving}
        className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Descripción / cuerpo del ticket…"
        rows={4}
        disabled={saving}
        className="w-full resize-none rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
      />
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? 'Creando…' : 'Crear ticket'}
      </Button>
      {error && <p className="text-xs text-state-error-fg">{error}</p>}
    </form>
  )
}

function TicketList({
  tickets,
  loading,
  error,
  selectedId,
  onSelect,
  onRefresh,
}: {
  tickets: TicketListItem[]
  loading: boolean
  error: string | null
  selectedId: string | null
  onSelect: (id: string) => void
  onRefresh: () => void
}) {
  return (
    <section className="flex flex-col rounded-card border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-muted-foreground">Tickets</h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{tickets.length}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-[8px] px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Cargando tickets…</p>
      ) : error ? (
        <p className="px-4 py-10 text-center text-sm text-state-error-fg">{error}</p>
      ) : tickets.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No hay tickets todavía
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {tickets.map((t) => {
            const active = t.id === selectedId
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className={`flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-accent ${
                    active ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{t.title}</span>
                    <StatusChip status={t.status} />
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span>{t.source}</span>
                    <span aria-hidden>·</span>
                    <span>{fmtDate(t.created_at)}</span>
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

function Detail({ ticketId }: { ticketId: string | null }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!ticketId) {
      setTicket(null)
      return
    }
    setLoading(true)
    try {
      const d = await getTicket(ticketId)
      setTicket(d)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando el ticket')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    load()
  }, [load])

  if (!ticketId) {
    return (
      <section className="flex items-center justify-center rounded-card border border-border bg-card px-6 py-10">
        <p className="text-sm text-muted-foreground">Selecciona un ticket de la lista</p>
      </section>
    )
  }

  if (loading && !ticket) {
    return (
      <section className="flex items-center justify-center rounded-card border border-border bg-card px-6 py-10">
        <p className="text-sm text-muted-foreground">Cargando ticket…</p>
      </section>
    )
  }

  if (error && !ticket) {
    return (
      <section className="flex items-center justify-center rounded-card border border-border bg-card px-6 py-10">
        <p className="text-sm text-state-error-fg">{error}</p>
      </section>
    )
  }

  if (!ticket) return null

  return (
    <section className="flex flex-col gap-5 rounded-card border border-border bg-card p-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{ticket.title}</h2>
          <StatusChip status={ticket.status} />
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>{ticket.source}</span>
          <span aria-hidden>·</span>
          <span>{fmtDate(ticket.created_at)}</span>
        </div>
      </header>

      {/* Cuerpo */}
      <div>
        <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">Descripción</h3>
        {ticket.body ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.body}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sin descripción.</p>
        )}
      </div>

      {/* Plan de ejecución */}
      <div>
        <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">Plan de ejecución</h3>
        {ticket.stages.length === 0 ? (
          <p className="rounded-[10px] border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
            Sin plan todavía — el agente debe registrarlo (registrar_plan)
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {ticket.stages
              .slice()
              .sort((a, b) => a.number - b.number)
              .map((s) => (
                <StageRow key={s.number} stage={s} />
              ))}
          </ol>
        )}
      </div>

      {/* Adjuntar archivo */}
      <AttachmentUploader ticketId={ticket.id} onUploaded={load} />

      {/* Nota aclaratoria sobre aprobación */}
      <p className="rounded-[10px] border border-state-waiting bg-state-waiting px-3 py-2 text-xs text-state-waiting-fg">
        La aprobación del plan se hace en la pestaña Reportes (el plan llega como un reporte "Plan
        de ejecución").
      </p>
    </section>
  )
}

function AttachmentUploader({
  ticketId,
  onUploaded,
}: {
  ticketId: string
  onUploaded: () => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!file) {
      setError('Selecciona un archivo primero.')
      return
    }
    setUploading(true)
    setMessage(null)
    setError(null)
    try {
      const res = await uploadAttachment(ticketId, file)
      if (!res.ok) {
        setError(res.error ?? 'No se pudo subir el archivo.')
        return
      }
      const name = res.filename ?? file.name
      let msg = `Archivo ${name} adjuntado`
      if (res.ingested_text) {
        msg += ' — su contenido se agregó al ticket para que el agente lo use al generar el plan'
      }
      setMessage(msg)
      // Limpia el input para permitir re-subir el mismo archivo.
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      // Re-fetch del ticket para ver el body actualizado por el backend.
      await onUploaded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">Adjuntar archivo</h3>
      <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-background px-3 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            type="file"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setMessage(null)
              setError(null)
            }}
            disabled={uploading}
            className="min-w-0 flex-1 text-sm text-foreground file:mr-3 file:rounded-[8px] file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
          />
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={uploading || !file}
            className="shrink-0"
          >
            {uploading ? 'Subiendo…' : 'Subir archivo'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Sube el plan o el ticket como archivo (.md, .txt, .json…) y el agente lo leerá para armar
          las fases.
        </p>
        {message && <p className="text-xs text-state-working-fg">{message}</p>}
        {error && <p className="text-xs text-state-error-fg">{error}</p>}
      </div>
    </div>
  )
}

function StageRow({ stage }: { stage: TicketStage }) {
  return (
    <li className="flex items-center gap-3 rounded-[10px] border border-border bg-background px-3 py-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs text-muted-foreground">
        {stage.number}
      </span>
      <span className="flex-1 text-sm text-foreground">{stage.name}</span>
      <span className={`shrink-0 rounded-[10px] px-2 py-0.5 text-xs ${stageStatusClasses(stage.status)}`}>
        {stage.status}
      </span>
    </li>
  )
}
