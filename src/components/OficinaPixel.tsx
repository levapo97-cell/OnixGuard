import { useEffect, useMemo, useRef, useState } from 'react'
import { wsURL } from '@/lib/activity'
import { type Agent, type AgentStatus, fetchAgents } from '@/lib/metrics'

// ── Oficina Pixel (Fase 9) ───────────────────────────────────────────────────
// Canvas 2D puro, pixel-art procedural (sin spritesheets). Un "gato" por agente
// sentado en un escritorio. Burbujas de acción en DOM (texto nítido) sobre el
// canvas. Escucha el WS para refrescar agentes y pintar burbujas de tools.

// Lienzo lógico fijo; se escala al ancho del contenedor con image-rendering:pixelated.
const LOGICAL_W = 640
const TOP_WALL = 44 // franja de pared superior
const ROW_H = 98 // alto de cada fila de escritorios
const MAX_PER_ROW = 4

// Colores del canvas (§10 del plan).
const COLOR_FLOOR = '#DDE7E2'
const COLOR_WALL = '#F4F1EA'
const COLOR_DESK = '#B8803E'
const COLOR_DESK_DARK = '#8A5F2C'
const COLOR_CAT = '#7D7D7D'
const COLOR_CAT_LIGHT = '#8E8E8E'
const COLOR_INK = '#2E2E2E'

// Estado del agente -> color del monitor / gato.
function statusColor(status: AgentStatus): string {
  switch (status) {
    case 'activa':
      return '#7ACB7F'
    case 'pausada':
      return '#F0C060'
    default: // cerrada | inactivo
      return '#BDBDBD'
  }
}

interface Slot {
  cx: number // centro X (coords lógicas)
  deskY: number // Y del tablero del escritorio
  headY: number // Y de la cabeza del gato (ancla de burbuja/etiqueta)
}

// Calcula la grilla de escritorios para N agentes. Determinista: lo usan el
// dibujado del canvas y el posicionamiento DOM (burbujas/etiquetas).
function computeLayout(count: number) {
  const perRow = Math.min(Math.max(count, 1), MAX_PER_ROW)
  const rows = Math.max(1, Math.ceil(count / perRow))
  const height = Math.max(240, TOP_WALL + rows * ROW_H)
  const cellW = LOGICAL_W / perRow
  const slots: Slot[] = []
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / perRow)
    const c = i % perRow
    const cx = c * cellW + cellW / 2
    const baseY = TOP_WALL + r * ROW_H
    const deskY = baseY + 62
    const headY = baseY + 16
    slots.push({ cx, deskY, headY })
  }
  return { slots, height, rows }
}

interface Bubble {
  id: number
  role: string
  tool: string
}

