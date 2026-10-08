# Plan — Tarea 4.3: Auditoría Core Web Vitals y Accesibilidad

> **Fase 4 · Calidad Enterprise** · documento de diseño (D1–D11).
> El alcance vinculante está en `spec.md`; la checklist de trabajo en `tasks.md`.

---

## 1. Objetivo

Tres preguntas que hoy el proyecto **no puede responder**:

| Pregunta | Estado hoy |
|:---|:---|
| ¿Cómo de rápido es el LCP de la ficha de producto? | **Nunca se ha medido.** |
| ¿Cuál es el INP? | **Nunca se ha medido.** |
| ¿La portada es accesible con teclado? | **Nadie lo ha ejecutado.** |

Lo que existe es una medición **manual** del CLS hecha en la Tarea 3.3
(0.000 · 0.011 · 0.039 en tres anchuras) y una verificación **estática parcial**
de accesibilidad. La Tarea 4.3 convierte ambas en algo **reproducible y bloqueante**.

**Resultado esperado:** un comando local y un gate en CI que miden CWV y
accesibilidad, con umbrales **medidos y congelados** — en la línea de lo que la
Tarea 4.1 hizo con la cobertura.

---

## 2. Estado real — auditoría previa del repositorio (2026-10-08)

Hecha sobre el código del `main` antes de escribir una sola línea de spec.

### 2.1 Core Web Vitals

| Hallazgo | Detalle |
|:---|:---|
| **Sin medición automática** | Ni `web-vitals`, ni Lighthouse, ni LHCI, ni Speed Insights. **0 dependencias** de medida. |
| **Historial de medida** | Una sola, **a mano**, en `specs/gallery-responsive/spec.md`: CLS 0.000 (390 px) · 0.011 (1440 px) · 0.039 (768 px). |
| **LCP · INP** | **Nunca medidos.** |
| **Sin despliegue** | No hay `vercel.json`, ni `Dockerfile` de frontend, ni despliegue documentado → **no existen datos de campo** (CrUX / Speed Insights). Sólo es posible medida de **laboratorio**. |

### 2.2 Accesibilidad — estática

El ESLint usa `eslint-config-next/core-web-vitals`, que trae
`eslint-plugin-jsx-a11y`, pero **sólo activa 6 de sus reglas**:

```
jsx-a11y/alt-text                      jsx-a11y/aria-props
jsx-a11y/aria-proptypes                jsx-a11y/aria-unsupported-elements
jsx-a11y/role-has-required-aria-props  jsx-a11y/role-supports-aria-props
```

Todas son de **validez de ARIA**. **Falta el bloque que protege al usuario real**:

| Regla ausente | Qué deja sin cubrir |
|:---|:---|
| `click-events-have-key-events` | elementos clicables **inaccesibles con teclado** |
| `interactive-supports-focus` | controles interactivos **sin foco** |
| `tabindex-no-positive` | orden de tabulación **roto** |
| `label-has-associated-control` | campos **sin etiqueta asociada** |
| `anchor-is-valid` | enlaces `href="#"` / `onClick` |
| `button-has-type` | botones que **envían formularios por accidente** |
| `no-autofocus` | foco automático que desorienta |
| `heading-has-content` | encabezados **vacíos** (rompen la navegación por encabezados) |

Con 6/30 reglas, el «0 errores de ESLint» **no es una garantía de accesibilidad** —
es una garantía de ARIA bien formado.

### 2.3 Accesibilidad — en navegador

Hay base real, **pero nadie la ha ejecutado nunca**:

| Señal | Recuento |
|:---|---:|
| `aria-*` | 33 |
| `role=` | 13 |
| `htmlFor` | 31 |
| `<label` | 33 |
| `aria-label` (en 9 ficheros) | 9 |
| `<img>` nativos (todos usan `next/image`) | **0** |

### 2.4 Superficie a auditar

**14 rutas** en el App Router:

```
/                        /catalog                 /search
/products/[reference]    /cart                    /orders
/orders/[orderNumber]    /receipt/[orderNumber]   /profile
/addresses               /login                   /register
/verify-email            /forgot-password
```

### 2.5 Infraestructura ya disponible

- **Chrome for Testing 1243** instalado por Playwright en
  `~/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/…`
  → **Lighthouse es viable sin descargar navegador nuevo** (vía `CHROME_PATH`).
- **Playwright + job `e2e-tests`** funcionando en CI con stack completo
  → **axe se integra sin runner nuevo**.

