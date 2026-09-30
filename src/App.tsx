import { Button } from '@/components/ui/button'

function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-md rounded-card border border-border bg-card p-8 shadow-lg">
        <header className="mb-6 flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block size-3 rounded-full bg-brand"
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-brand">Onix</span>
            <span className="text-foreground">Guard</span>
          </h1>
        </header>

        <p className="mb-6 text-sm text-muted-foreground">
          Panel de monitoreo de agentes de Claude Code. Andamiaje (Fase 0):
          stack en marcha y compilando.
        </p>

        <div className="mb-6 flex items-center justify-between rounded-[10px] bg-state-working px-4 py-3">
          <span className="text-sm text-muted-foreground">Estado del panel</span>
          <span className="inline-flex items-center gap-2 font-mono text-sm text-state-working-fg">
            <span
              aria-hidden
              className="inline-block size-2 rounded-full bg-state-working-fg"
            />
            health: ok
          </span>
        </div>

        <Button className="w-full">Entrar al panel</Button>
      </section>
    </main>
  )
}

export default App
