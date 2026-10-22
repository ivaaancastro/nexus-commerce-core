# Plan — Precio final con impuestos incluidos en la vitrina

> **Post-Fase 7 · feedback del usuario (decisión 2026-10-20)** · documento de diseño (D1–D7) · **✅ aprobado 2026-10-22**.
> El alcance vinculante está en `spec.md`; la checklist de trabajo en `tasks.md` (tras la aprobación).

---

## 1. Objetivo

El usuario pidió que los impuestos **no se muestren «tal cual»** al cliente:
la vitrina debe **calcular internamente** y presentar el **precio final** como
hace Zara — precio con impuestos incluidos y una nota discreta, sin desglose
de base/IVA. Decisión del usuario: **vitrina simplificada + factura con
desglose** — el desglose se queda en `/receipt` (hace de factura) y en el
panel admin.

**Resultado esperado**: PDP, carrito, drawer y ficha del pedido del cliente
muestran **precio final + «Impuestos incluidos (X %)»** (texto uniforme — D2);
`/receipt` y el admin **conservan el desglose completo**. De paso se
corrige un **bug de aritmética medido**: hoy el carrito enseña
`TOTAL = subtotal + 21 %` sobre un subtotal que **ya incluye IVA** — enseña
**96,74 €** cuando el backend cobra **79,95 €** (doble imposición en pantalla).

---

## 2. Estado real — auditoría previa (sobre `main` = 71b1ae3)

### 2.1 El backend está correcto — no se toca

| Señal | Hallazgo |
|:---|:---|
| `PricingService` (L35-44) | `finalPrice = basePrice|discountPrice` (**los precios de `market_prices` ya son con impuesto incluido**); `netAmount = finalPrice / (1 + rate/100)` (`HALF_UP`, escala 4 en el factor) y `taxAmount = finalPrice − netAmount` |
| `OrderService.checkout` (L113-141) | `unitPrice = finalPrice` · `subtotal += itemTotal − itemTax` (**subtotal neto**) · `taxAmount` acumulado · `total` = suma de finales. Coherente y probado (345 tests) |
| `ReturnService` (L97-100) | **Documenta el contrato**: «en el checkout `unitPrice = finalPrice()` y `subtotal += unitPrice×qty − taxAmount`» |
| `GET /pricing/**` | **Público a propósito** (documentado en README, 6.4(i)) — la vitrina ya recibe `finalPrice`/`netAmount`/`taxAmount`/`taxRate` |

### 2.2 El frontend enseña mal (5 superficies) y el carrito dobla el IVA

| Superficie | Hoy | Problema |
|:---|:---|:---|
| **PDP** `products/[reference]` (L173-188) | Precio final grande + «Impuestos (21%): 13,88 EUR (Base: 66,07 EUR)» | Desglose a la vista (fuera del patrón Zara) |
| **`CartContext`** (L270-272) | `subtotal = Σ finalPrice×qty` (✓ ya es final) · **`taxEstimate = subtotal × taxRate/100`** | **BUG**: trata el subtotal final como si fuera neto — 79,95 → «impuestos» 16,79 (la parte real de IVA son 13,88) |
| **`/cart`** (L199-213 + nota L336) | Subtotal · Impuestos estimados · **Total = subtotal + taxEstimate** · «Impuestos calculados al 21 %… el cálculo final se realizará en el checkout» | **Doble imposición en pantalla**: 96,74 € en vez de 79,95 € |
| **`CartDrawer`** (L104-118) | Mismo trío Subtotal/Impuestos/Total | Mismo bug |
| **`/orders/[orderNumber]`** (L508-532) | Por línea `totalAmount` (✓ final) + Subtotal (neto) · Impuestos · Total del backend | Desglose a la vista (aunque los números son los correctos del backend) |
| `/receipt/[orderNumber]` | Desglose completo | **Correcto — se queda igual** (factura) |
| Admin (detalle de pedido, `AdminSkuPrices`) | Desglose y `taxRate` | **Correcto — se queda igual** |

