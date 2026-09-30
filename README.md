# OnixGuard (frontend)

Panel web para **monitorear y controlar en tiempo real** un equipo de agentes de Claude Code, y **estudiar** su desempeño. Es el repo del **frontend**; los servicios viven en los repos `onix-*` (ver `onix-deploy`).

> **Estado (Fase 0):** andamiaje montado y compilando. Página base con los tokens de diseño. Las 3 pantallas (Monitoreo, Reportes, Logs) se construyen en Fases 1–6.

---

## Stack

- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** (CSS-first: la config vive en `src/index.css` con `@theme`, no hay `tailwind.config.js`)
- **shadcn/ui** (estilo new-york, iconos lucide)
- Fuentes **Geist** y **Geist Mono** empaquetadas (`@fontsource-variable/*`, sin CDN en runtime)
- Estado en vivo por **WebSocket** (se cablea en Fase 1)

## Tokens de diseño (§10 del plan)

Definidos como variables CSS en `src/index.css` y mapeados a los tokens semánticos de shadcn:

| Token | Valor |
|-------|-------|
| fondo | `#1A1A1A` |
| tarjetas | `#212121` |
| bordes | `#2E2E2E` |
| texto / secundario | `#EDEDED` / `#A0A0A0` |
| marca (acento) | `#FF3B4E` |
| estados | trabajando `#7ACB7F` · error `#FF8080` · repetición `#C4A7FF` · esperando `#F0C060` · inactivo `#BDBDBD` |
| radios | tarjetas 16px · botones 10px |

`public/logo.svg` está **RESERVADO** (la máscara Oni la diseña el jefe) — el código no lo crea.

## Estructura

```text
src/
  App.tsx                 # página base OnixGuard (health: ok) — placeholder de Fase 0
  index.css               # Tailwind v4 + tokens §10 + imports de Geist
  lib/utils.ts            # helper cn()
  components/ui/button.tsx # componente shadcn de ejemplo
components.json           # config de shadcn
Dockerfile                # build con node → sirve estáticos con nginx:alpine
nginx.conf                # SPA fallback + endpoint /healthz
```

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build  (verificado: compila)
npm run lint
```

En el conjunto se levanta con `make dev` desde **onix-deploy** (sirve en http://localhost:3000).

## Docker

```bash
docker build -t onixguard-web .
docker run -p 3000:80 onixguard-web   # /healthz responde "ok"
```

## Pantallas (próximas fases)

1. **Monitoreo** (Fase 1/4/6): métricas, barra de 12 etapas, oficina pixel (canvas+spritesheet), actividad en vivo, tarjetas por agente.
2. **Reportes** (Fase 3): bandeja + reporte + chat (Aprobar / Pedir cambios / Responder).
3. **Logs** (Fase 5): buscador, filtros, tabla mono, detalle (credencial como hash), export JSONL/CSV.

---

*Parte de OnixGuard · Fase 0 (Cimientos). Plan completo en `docs/PLAN.md`.*