export default function OficinaPixel() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Referencia siempre fresca de agentes para el loop de rAF (sin re-suscribir).
  const agentsRef = useRef<Agent[]>([])
  useEffect(() => {
    agentsRef.current = agents
  }, [agents])

  const layout = useMemo(() => computeLayout(agents.length), [agents.length])

  // ── Datos + WS: refresco de agentes y burbujas de tools ────────────────────
  useEffect(() => {
    let closed = false
    let wsRetry: ReturnType<typeof setTimeout>
    let debounce: ReturnType<typeof setTimeout> | undefined
    let ws: WebSocket | null = null
    const bubbleTimers = new Set<ReturnType<typeof setTimeout>>()
    let bubbleSeq = 0

    const load = () => {
      fetchAgents()
        .then((rows) => {
          if (!closed) setAgents(rows)
        })
        .catch(() => {
          /* sin agentes: estado vacío */
        })
    }

    const scheduleLoad = () => {
      clearTimeout(debounce)
      debounce = setTimeout(load, 300) // debounce de ráfagas WS
    }

    load() // carga inicial

    const connect = () => {
      if (closed) return
      ws = new WebSocket(wsURL())
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string)
          if (msg?.type === 'agent_status' || msg?.type === 'metrics') {
            scheduleLoad()
          } else if (msg?.type === 'event' && msg.data?.agent_role) {
            const role = String(msg.data.agent_role)
            const tool = String(msg.data.tool || msg.data.hook || 'evento')
            const id = ++bubbleSeq
            setBubbles((prev) => [...prev.slice(-11), { id, role, tool }])
            const t = setTimeout(() => {
              if (closed) return
              setBubbles((prev) => prev.filter((b) => b.id !== id))
              bubbleTimers.delete(t)
            }, 2600) // se desvanece ~2.5s (animación) + margen
            bubbleTimers.add(t)
          }
        } catch {
          /* ignora mensajes no-JSON */
        }
      }
      ws.onclose = () => {
        if (closed) return
        wsRetry = setTimeout(connect, 2000) // auto-reconexión
      }
      ws.onerror = () => ws?.close()
    }
    connect()

    return () => {
      closed = true
      clearTimeout(wsRetry)
      clearTimeout(debounce)
      for (const t of bubbleTimers) clearTimeout(t)
      ws?.close()
    }
  }, [])

  // ── Dibujado en canvas con requestAnimationFrame (throttle ~10fps) ──────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let last = 0
    let phase = 0
    const FRAME_MS = 1000 / 10 // ~10 fps: animación ligera, sin quemar CPU

    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
    }

    const drawCatDesk = (s: Slot, color: string, typing: boolean, ph: number) => {
      const { cx, deskY } = s
      const catX = cx - 12
      const catY = deskY - 34
      // sombra/silla
      px(cx - 16, deskY + 24, 32, 6, '#C4D1CB')
      // cuerpo del gato
      px(catX, catY + 10, 24, 18, COLOR_CAT)
      // cola
      px(catX + 22, catY + 8, 6, 14, COLOR_CAT_LIGHT)
      // cabeza
      px(catX + 2, catY - 4, 20, 16, COLOR_CAT_LIGHT)
      // orejas
      px(catX + 2, catY - 10, 6, 6, COLOR_CAT_LIGHT)
      px(catX + 16, catY - 10, 6, 6, COLOR_CAT_LIGHT)
      // ojos
      px(catX + 7, catY + 2, 3, 3, COLOR_INK)
      px(catX + 14, catY + 2, 3, 3, COLOR_INK)
      // collar con color de estado (refuerza el estado del gato)
      px(catX + 4, catY + 9, 16, 3, color)
      // escritorio (tablero + patas)
      px(cx - 42, deskY + 18, 84, 8, COLOR_DESK)
      px(cx - 40, deskY + 26, 6, 18, COLOR_DESK_DARK)
      px(cx + 34, deskY + 26, 6, 18, COLOR_DESK_DARK)
      // monitor con pantalla = color de estado
      const mx = cx + 16
      const my = deskY - 6
      px(mx, my, 24, 18, COLOR_INK)
      px(mx + 2, my + 2, 20, 14, color)
      px(mx + 9, my + 18, 6, 3, COLOR_INK)
      px(mx + 5, my + 21, 14, 2, COLOR_INK)
      // patas "tecleando": suben/bajan si el agente está activa
      const off = typing ? Math.round(Math.sin(ph) * 3) : 0
      px(cx - 10, deskY + 12 + off, 7, 6, COLOR_CAT_LIGHT)
      px(cx + 2, deskY + 12 - off, 7, 6, COLOR_CAT_LIGHT)
    }

    const draw = () => {
      const list = agentsRef.current
      const { slots, height } = computeLayout(list.length)
      if (canvas.width !== LOGICAL_W) canvas.width = LOGICAL_W
      if (canvas.height !== height) canvas.height = height

      // piso + pared
      px(0, 0, LOGICAL_W, height, COLOR_FLOOR)
      px(0, 0, LOGICAL_W, TOP_WALL, COLOR_WALL)
      // zócalo
      px(0, TOP_WALL, LOGICAL_W, 3, '#C9CFCB')

      for (let i = 0; i < list.length; i++) {
        const a = list[i]
        const s = slots[i]
        if (!s) continue
        drawCatDesk(s, statusColor(a.status), a.status === 'activa', phase)
      }
    }

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (t - last < FRAME_MS) return
      last = t
      phase += 0.65
      draw()
    }
    raf = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(raf)
  }, [])

  const hasAgents = agents.length > 0

  return (
    <section className="rounded-card border border-border bg-card p-4">
      <style>{`
        @keyframes onix-bubble {
          0%   { opacity: 0; transform: translate(-50%, -90%) scale(.92); }
          12%  { opacity: 1; transform: translate(-50%, -100%) scale(1); }
          78%  { opacity: 1; transform: translate(-50%, -100%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -112%) scale(1); }
        }
      `}</style>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Oficina</h2>

      {!hasAgents ? (
        <div className="rounded-card border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          Sin agentes aún
        </div>
      ) : (
        <div className="relative w-full overflow-hidden rounded-[12px] border border-border">
          <canvas
            ref={canvasRef}
            width={LOGICAL_W}
            height={layout.height}
            className="block w-full"
            style={{ imageRendering: 'pixelated' }}
            aria-label="Oficina pixel-art de agentes"
          />

          {/* Overlay DOM alineado al lienzo lógico (coords en %). */}
          <div className="pointer-events-none absolute inset-0">
            {/* Etiquetas de rol bajo cada gato */}
            {agents.map((a, i) => {
              const s = layout.slots[i]
              if (!s) return null
              const leftPct = (s.cx / LOGICAL_W) * 100
              const topPct = ((s.deskY + 48) / layout.height) * 100
              return (
                <span
                  key={`lbl-${a.id}`}
                  className="absolute -translate-x-1/2 truncate font-mono text-[10px] text-muted-foreground"
                  style={{ left: `${leftPct}%`, top: `${topPct}%`, maxWidth: '24%' }}
                >
                  {a.role}
                </span>
              )
            })}

            {/* Burbujas de acción (tool) sobre el gato del rol */}
            {bubbles.map((b) => {
              const idx = agents.findIndex((a) => a.role === b.role)
              if (idx < 0) return null
              const s = layout.slots[idx]
              if (!s) return null
              const leftPct = (s.cx / LOGICAL_W) * 100
              const topPct = (s.headY / layout.height) * 100
              return (
                <span
                  key={b.id}
                  className="absolute whitespace-nowrap rounded-[8px] border border-border bg-popover px-2 py-0.5 font-mono text-[10px] text-foreground shadow-md"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    transform: 'translate(-50%, -100%)',
                    animation: 'onix-bubble 2500ms ease-out forwards',
                  }}
                >
                  {b.tool}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