### 2.3 Observaciones

- El umbral de envío gratuito (50) ya se compara contra `subtotal` (precio
  final) ⇒ **correcto**, decisión 3.2/R8b intacta.
- `taxEstimate` sólo lo consumen `/cart` y `CartDrawer` (grep verificado) —
  renombrarlo es viable sin romper más superficies.
- Tests preexistentes con aserciones que **cambian legítimamente** (R8.3 a
  declarar): `CartContext` (fórmula), `CartPage` (trío y nota), `CartDrawer`
  (trío), `OrderDetailPage` (líneas Subtotal/Impuestos). `ReceiptPage` y los
  de admin **no cambian**.

---

## 3. Decisiones de diseño

### D1 — El precio final es el único número grande; el impuesto es una nota

- **PDP**: precio final (o con descuento) como está hoy + nota **«Impuestos
  incluidos (21 %)»** debajo (texto **D2**, uniforme); **desaparece** la
  línea «Impuestos (…) (Base: …)».
- **`/cart` y `CartDrawer`**: `Subtotal` (ya es final) · **«Impuestos
  incluidos (21 %): 13,88 EUR»** como línea **informativa** (no se suma) ·
  **`Total` =
  `Subtotal`** (matemáticamente: el total del checkout es la suma de finales;
  el backend reparte después neto/impuesto para la factura). Se **elimina**
  la nota «el cálculo final se realizará en el checkout» — ya no hay sorpresa
  que explicar.
- **`/orders/[orderNumber]`**: se **eliminan** las líneas Subtotal/Impuestos
  del bloque resumen; queda **«TOTAL PAGADO: X»** + «Impuestos incluidos (21 %)» y
  los importes por línea (que ya son finales). El desglose vive en el
  `/receipt` enlazado desde el propio pedido.

### D2 — «Impuestos incluidos» uniforme (ajustado 2026-10-21)

- El sistema es multimercado: ES = IVA, UK = VAT, US = sales tax — decir
  «IVA» en Londres sería mentira. La primera redacción proponía el texto por
  mercado (`ES → «IVA incluido»`), pero **`TaxCopy.test.ts` (3.2/R8) prohíbe
  la cadena «IVA» en `src/`** como guardia deliberada del proyecto: **se
  unifica «Impuestos incluidos (X %)»** para todos los mercados — honesto
  en todos, guardia intacta y cero churn de tests (decisión del usuario).

### D3 — La parte de IVA incluida se **deriva**, no se inventa

- `taxIncluded = subtotal × rate / (100 + rate)` (79,95 × 21/121 = **13,88** ✓)
  — la misma verdad que `PricingService`, redondeada a 2 con `toFixed(2)` en
  presentación. Es **sólo presentación**: jamás viaja al backend ni entra en
  cálculos de cobro.
- En `CartContext` el campo **`taxEstimate` pasa a llamarse `taxIncluded`**
  con esta nueva semántica — el nombre viejo ya era un anzuelo («estimate»
  sobre precio final).

### D4 — Sin backend, sin migración, sin tocar `/receipt` ni el admin

- **`backend/` con diff = 0**: la aritmética es correcta (2.1) — aquí sólo
  manda la presentación. `PriceBreakdown`/`OrderResponse` no cambian de shape.

### D5 — R8.3 declaradas para las aserciones que cambian

- `CartContext.test` (fórmula `taxEstimate × rate` → `taxIncluded × rate/(100+rate)`),
  `CartPage.test` (trío + nota), `CartDrawer.test` (trío) y
  `OrderDetailPage.test` (Subtotal/Impuestos fuera). Ningún otro test tocado;
  los de receipt y admin quedan **intactos** como **comprobación positiva**
  de que el desglose sigue donde debe.
