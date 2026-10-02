import { type ReactNode, useEffect, useState } from 'react'
import Login from '@/components/Login'
import Logs from '@/components/Logs'
import Monitoreo from '@/components/Monitoreo'
import Proyectos from '@/components/Proyectos'
import Reportes from '@/components/Reportes'
import Sesiones from '@/components/Sesiones'
import Tickets from '@/components/Tickets'
import { Button } from '@/components/ui/button'
import { getToken, logout, UNAUTHORIZED_EVENT } from '@/lib/auth'

type View = 'monitoreo' | 'reportes' | 'tickets' | 'proyectos' | 'logs' | 'sesiones'

function App() {
  const [view, setView] = useState<View>('monitoreo')
  const [authed, setAuthed] = useState<boolean>(() => Boolean(getToken()))

  // Vuelve al login si el token falta o expira (401 en cualquier fetch/WS).
  useEffect(() => {
    const onUnauthorized = () => setAuthed(false)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  function handleLogout() {
    logout()
    setAuthed(false)
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        {/* Header + navegación */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-block size-3 rounded-full bg-brand" />
            <h1 className="text-2xl font-semibold tracking-tight">
              <span className="text-brand">Onix</span>
              <span className="text-foreground">Guard</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 rounded-[10px] border border-border bg-card p-1">
              <NavTab active={view === 'monitoreo'} onClick={() => setView('monitoreo')}>
                Monitoreo
              </NavTab>
              <NavTab active={view === 'reportes'} onClick={() => setView('reportes')}>
                Reportes
              </NavTab>
              <NavTab active={view === 'tickets'} onClick={() => setView('tickets')}>
                Tickets
              </NavTab>
              <NavTab active={view === 'proyectos'} onClick={() => setView('proyectos')}>
                Proyectos
              </NavTab>
              <NavTab active={view === 'logs'} onClick={() => setView('logs')}>
                Logs
              </NavTab>
              <NavTab active={view === 'sesiones'} onClick={() => setView('sesiones')}>
                Sesiones
              </NavTab>
            </nav>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Salir
            </Button>
          </div>
        </header>

        {view === 'monitoreo' ? (
          <Monitoreo />
        ) : view === 'reportes' ? (
          <Reportes />
        ) : view === 'tickets' ? (
          <Tickets />
        ) : view === 'proyectos' ? (
          <Proyectos />
        ) : view === 'logs' ? (
          <Logs />
        ) : (
          <Sesiones />
        )}
      </div>
    </main>
  )
}

function NavTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

export default App
