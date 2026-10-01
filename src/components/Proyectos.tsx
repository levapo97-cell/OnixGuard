import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AgentUnavailableError,
  type CheckRepoResponse,
  type CloneRepoResponse,
  type Project,
  checkRepo,
  cloneRepo,
  listProjects,
} from '@/lib/projects'

// Aviso reutilizable cuando el onix-agent de la PC no está conectado (gateway → 502).
function AgentOfflineNotice() {
  return (
    <p className="rounded-[10px] border border-state-error bg-state-error px-3 py-2 text-xs text-state-error-fg">
      Agente local (onix-agent) no conectado — inícialo en tu PC para conectar la plataforma con tus
      repos locales.
    </p>
  )
}

function GitChip({ isGit }: { isGit: boolean }) {
  return isGit ? (
    <span className="shrink-0 rounded-[10px] bg-state-working px-2 py-0.5 text-xs text-state-working-fg">
      git
    </span>
  ) : (
    <span className="shrink-0 rounded-[10px] bg-state-idle px-2 py-0.5 text-xs text-state-idle-fg">
      sin git
    </span>
  )
}

export default function Proyectos() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agentOffline, setAgentOffline] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listProjects()
      if (!res.ok) {
        setError(res.error || 'No se pudieron cargar los proyectos')
        setProjects([])
      } else {
        setProjects(res.projects ?? [])
        setError(null)
      }
      setAgentOffline(false)
    } catch (e) {
      if (e instanceof AgentUnavailableError) {
        setAgentOffline(true)
        setError(null)
      } else {
        setError(e instanceof Error ? e.message : 'Error cargando proyectos')
      }
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
      <section className="flex flex-col rounded-card border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Proyectos en tu PC</h2>
            <span className="font-mono text-xs text-muted-foreground">{projects.length}</span>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </Button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Requiere el demonio onix-agent corriendo en tu PC (conecta la plataforma con tus repos
            locales).
          </p>

          {agentOffline && <AgentOfflineNotice />}

          {loading ? (
            <p className="px-1 py-8 text-center text-sm text-muted-foreground">
              Cargando proyectos…
            </p>
          ) : error ? (
            <p className="px-1 py-8 text-center text-sm text-state-error-fg">{error}</p>
          ) : projects.length === 0 ? (
            <p className="px-1 py-8 text-center text-sm text-muted-foreground">
              No hay proyectos o el agente local no está conectado.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-[10px] border border-border">
              {projects.map((p) => (
                <li
                  key={p.path}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-mono text-sm text-foreground">{p.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{p.path}</span>
                  </div>
                  <GitChip isGit={p.is_git} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <CloneForm onCloned={load} onAgentOffline={() => setAgentOffline(true)} />
        <CheckForm onAgentOffline={() => setAgentOffline(true)} />
      </div>
    </div>
  )
}

function CloneForm({
  onCloned,
  onAgentOffline,
}: {
  onCloned: () => void
  onAgentOffline: () => void
}) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CloneRepoResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim() === '') {
      setError('La URL del repositorio es obligatoria.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    setOffline(false)
    try {
      const res = await cloneRepo(url.trim())
      setResult(res)
      if (res.ok) {
        setUrl('')
        onCloned()
      } else {
        setError(res.error || 'No se pudo clonar el repositorio')
      }
    } catch (err) {
      if (err instanceof AgentUnavailableError) {
        setOffline(true)
        onAgentOffline()
      } else {
        setError(err instanceof Error ? err.message : 'Error al clonar el repositorio')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <h2 className="text-sm font-medium text-muted-foreground">Clonar repositorio</h2>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/usuario/repo.git"
        disabled={loading}
        className="w-full rounded-[10px] border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
      />
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? 'Clonando…' : 'Clonar'}
      </Button>

      {offline && <AgentOfflineNotice />}
      {error && <p className="text-xs text-state-error-fg">{error}</p>}

      {result?.ok && (
        <div className="flex flex-col gap-1 rounded-[10px] border border-state-working bg-state-working px-3 py-2">
          <span className="text-xs text-state-working-fg">Repositorio clonado en:</span>
          <span className="break-all font-mono text-xs text-state-working-fg">{result.path}</span>
        </div>
      )}
      {result && !result.ok && result.output && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-[10px] border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
          {result.output}
        </pre>
      )}
    </form>
  )
}

function CheckForm({ onAgentOffline }: { onAgentOffline: () => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckRepoResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() === '') {
      setError('El nombre del repo es obligatorio.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    setOffline(false)
    try {
      const res = await checkRepo(name.trim())
      setResult(res)
      if (!res.ok) setError(res.error || 'No se pudo validar el repo')
    } catch (err) {
      if (err instanceof AgentUnavailableError) {
        setOffline(true)
        onAgentOffline()
      } else {
        setError(err instanceof Error ? err.message : 'Error al validar el repo')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <h2 className="text-sm font-medium text-muted-foreground">Validar repo por nombre</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="nombre-del-repo"
        disabled={loading}
        className="w-full rounded-[10px] border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
      />
      <Button type="submit" variant="outline" size="sm" disabled={loading}>
        {loading ? 'Validando…' : 'Validar'}
      </Button>

      {offline && <AgentOfflineNotice />}
      {error && <p className="text-xs text-state-error-fg">{error}</p>}

      {result?.ok && (
        <div className="flex flex-col gap-1 rounded-[10px] border border-border bg-background px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {result.exists ? 'Existe' : 'No existe'}
          </span>
          {result.exists && result.path && (
            <span className="break-all font-mono text-xs text-foreground">{result.path}</span>
          )}
        </div>
      )}
    </form>
  )
}
