# Plan: Tarea 5.1 — Registro y Login de Usuarios

> **Estado**: EN CURSO  
> **Fecha**: 2026-10-01  
> **Rama**: `feat/user-auth`

---

## 1. Objetivos

Implementar un sistema completo de autenticación que permita:
- Registro con email + contraseña + datos personales
- Verificación de email con código de 6 dígitos
- Login con email + contraseña
- Recuperación de contraseña por email con código
- Reenvío de código de verificación

---

## 2. No-Objetivos

- Login social (Google, Apple) — futura iteración
- Roles de administración — futura iteración
- Verificación de teléfono — no necesario

---

## 3. Decisiones de Diseño

### 3.1. Stack
- **Backend**: Spring Security + JWT (jjwt 0.12.6) + BCrypt
- **Frontend**: React Context + Protected Routes
- **Email**: Mailtrap (desarrollo) / SendGrid (producción)

### 3.2. Modelo de Datos
- `User`: email, passwordHash, firstName, lastName, phone, birthDate, gender, height, weight, emailVerified, verificationCode
- `Address`: user_id, fullName, street, city, postalCode, countryCode, defaultAddress
- `Order`: añadir user_id (relación con User)

### 3.3. Seguridad
- JWT access token: 24 horas
- JWT refresh token: 7 días
- Códigos de verificación: 6 dígitos, expiración 15 minutos
- Contraseñas: BCrypt con factor de costo 12

---

## 4. API Endpoints

| Método | Endpoint | Descripción |
|:---|:---|:---|
| `POST` | `/api/v1/auth/register` | Registro de usuario |
| `POST` | `/api/v1/auth/verify-email` | Verificar email con código |
| `POST` | `/api/v1/auth/resend-verification` | Reenviar código |
| `POST` | `/api/v1/auth/login` | Login |
| `POST` | `/api/v1/auth/forgot-password` | Solicitar recuperación |
| `POST` | `/api/v1/auth/reset-password` | Resetear contraseña |
| `POST` | `/api/v1/auth/refresh` | Refresh token |
| `GET` | `/api/v1/auth/me` | Usuario actual |

---

## 5. Orden de Implementación

### Backend
1. Entidades `User`, `Address`, `Gender` + repositorios
2. Seguridad: `JwtService`, `JwtAuthenticationFilter`, `SecurityConfig`
3. `AuthService` + `AuthController`
4. `EmailService` para envío de emails
5. Migraciones: V6 (users), V7 (orders.user_id), V8 (measurements fix)

### Frontend
1. `AuthContext` + tipos
2. API client: register, login, verifyEmail, forgotPassword, resetPassword
3. Páginas: login, register, verify-email, forgot-password
4. Header: estado de autenticación

### Tests
1. Tests de `AuthService` (7 tests)
2. Tests de integración de auth

---

## 6. Criterios de Aceptación

- [x] Registro con email + contraseña + datos personales funciona
- [x] Verificación de email con código de 6 dígitos
- [x] Login con email + contraseña funciona
- [x] Recuperación de contraseña por email funciona
- [x] Reenvío de código de verificación
- [x] Perfil con altura, peso, fecha de nacimiento, género
- [x] Tests pasando (38 backend + 27 frontend)

---

## 7. Estimación

- **Backend**: 5-6 horas
- **Frontend**: 3-4 horas
- **Tests**: 2 horas
- **Total**: 10-12 horas

---

*Plan creado en modo plan. Pendiente de aprobación para pasar a modo ejecución.*
