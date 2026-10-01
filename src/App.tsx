import { type ReactNode, useState } from 'react'
import Monitoreo from '@/components/Monitoreo'
import Reportes from '@/components/Reportes'
import Tickets from '@/components/Tickets'

type View = 'monitoreo' | 'reportes' | 'tickets'

function App() {
  const [view, setView] = useState<View>('monitoreo')

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
          </nav>
        </header>

        {view === 'monitoreo' ? <Monitoreo /> : view === 'reportes' ? <Reportes /> : <Tickets />}
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
