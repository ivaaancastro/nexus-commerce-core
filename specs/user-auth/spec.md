# Spec: Tarea 5.1 — Registro y Login de Usuarios

> **Estado**: EN CURSO  
> **Fecha**: 2026-10-01

---

## 1. Especificación Técnica

### 1.1. Entidades

#### User
```java
@Entity
@Table(name = "users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 255)
    private String email;
    
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    
    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;
    
    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;
    
    @Column(length = 20)
    private String phone; // Opcional
    
    @Column(name = "birth_date", nullable = false)
    private LocalDate birthDate; // Obligatorio
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Gender gender; // Obligatorio
    
    @Column private Double height; // cm
    @Column private Double weight; // kg
    
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;
    
    @Column(name = "verification_code", length = 6)
    private String verificationCode;
    
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Address> addresses;
    
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<Order> orders;
}
```

#### Address
```java
@Entity
@Table(name = "addresses")
public class Address {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;
    
    @Column(nullable = false, length = 255)
    private String street;
    
    @Column(nullable = false, length = 100)
    private String city;
    
    @Column(name = "postal_code", nullable = false, length = 20)
    private String postalCode;
    
    @Column(name = "country_code", nullable = false, length = 5)
    private String countryCode;
    
    @Column(name = "default_address", nullable = false)
    private boolean defaultAddress;
}
```

### 1.2. API Endpoints

#### POST /api/v1/auth/register
**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "Juan",
  "lastName": "García",
  "phone": "612345678",
  "birthDate": "1990-01-01",
  "gender": "MALE",
  "height": 175.0,
  "weight": 70.0
}
```
**Response:** 200 OK

#### POST /api/v1/auth/verify-email
**Request:** `?email=user@example.com&code=123456`
**Response:** 200 OK

#### POST /api/v1/auth/login
**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "Juan",
    "lastName": "García",
    ...
  }
}
```

### 1.3. Flujo de Autenticación

```
Registro → Email verificación (código 6 dígitos) → Login → JWT Token
```

### 1.4. Puntos de Entrada del Código de Verificación — Fix 2026-10-01

**Problema detectado**: la pantalla `/verify-email` existía con su campo de código,
pero **no tenía puntos de entrada alcanzables**. El email llegaba sin enlace y
`/login` solo ofrecía acceso tras un reenvío exitoso, dejando al usuario atrapado
en un bucle `login → "revisa tu bandeja" → email sin enlace → login sin botón`.

#### Requisitos del fix

| # | Requisito | Fichero | Regla AGENTS.md |
|:--|:---|:---|:---|
| F1 | El email de verificación incluye enlace absoluto a `/verify-email?email=<email>` | `EmailService` | — |
| F2 | El email de recuperación incluye enlace absoluto a `/forgot-password?email=<email>` | `EmailService` | — |
| F3 | URL base configurable vía `app.base-url`, default `http://localhost:3000` | `application.properties` | — |
| F4 | `/login` muestra enlace visible *«¿Ya tienes un código? Verifica tu cuenta»* | `login/page.tsx` | — |
| F5 | Si el error de login es *email no verificado*, mostrar botón *«Verificar ahora»* con el email precargado | `login/page.tsx` | — |
| F6 | `/verify-email`: ambos inputs con `text-neutral-900` | `verify-email/page.tsx` | **#7** |
| F7 | `/verify-email`: errores traducidos con `getFriendlyErrorMessage()` | `verify-email/page.tsx` | **#9** |
| F8 | Los 16 `label` de las pantallas de auth se asocian a su control vía `htmlFor`/`id` (`/login`, `/register`, `/verify-email`, `/forgot-password`) | 4 páginas | accesibilidad |
| F9 | `/forgot-password`: los 3 inputs con `text-neutral-900` (incumplían la regla #7) | `forgot-password/page.tsx` | **#7** |

#### Flujo corregido

```
Registro ─▶ email CON enlace ─▶ /verify-email ─▶ Login ✅
Login (no verificado) ─▶ botón «Verificar ahora» ─▶ /verify-email ─▶ Login ✅
Login (con código a mano) ─▶ enlace directo ─▶ /verify-email ✅
```

---

## 2. Criterios de Aceptación

- [x] Registro con email + contraseña + datos personales funciona
- [x] Verificación de email con código de 6 dígitos
- [x] Login con email + contraseña funciona
- [x] Recuperación de contraseña por email funciona
- [x] Reenvío de código de verificación
- [x] Tests pasando (38 backend + 27 frontend)

### Fix — puntos de entrada de verificación (2026-10-01)

- [x] **F1** El email de verificación contiene enlace a `/verify-email?email=`
- [x] **F2** El email de recuperación contiene enlace a `/forgot-password?email=`
- [x] **F3** `app.base-url` configurable con default `http://localhost:3000`
- [x] **F4** `/login` enlaza directamente a `/verify-email` sin necesidad de reenviar
- [x] **F5** Error *email no verificado* ofrece botón *«Verificar ahora»*
- [x] **F6** Ambos inputs de `/verify-email` con `text-neutral-900` (regla #7)
- [x] **F7** `/verify-email` usa `getFriendlyErrorMessage()` (regla #9)
- [x] **F8** Los 16 `label` de las 4 pantallas de auth asociados con `htmlFor`/`id`
- [x] **F9** Los 3 inputs de `/forgot-password` con `text-neutral-900` (regla #7)
- [x] Tests que **reproduzcan el bug** (regla: todo bug corregido, test)

---

## 3. Tests

### Backend (AuthServiceTest)
- [x] Registro de usuario y envío de email
- [x] Excepción si email ya registrado
- [x] Verificación de email con código correcto
- [x] Excepción si código inválido
- [x] Login con credenciales correctas
- [x] Excepción si credenciales incorrectas
- [x] Excepción si email no verificado
- [x] Recuperación de contraseña
- [x] Reset de contraseña con código correcto

### Frontend
- [x] 27 tests pasando

### Backend (EmailServiceTest) — Fix puntos de entrada
- [x] Email de verificación contiene enlace a `/verify-email?email=`
- [x] Email de recuperación contiene enlace a `/forgot-password?email=`
- [x] La URL base respeta la propiedad `app.base-url`
- [x] Modo desarrollo loguea el enlace sin enviar correo
- [x] Un fallo de envío no propaga la excepción
- [x] Cobertura de `EmailService`: **100% líneas, 100% ramas**

### Frontend — Fix puntos de entrada
- [x] `/login` muestra enlace directo a `/verify-email`
- [x] `/login` muestra botón *«Verificar ahora»* ante error de email no verificado
- [x] `/login` **no** muestra ese botón ante otros errores
- [x] `/verify-email` envuelve los errores con `getFriendlyErrorMessage()`
- [x] `/verify-email` precarga el email recibido por URL
- [x] Ambos inputs con `text-neutral-900`
- [x] **F8** `getByLabelText()` resuelve en `/login`, `/register`, `/verify-email` y `/forgot-password`
- [x] `/register`: código muerto eliminado (`useRouter` sin usar) — lint a 0 avisos

---

*Spec creado en modo plan.*
