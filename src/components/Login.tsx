import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { login } from '@/lib/auth'

// Pantalla de login: card centrada con el logo OnixGuard, usuario y contraseña.
export default function Login({ onSuccess }: { onSuccess: () => void }) {
  // Pre-rellena usuario para dev; la contraseña nunca se hardcodea.
  const [username, setUsername] = useState('jefe')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const ok = await login(username, password)
      if (ok) {
        onSuccess()
      } else {
        setError('Usuario o contraseña incorrectos.')
      }
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm rounded-card border border-border bg-card p-6 shadow-sm sm:p-8">
        {/* Logo OnixGuard */}
        <div className="mb-6 flex items-center gap-3">
          <span aria-hidden className="inline-block size-3 rounded-full bg-brand" />
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-brand">Onix</span>
            <span className="text-foreground">Guard</span>
          </h1>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Inicia sesión para acceder al panel.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Usuario</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jefe"
              className="h-9 rounded-[10px] border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Contraseña</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="h-9 rounded-[10px] border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </label>

          {error ? (
            <p className="rounded-[10px] bg-state-error px-3 py-2 text-sm text-state-error-fg">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </main>
  )
}