---

## 3. Decisiones de diseño

### D1 — El presupuesto se **mide y se congela**, no se impone

Hereda el principio de la **4.1 D4**. La secuencia es:

1. Instrumentar y medir el estado actual.
2. Fijar los umbrales **sobre lo medido**, con la holgura que justifique cada métrica.
3. Subirlos = decisión explícita. Bajarlos = decisión explícita.

**No se fija «Lighthouse ≥ 95» porque sí** — se fija lo que el repositorio hace
hoy, y se documenta por qué.

> **Consecuencia del orden:** el gate **no se activa en verde desde el commit 1**
> — se activa cuando la medición lo permite (ver **D6**).

### D2 — Backend real también en la auditoría

Hereda la **4.2 D1**. Lighthouse audita la página **con los datos de verdad**.

Un `/catalog` sin backend pinta su estado de error: mediríamos el LCP y el CLS de
un mensaje de fallo, y el gate aprobaría algo que nadie ha visto nunca. Igual
razón que en la 4.2 — *medir lo que el usuario recibe, no una maqueta de ello*.

### D3 — **axe dentro de `e2e-tests`; Lighthouse en job propio `cwv-audit`**

| Herramienta | Dónde | Por qué |
|:---|:---|:---|
| **axe** | job `e2e-tests` (spec nuevo) | reutiliza `globalSetup`, `webServer`, stack y navegadores **ya montados**. Coste marginal, cero infra nueva. |
| **Lighthouse** | job **`cwv-audit`**, nuevo, **sin `needs:`** | sus 1–2 min no se suman a los tests; fallar por ruido de medición no debe enrojar el resto. |

Ambos **en paralelo**, como el resto del pipeline.

### D4 — **Lighthouse CI (`@lhci/cli`)**, no el CLI suelto

| Alternativa | Por qué no |
|:---|:---|
| `npx lighthouse` + script propio que parsea el JSON | los umbrales viven **dentro de un script**: no son revisables en PR y hay que reimplementar mediana, salida y código de salida. |
| **`@lhci/cli` + `lighthouserc.json`** ✅ | los presupuestos son un **fichero declarativo versionado**; `numberOfRuns: 3` con **mediana** (Lighthouse es ruido puro en una sola pasada); salida nativa de CI. |

Una sola pasada puede aprobar o tumbar el gate por un pico de red. **Tres tomas y
mediana** es la diferencia entre una señal y un dado.

### D5 — axe sobre las **14 rutas**, pero **sólo en Chromium**

Las reglas de axe operan sobre el **DOM renderizado**, no sobre el motor de
renderizado. El DOM que inspectan es el mismo en los tres motores, así que:

- correrlo en Chromium **+ Firefox + WebKit** multiplicaría ×3 el coste
  con **cero señal nueva**;
- la variación *real* entre motores ya está cubierta por la 4.2 con los flujos de
  compra, sesión y bolsa.

**Se salta explícitamente en los otros dos proyectos** con un motivo documentado,
no por rendimiento.

### D6 — El gate **arranca en verde o no arranca**

Un gate que nace rojo no protege nada: enseña a ignorarlo. Por tanto:

> Si el diagnóstico inicial encuentra violaciones `critical`/`serious` o un CWV
> por debajo del presupuesto, **se corrigen antes de activar la aserción**.

La corrección es **acotada**: arreglar lo que haga falta para que el presupuesto
sea cierto, **no** refactorizar la UI. Si un hallazgo exige rediseño, se saca al
siguiente trabajo y el umbral se fija **por encima de lo actual** con la
justificación escrita en `spec.md`.

**Punto importante:** esto pone la corrección *dentro* del alcance — a diferencia
de las otras opciones que descartamos, que separaban medir y arreglar.

### D7 — Umbral de axe: **0 `critical` + 0 `serious`**

| Severidad | ¿Bloquea? | Motivo |
|:---|:---:|:---|
| `critical` · `serious` | **sí** | rompen el uso real con teclado, lector de pantalla o contraste |
| `moderate` · `minor` | no | se **reportan** en el informe; se congelan aparte para no perderlos |

Fijarlo en 0 para *todas* las severidades casi con seguridad arrancaría en rojo
(**D6**) y convertiría la primera semana en caza de matices.

### D8 — INP en laboratorio: **se congela sólo lo fiable**