- **Ajuste medido al implementar (regla 3)**: `CartPage.test`,
  `CartDrawer.test` y `OrderDetailPage.test` **no tenían ninguna aserción
  sobre el trío** previsto; en su lugar se les **añadieron** pruebas. Las que
  **cambiaron** son tres: `CartContext.test`, `ProductDetailPage.test` (el
  regex `(21%)` pasa a `(21 %)`) y `TaxCopy.test` (el copy pasa a vivir en
  `src/lib/taxes.ts`; la guardia se reforzó).

### D6 — Sin ADR, sin E2E/a11y nuevos, sin PR de documentación de cierre

- Criterio 7.2–7.6 y `checkout-payment-grid`: nada de stack ni arquitectura
  nueva; la vitrina renderiza distinto los mismos datos. Estatus del trabajo
  en la feature PR (convención D11).

### D7 — Verificación con el mismo rigor programático de la A

- Script one-off de Playwright (no versionado) que **mide**: PDP sin línea de
  desglose y con la nota · carrito con `Total == Subtotal` y nota con la parte
  real de IVA (13,88, no 16,79) · drawer igual · pedido del cliente sin
  desglose y con enlace al recibo · `/receipt` **con** desglose (comprobación
  negativa) · y en **mercado UK** la nota dice «Impuestos incluidos». Capturas
  como evidencia.

---

## 4. Fuera de alcance

- ❌ **Backend, DTOs, `PricingService`, `OrderService`** — correctos y probados (2.1).
- ❌ **`/receipt/[orderNumber]` y panel admin** — conservan el desglose (decisión del usuario).
- ❌ **Cambiar precios de `market_prices`** o la semántica de descuento.
- ❌ **Multi-idioma / traducciones** de la nota — se escribe el texto español del copy, sin i18n (a la vitrina aún no le toca).
- ❌ **Fase 8** (Dockerfile) — vuelve después de la C.

---

## 5. Estimación y orden de implementación

| Bloque | Contenido | Peso |
|:---|:---|:---:|
| **A** | Helper de nota («Impuestos incluidos (X %)», uniforme — D2) + `CartContext`: `taxEstimate` → `taxIncluded` con la fórmula D3 | bajo |
| **B** | PDP, `/cart`, `CartDrawer`: nota en vez de desglose; `Total = Subtotal`; fuera la nota del checkout | bajo |
| **C** | `/orders/[orderNumber]`: resumen con Total pagado + nota; desglose fuera; enlace al recibo | bajo |
| **D** | Tests: R8.3 declaradas (4 ficheros) + cobertura de la fórmula nueva | medio |
| **E** | Gates + verificación programática D7 + CHANGELOG + estado en la PR | bajo |

**Baselines** (tras `checkout-payment-grid`): frontend **448** · coverage
85.84/81.78/83.33/87.91 (umbrales 77/76/74/79 + `api.ts` ≥ 99) · backend
**345** intocado · ESLint 0/0 · `tsc` 0 · build 0 · axe 14/14.

**Resultado medido (2026-10-22)**: frontend **461** (+13) · coverage
**85,91 / 81,94 / 83,45 / 87,98** · backend **345 intacto** · ESLint 0/0 ·
`tsc` 0 · build 0 · axe **14/14** · D7 **aprobada** sobre stack real.

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| **Regalar dinero**: un total que no cuadre con lo que cobra el backend | D3 + test que aserta `Total == Subtotal == Σ finalPrice` y comparación con el total del pedido creado en E2E existente |
| Confundir al usuario que buscaba el desglose | El `/receipt` lo conserva íntegro y el pedido del cliente **enlaza** al recibo (D1) |
| Romper tests de carrito/drawer/pedido | R8.3 declaradas (D5) + receipt/admin intactos como red |
| Que el copy diga «IVA» en UK/US (mentira fiscal) | D2: **un solo texto** «Impuestos incluidos (X %)» en todos los mercados + aserción en UK — además la guardia `TaxCopy.test.ts` bloquea la cadena en `src/` |
