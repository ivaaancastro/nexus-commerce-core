# Textos para LinkedIn (Fase 13)

> Para **copiar y pegar** en tu perfil. Nada de aquí se publica solo. Revisa cada texto antes de usarlo.

## 1. Proyecto (Perfil → Añadir sección del perfil → Principal → Añadir proyecto)

| Campo | Valor |
|:---|:---|
| **Nombre del proyecto** | Nexus Commerce Core — ecommerce full-stack con pagos Stripe |
| **Estoy trabajando actualmente en este proyecto** | Desmarcado (terminado) — o márcalo si seguirás tocándolo |
| **Fecha de inicio** | Septiembre de 2026 |
| **Fecha de finalización** | Noviembre de 2026 |
| **Enlace** | https://nexus-commerce-core.vercel.app |
| **Colaboradores** | Ninguno (proyecto en solitario) |
| **Asociado con** | Ninguna (proyecto personal) |
| **Multimedia** | La sección de proyectos **solo admite PDF, PowerPoint, Word, JPG, PNG y GIF (sin animación: toma el primer fotograma)**, no vídeo. Sube **`docs/media/nexus-tour.pdf`** (7 páginas: portada, catálogo, ficha, bolsa, pago, pedidos del panel y dashboard) y/o la portada `docs/media/nexus-demo-portada.png`. **No subas el GIF**: su primer fotograma es una página en blanco. Añade el enlace https://github.com/ivaaancastro/nexus-commerce-core#-pruébalo-en-1-minuto, donde sí se ve el GIF animado |

### Descripción (≈1 400 caracteres; el límite de LinkedIn son 2 000)

```
Ecommerce completo, del almacén al reembolso, desplegado en producción y con pagos reales de Stripe en modo prueba. Lo construí en solitario en dos meses (400+ commits) como proyecto de portfolio, trabajando con agentes de IA (opencode y Claude Code) bajo un flujo de Spec-Driven Development: ninguna funcionalidad se escribe sin una spec aprobada.

Qué incluye:
• Catálogo multimercado (4 mercados y divisas) con precios con impuestos incluidos, búsqueda híbrida (vectorial con pgvector + exacta) y fotos por color.
• Inventario con control de concurrencia: bloqueo pesimista y reservas atómicas, sin overselling.
• Checkout idempotente con snapshot financiero inmutable, cupones, reseñas, favoritos y emails de estado con outbox transaccional.
• Pagos con Stripe: el webhook firmado es la fuente de verdad, caducidad de pedidos impagados y reembolsos parciales y totales desde el panel.
• Panel de administración: productos, stock y precios, pedidos, usuarios, cupones, dashboard de métricas.
• Calidad: 553 tests de backend (con PostgreSQL real), 629 de frontend, E2E con Playwright, accesibilidad con axe y presupuesto de Core Web Vitals con Lighthouse en CI.
• Despliegue automático: GitHub Actions → Render (API) + Vercel (web) + Neon (PostgreSQL). Interfaz en español e inglés.

Cada decisión de diseño está documentada en 8 ADR y 38 specs dentro del repositorio.

Pruébalo sin registrarte: cliente demo@nexus.dev / Demo1234!, tarjeta de prueba 4242 4242 4242 4242 (la primera carga puede tardar ~50 s: el backend gratuito se despierta).
```

### Aptitudes (LinkedIn permite hasta 5 por proyecto; el resto, en «Aptitudes» del perfil)

**Las 5 del proyecto:** `Java` · `Spring Boot` · `Next.js` · `PostgreSQL` · `Stripe`

**Para añadir al perfil:** TypeScript · React · Tailwind CSS · Spring Security · JWT · Flyway · Docker · GitHub Actions · CI/CD · Playwright · Vitest · JUnit · Pruebas end-to-end · Accesibilidad web (WCAG) · Core Web Vitals · Diseño de APIs REST · Arquitectura de software · Spec-Driven Development · Ingeniería de software asistida por IA · Comercio electrónico

## 2. Post (español)

> Sube el vídeo `docs/media/nexus-demo.mp4` **como vídeo nativo** (rinde mucho más que un enlace). Pon el enlace en el primer comentario, no en el cuerpo, para no penalizar el alcance.

```
Hace dos meses empecé un ecommerce desde cero. Hoy está en producción. 🚀

Nexus Commerce Core: catálogo multimercado, inventario sin overselling, checkout idempotente, pagos con Stripe (webhook firmado, reembolsos desde el panel) y un panel de administración completo.

Lo que más me ha enseñado no es el stack, sino cómo lo construí:

🧭 Spec-Driven Development. Ninguna funcionalidad se escribe sin una spec que yo apruebe antes. 38 specs y 8 ADR documentan cada decisión.

🤖 Trabajé con dos agentes de IA, opencode y Claude Code, con reglas escritas (un AGENTS.md que cargan en cada sesión, una memoria persistente y comandos propios: /spec-check, /spec-close). Ellos investigan, implementan y verifican; yo decido, reviso y apruebo cada commit y cada PR.

✅ Las cifras se miden, no se prometen: 553 tests de backend con PostgreSQL real, 629 de frontend, E2E con Playwright, accesibilidad con axe y Lighthouse como puerta en CI.

Lo que más me sorprendió: con un buen proceso, los agentes no sustituyen el criterio, lo amplifican. Cuanto mejor es la spec, mejor el código.

👉 Pruébalo tú mismo, sin registrarte (enlace en el primer comentario). Cuenta demo, tarjeta de prueba 4242 4242 4242 4242 y listo. La primera carga puede tardar ~50 s: el backend gratuito se despierta.

Si trabajas con agentes de IA en proyectos reales, me encantaría saber cómo organizas tú el flujo. 👇

#Java #SpringBoot #NextJS #Stripe #PostgreSQL #IA #ClaudeCode #SoftwareEngineering #Ecommerce
```

**Primer comentario:**

```
🔗 Demo: https://nexus-commerce-core.vercel.app
💻 Código y README: https://github.com/ivaaancastro/nexus-commerce-core
🎬 Cuenta demo: demo@nexus.dev / Demo1234! · Tarjeta de prueba: 4242 4242 4242 4242
```

## 3. Antes de publicar

- [ ] Abre la demo y comprueba que carga (despierta el backend con 1 minuto de antelación).
- [ ] Comprueba que el release `v1.0.0` y el README se ven bien en GitHub.
- [ ] Proyecto: sube el PDF (`nexus-tour.pdf`) o la portada PNG, nunca el GIF ni el MP4. El **vídeo MP4 solo va en el post** (vídeo nativo); añade subtítulos si LinkedIn te los ofrece.
- [ ] El vídeo simula el último paso del pago (confirmación del PaymentIntent por API, porque Stripe bloquea con hCaptcha a los navegadores automatizados); el resto es la web real. Si prefieres, regraba ese tramo tú y no habrá dudas.