Lighthouse expone la INP, pero **en laboratorio es un proxy** — sin interacciones
reales de usuario no hay interacción que medir. Se decide en `spec.md`, tras la
primera medición, cuáles de `largest-contentful-paint`, `cumulative-layout-shift`
y el indicador de bloqueo (**TBT** como proxy de INP) entran en el presupuesto y
cuáles sólo se **informan**. Lo que no se hace es **afirmar un INP de
laboratorio como si fuera el de campo**.

### D9 — Sin despliegue ⇒ **sólo laboratorio**, y se dice

No hay producción, así que **no hay CrUX**. Los umbrales son de laboratorio con
red y CPU artificialmente estranguladas: son **comparables entre sí y en el
tiempo**, no equivalentes a los datos de campo. Queda escrito para que nadie los
interprete como métricas de usuario real. Si en el futuro hay despliegue, la
medición de campo entra como trabajo aparte.

### D10 — **Sin ADR**

Lighthouse, LHCI y axe son **herramientas de auditoría**. No cambian el stack de
la aplicación ni su arquitectura: no tocan `pom.xml`, ni una migración, ni el
modelo de dominio. Mismo criterio que en la **4.1** y la **4.2**.

### D11 — Convención de estado y cierre (hereda la D11 de la 3.3)

El bloque «ESTADO ACTUAL» de `AGENTS.md` **se redacta dentro de esta PR**,
formulado para ser **verdad después del merge** y **sin números de PR ni SHA**.
Consecuencia: **no habrá PR de documentación de cierre**.

**Incluye además** el cabo suelto acordado al cerrar la 4.2:
`specs/e2e-playwright/tasks.md:96` quedó en `main` con
`- [ ] Preguntar al usuario antes de cualquier commit y PR ⛔ pendiente` —
criterio **sí cumplido** (los tres gates se pasaron con aprobación explícita) pero
sin marcar. **Se marca aquí, en una línea**, dentro de este PR.

---

## 4. Fuera de alcance

- ❌ **Datos de campo** (CrUX / Speed Insights / Vercel Speed Insights) — no hay
  despliegue (**D9**).
- ❌ **Refactor de UI** para perseguir puntuaciones de Lighthouse — sólo lo que
  exige el presupuesto congelado (**D6**).
- ❌ **Auditoría de seguridad, SEO o rendimiento de backend** — la tarea es CWV
  y accesibilidad.
- ❌ **Screenshots / regresión visual** — se cubre en una tarea futura si procede.
- ❌ **Pruebas de usuario con lector de pantalla reales** (VoiceOver/NVDA) — axe
  automatiza reglas comprobables; la validación humana queda fuera.
- ❌ **Tocar `backend/`** — en todo el ciclo.

---

## 5. Estimación

| Bloque | Contenido | Peso |
|:---|:---|:---:|
| **A** | Instrumentación: `@axe-core/playwright`, `@lhci/cli` + `lighthouse`, config | medio |
| **B** | Espec de axe sobre 14 rutas (auth, rutas parametrizadas, skip por proyecto) | alto |
| **C** | Job `cwv-audit` en CI + presupuesto declarativo | medio |
| **D** | Diagnóstico inicial → corrección acotada de hallazgos | **incierto** |
| **E** | Baselines + documentación (CHANGELOG, README, AGENTS, MEMORY) | bajo |

**El riesgo real está en D**: desconocido hasta medir. Es el único bloque que
puede crecer, y **D6** es la válvula que impide que se desborde — lo que no
quepa en el presupuesto se saca y se justifica, no se reimplementa la UI.

**Baselines que deben seguir verdes** (igual que en la 4.2):
`npx tsc --noEmit` → 0 · `npx eslint src scripts` → 0/0 · `npx vitest run` → 270 ·
`npm run test:coverage` → `77/76/74/79` · `npm run build` → 0 · E2E → 15/15 en CI ·
`git diff main -- backend/` → **vacío**.

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| El diagnóstico descubre muchos hallazgos y D6 se desborda | umbral de severidad (**D7**) + «lo que no cabe se saca y se justifica» (**D6**) |
| Lighthouse ruidoso → gate intermitente | `numberOfRuns: 3` + mediana (**D4**) |
| El job `cwv-audit` duplica la puesta en marcha del stack | aceptado: el paralelismo (**D3**) evita que se sume al tiempo total |
| INP de laboratorio se interpreta como dato real | decisión explícita en **D8** + aviso en **D9** |
| Rutas autenticadas/parametrizadas rompen axe | cubierto en el bloque B con la infra de sesión que ya deja `globalSetup` |
