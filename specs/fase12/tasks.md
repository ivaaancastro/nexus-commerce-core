# Fase 12 — tasks (i18n ES/EN)

> Spec pendiente de aprobación del usuario. Se marca cada tarea al completarla (regla 4 de AGENTS.md).

## A. Infraestructura i18n

- [x] A.1 Crear `frontend/src/lib/i18n.ts`: `createI18n()` / `t(key)` con fallback a la clave
- [x] A.2 Crear `frontend/src/lib/locales/es.ts`: diccionario español (claves del §4)
- [x] A.3 Crear `frontend/src/lib/locales/en.ts`: diccionario inglés (claves del §4)
- [x] A.4 Crear `frontend/src/hooks/useLocale.ts`: `useLocale()` con `localStorage` (`nexus-locale`), default `es`, sin `throw` (renombrado a `.tsx` por JSX)

## B. Integración en copy existente

- [x] B.1 `src/lib/taxes.ts`: `taxesIncludedLabel` traduce ES/EN
- [x] B.2 `src/lib/errors.ts`: `getFriendlyErrorMessage` traduce ES/EN (locale opcional, default `es`, llamantes sin cambios — R8.3)
- [x] B.3 `Header.tsx`: selector de idioma (es/en) junto al selector de mercado y textos de navegación vía `t()`

## C. Tests

- [x] C.1 Test de diccionarios: claves presentes y valores no vacíos en es/en (`I18n.test.ts`)
- [x] C.2 Test de `useLocale`: default `es`, persistencia, cambio de idioma (`Locale.test.tsx`)
- [x] C.3 Test de `taxes.ts` en EN (`Taxes included (X %)`)
- [x] C.4 Test de `errors.ts` en EN (`Errors.test.ts`, bloque EN al final, aserciones ES intactas)
- [x] C.5 Tests existentes en español siguen verdes (no se tocan aserciones — R8.3) — `Header.test.tsx` con `LocaleProvider`

## D. Verificación global

- [x] D.1 `npx tsc --noEmit` → 0 en `frontend/`
- [x] D.2 `npx eslint src scripts e2e playwright.config.ts` → 0 errores, 0 warnings
- [x] D.3 `npm run build` → 0 en `frontend/`
- [x] D.4 `npm run test:coverage` → cobertura 84,03/78,51/81,72/86,12 ≥ 77/76/74/79, exit 0 (629 tests)
- [x] D.5 Idioma y mercado independientes: diccionarios separados del contexto de mercado

## E. Documentación y estado

- [x] E.1 `CHANGELOG.md`: entrada en `[Unreleased]` con la Fase 12 (Keep a Changelog es-ES)
- [x] E.2 Bloque «ESTADO ACTUAL» de `AGENTS.md`: Fase 12 completada (verdad tras el merge, sin números de PR ni SHA)
- [x] E.3 `MEMORY.md`: Fase 12 marcada como completada

## F. Cierre

- [ ] F.1 Tests en verde (frontend) — hechas en D.4 (629 pasados)
- [ ] F.2 Cobertura mantenida — hechas en D.4 (EXIT 0)
- [ ] F.3 Código sin TODOs ni comentarios de depuración
- [ ] F.4 Commits con formato convencional — pendiente (commit + PR)
- [ ] F.5 PR hacia `main` (no push directo a `main`) — pendiente
- [ ] F.6 `/spec-check fase12` aprobado — pendiente (tras el commit/PR)
