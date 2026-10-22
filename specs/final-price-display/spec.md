# Spec — Precio final con impuestos incluidos en la vitrina

> **Feature `final-price-display`** · presentación estilo Zara del precio con
> impuestos incluidos + corrección de la doble imposición en pantalla del
> carrito · **✅ aprobada 2026-10-22** (bloqueo de SDD superado).
> Basado en `plan.md` (D1–D7). **Backend intocado.**

---

## 1. Contexto

Decisión del usuario (2026-10-20): los impuestos **no se muestran «tal
cual»** — la vitrina calcula internamente y presenta el **precio final**, con
una nota discreta, como hace Zara. El desglose base+IVA queda **sólo** en
`/receipt` (factura) y en el panel admin. La auditoría (plan 2.2) midió que
hoy el carrito **suma el IVA encima de un subtotal que ya lo incluye**
(enseña 96,74 € cuando el backend cobra 79,95 €): la feature lo corrige.

## 2. Requisitos funcionales

- **R1 · PDP**: el precio final grande se queda; debajo **«Impuestos
  incluidos (21 %)»** (mercado ES; texto **R4** uniforme) — **desaparece** la
  línea «Impuestos (…) (Base: …)».
- **R2 · Carrito y drawer**: `Subtotal` (precio final) · línea **informativa**
  «Impuestos incluidos (21 %): 13,88 EUR» (**no se suma**) · **`Total = Subtotal`**.
  Se elimina la nota «el cálculo final se realizará en el checkout».
- **R3 · Pedido del cliente** (`/orders/[orderNumber]`): sin líneas
  Subtotal/Impuestos en el resumen — **«TOTAL PAGADO: X»** + la nota y los
  importes por línea; **enlace al `/receipt`** (que conserva el desglose).
- **R4 · Texto neutro y honesto**: **«Impuestos incluidos (X %)» en todos
  los mercados**, siempre con el porcentaje. ⚠️ **Cambio de alcance
  (regla 3, decisión del usuario 2026-10-21)**: la primera redacción decía
  «IVA incluido» en ES, pero el proyecto **prohíbe la cadena «IVA» en el
  copy** desde la 3.2/R8 (guardada por `TaxCopy.test.ts`: en UK es VAT, en
  US no hay IVA sino *sales tax*) — la nota neutra + porcentaje cumple el
  espíritu sin tocar esa protección.
- **R5 · Factura y admin intactos**: `/receipt/[orderNumber]` y el panel
  admin (detalle de pedido, precios con `taxRate`) **no cambian** —
  comprobación negativa explícita en la verificación (D7).
- **R6 · Cuadre con el cobro**: el `Total` mostrado en carrito/drawer es
  **exactamente** lo que el backend cobra (`Σ finalPrice×qty`); la parte de
  IVA mostrada es la real (`subtotal × rate/(100+rate)`, p. ej. 13,88 — no
  16,79).

## 3. Requisitos técnicos

- **RT1** — `CartContext`: `taxEstimate` → **`taxIncluded`** con la fórmula
  D3 (`subtotal × rate/(100+rate)`); consumidores `/cart` y `CartDrawer`
  actualizados; `total = subtotal` en ambos.
- **RT2** — Helper de nota (texto ES) en un sitio único (lib/), usado por
  PDP, carrito, drawer y pedido del cliente.
- **RT3** — **Cero diff en `backend/`**, en `/receipt` y en el panel admin;
  `PriceBreakdown`/`OrderResponse` sin cambios de shape.
- **RT4** — **R8.3 declaradas, medida al implementar** (la redacción original
  suponía más cambio del que había): las aserciones que **cambiaron** son
  sólo tres —
  `CartContext.test` (fórmula D3), `ProductDetailPage.test` (el regex
  `/impuestos \(21%\)/` pasa a `/impuestos incluidos \(21 %\)/`, porque la
  copia aprobada separa el número del símbolo) y `TaxCopy.test` (el copy ya
  no se escribe en cada página sino en un único módulo `src/lib/taxes.ts`;
  la guardia se **refuerza**: además del texto comprueba que las cuatro
  superficies lo importan).
  `CartPage.test`, `CartDrawer.test` y `OrderDetailPage.test` **no tenían
  ninguna aserción sobre el trío** (diferencia con lo previsto en D5): en su
  lugar se les **añadieron** pruebas nuevas — ninguna existente se tocó.

## 4. Alcance y no-alcance

| En alcance | Fuera de alcance |
|:---|:---|
| PDP · `/cart` · `CartDrawer` · `/orders/[orderNumber]` | Backend, DTOs, `PricingService`, `OrderService` |
| `CartContext` (`taxIncluded`) y su helper de nota | `/receipt` y panel admin (conservan desglose) |
| R8.3 declaradas en los 4 ficheros | Multi-idioma, cambios de precios/descuentos |

## 5. Criterios de aceptación / gates

1. `cd frontend && npm run test:coverage` → **EXIT 0**, sin bajar de los
   umbrales congelados (77/76/74/79 + `api.ts` ≥ 99); backend **345 intocado**.
2. `tsc --noEmit` 0 · ESLint 0/0 · `npm run build` 0 (con `rm -rf .next` y
   `next start` detenido por puerto antes de reconstruir).
3. Verificación **programática** (script Playwright one-off, no versionado):
   - PDP: sin línea de desglose, con nota de mercado ES.
   - Carrito/drawer: `Total == Subtotal` y nota con **13,88** (parte real).
   - Pedido del cliente: sin desglose, con enlace al recibo.
   - `/receipt`: **con** desglose (comprobación negativa).
   - Mercado **UK**: la nota dice «Impuestos incluidos (…)».
   Capturas como evidencia.
4. `/spec-check final-price-display` → aprobado.

### 5.1 Resultado de los gates (medido 2026-10-22)

| Gate | Resultado |
|:---|:---|
| Unitarios frontend | **461 / 461** (448 base + 13 nuevos) · cobertura **85,91 / 81,94 / 83,45 / 87,98** — sin bajar de 77/76/74/79 · `api.ts` ≥ 99 intacto |
| Backend | **345** · `git diff -- backend/` **vacío** |
| `tsc --noEmit` / ESLint / build | **0 / 0 / 0** (build de producción usado por la verificación) |
| axe | **14/14** sin hallazgos bloqueantes (sólo Chromium) |
| Verificación programática D7 | **aprobada** sobre el stack real (Next → rewrite → Spring → PostgreSQL): PDP sin desglose y con la nota · carrito y drawer con `Total == Subtotal` y la parte incluida **real** (derivada, no el 21 % sumado) · pedido sin desglose y con el enlace al recibo · **`/receipt` con desglose (comprobación negativa)** · **UK** con «Impuestos incluidos (20 %)». Capturas en el informe de la ejecución |

## 6. Datos y API

- **Sin cambios**: los precios de `market_prices` ya son finales con impuesto
  (contrato documentado en `ReturnService`); `GET /pricing/**` devuelve
  `finalPrice/netAmount/taxAmount/taxRate` y la vitrina sólo cambia **cuál
  pinta grande** y qué nota añade.

## 7. Documentación

- `CHANGELOG.md` (Fixed: doble imposición en pantalla · Changed: precio
  final estilo Zara) y bloque «ESTADO ACTUAL» de `AGENTS.md`/`MEMORY.md`
  **dentro de la feature PR** (convención D11).
- Sin ADR · sin PR de documentación de cierre.
