// Cliente de actividad en vivo (Fase 1): carga inicial por REST + stream por WebSocket.
// Apunta a onix-gateway. En dev, por defecto http://localhost:8080 (override con VITE_GATEWAY_URL).

export const GATEWAY_URL: string =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? "http://localhost:8080";

export function wsURL(): string {
  const u = new URL("/ws", GATEWAY_URL);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return u.toString();
}

// Forma normalizada que pinta la lista, venga de REST o de WS.
export interface Activity {
  key: string;
  ts: string; // ISO
  agentRole: string;
  label: string; // tool, hook o tipo
  isError: boolean;
}

// EventRow: lo que devuelve GET /api/events (aplanado por el gateway).
interface EventRow {
  id: string;
  ts: string;
  type: string;
  tool?: string;
  summary?: string;
  agent_role: string;
  is_error: boolean;
}

// RawEvent (parcial): lo que llega por WS dentro de {type:"event", data:<RawEvent>}.
interface RawEventLite {
  session?: string;
  agent_role?: string;
  hook?: string;
  ts?: string;
  tool?: string;
  result?: { exit_code?: number };
}

export function rowToActivity(r: EventRow): Activity {
  return {
    key: r.id,
    ts: r.ts,
    agentRole: r.agent_role,
    label: r.tool || r.summary || r.type,
    isError: r.is_error,
  };
}

export function rawToActivity(d: RawEventLite): Activity {
  const exit = d.result?.exit_code;
  return {
    key: `${d.session ?? "?"}-${d.ts ?? ""}-${Math.random().toString(36).slice(2, 8)}`,
    ts: d.ts ?? new Date().toISOString(),
    agentRole: d.agent_role ?? "?",
    label: d.tool || d.hook || "evento",
    isError: typeof exit === "number" && exit !== 0,
  };
}

export async function fetchRecent(): Promise<Activity[]> {
  const res = await fetch(new URL("/api/events", GATEWAY_URL).toString());
  if (!res.ok) throw new Error(`/api/events ${res.status}`);
  const rows = (await res.json()) as EventRow[];
  return rows.map(rowToActivity);
}
