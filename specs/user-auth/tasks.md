# Tasks: Tarea 5.1 — Registro y Login de Usuarios

> **Estado**: EN CURSO  
> **Fecha**: 2026-10-01  
> **Rama**: `feat/user-auth`

---

## Backend

- [x] Entidad `User.java` con todos los campos
- [x] Entidad `Address.java`
- [x] Enum `Gender.java`
- [x] Repositorio `UserRepository.java`
- [x] Repositorio `AddressRepository.java`
- [x] `JwtService.java` — Generación/validación de JWT
- [x] `JwtAuthenticationFilter.java` — Filtro de autenticación
- [x] `SecurityConfig.java` — Configuración de seguridad
- [x] `AuthService.java` — Lógica de autenticación
- [x] `EmailService.java` — Envío de emails
- [x] `AuthController.java` — Endpoints de auth
- [x] DTOs: `RegisterRequest`, `LoginRequest`, `AuthResponse`, `UserResponse`
- [x] Migración `V6__users_schema.sql`
- [x] Migración `V7__orders_user_id.sql`
- [x] Migración `V8__users_measurements_fix.sql`
- [x] Tests de `AuthService` (7 tests)

## Frontend

- [x] Tipos `auth.ts`
- [x] `AuthContext.tsx` — Estado global de autenticación
- [x] API client: register, login, verifyEmail, forgotPassword, resetPassword
- [x] Página `/login`
- [x] Página `/register`
- [x] Página `/verify-email`
- [x] Página `/forgot-password`
- [x] Header actualizado con estado de auth
- [x] Layout actualizado con `AuthProvider`

## Pendiente

- [ ] Verificar flujo completo: registro → email verificación → login
- [ ] Probar con Mailtrap que el email llega correctamente
- [ ] Crear PR de `feat/user-auth` → `feat/user-management`

---

## Fix — Puntos de Entrada de Verificación (rama `fix/verify-email-entry-points`)

> **Fecha**: 2026-10-01 · **Alcance aprobado por el usuario**: fix completo (F1-F7) + email de recuperación

### Backend

- [x] **F3** Propiedad `app.base-url` en `application.properties` (default `http://localhost:3000`)
- [x] **F1** `EmailService.sendVerificationEmail()` — añadir enlace a `/verify-email?email=`
- [x] **F2** `EmailService.sendPasswordResetEmail()` — añadir enlace a `/forgot-password?email=`
- [x] **Tests** `EmailServiceTest` (6 tests) — `EmailService` al **100% líneas y ramas**

### Frontend

- [x] **F4** `/login` — enlace visible *«¿Ya tienes un código? Verifica tu cuenta»*
- [x] **F5** `/login` — botón *«Verificar ahora»* cuando el error es *email no verificado*
- [x] **F6** `/verify-email` — `text-neutral-900` en los 2 inputs (regla #7)
- [x] **F7** `/verify-email` — `getFriendlyErrorMessage()` en lugar de `err.message` (regla #9)
- [x] **Tests** `VerifyEmailEntryPoints.test.tsx` (10 tests) — reproducen el bug
- [x] **F8** `htmlFor`/`id` en los 16 `label` de `/login`, `/register`, `/verify-email` y `/forgot-password`
- [x] **F9** `text-neutral-900` en los 3 inputs de `/forgot-password` (regla #7)
- [x] Limpieza: `useRouter` sin usar eliminado de `/register` (código muerto)

### Docs

- [x] `specs/user-auth/spec.md` §1.4 + criterios + tests (F1-F9)
- [x] `CHANGELOG.md` — entrada `fix(auth)`
- [x] `MEMORY.md` / `AGENTS.md` — estado tras el merge

---

## Resultado de pruebas

| Suite | Antes | Después |
|:---|:---|:---|
| Backend | 84 | **90** ✅ |
| Frontend | 44 | **54** ✅ |
| Cobertura `EmailService` | — | **100% / 100%** |
| Cobertura proyecto | 77,5% | **81,9%** |
| Lint (ficheros tocados) | 1 aviso | **0 errores · 0 avisos** |

---

## Notas de Implementación

- EmailService tiene modo desarrollo que loguea el código si no hay credenciales
- `.env` con credenciales de Mailtrap está en `.gitignore`
- Validación de email en frontend: simple y robusta (`includes("@")` + `includes(".")`)
- Errores traducidos a mensajes amigables con `getFriendlyErrorMessage()`

---

*Tasks actualizadas el 2026-10-01*
