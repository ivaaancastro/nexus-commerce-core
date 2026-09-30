# Plan de Implementación: Fase 5 — Gestión de Usuarios y Autenticación

> **Estado**: Planificación  
> **Fecha**: 2026-09-30  
> **Rama objetivo**: `feat/user-management`

---

## 1. Objetivos

Implementar un sistema completo de gestión de usuarios que permita:
- Registro con email + contraseña + datos personales
- Confirmación de email con código de 6 dígitos
- Login con email + contraseña + Google (social)
- Recuperación de contraseña por email con código
- Perfil con medidas (altura, peso) para recomendación de tallas
- Máximo 2 direcciones de entrega (una principal)
- Migración del carrito de localStorage a cuenta
- Historial de pedidos por usuario

---

## 2. Stack Tecnológico Propuesto

### Backend
| Tecnología | Uso |
|:---|:---|
| Spring Security | Autenticación y autorización |
| JWT (jjwt) | Tokens de sesión |
| BCrypt | Hash de contraseñas |
| Spring Data JPA | Persistencia de usuarios |
| Spring Mail | Emails de confirmación y recuperación |

### Frontend
| Tecnología | Uso |
|:---|:---|
| React Context | Estado de autenticación |
| API Client | Llamadas protegidas |
| React Hook Form | Gestión de formularios |

---

## 3. Modelo de Datos

### 3.1. Entidad User

```java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 100)
    private String firstName;

    @Column(nullable = false, length = 100)
    private String lastName;

    @Column(length = 20)
    private String phone; // Opcional

    @Column(nullable = false)
    private LocalDate birthDate; // Obligatorio

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Gender gender; // Obligatorio

    @Column(precision = 5, scale = 2)
    private Double height; // cm, para recomendación de tallas

    @Column(precision = 5, scale = 2)
    private Double weight; // kg, para recomendación de tallas

    @Column(nullable = false)
    private boolean emailVerified;

    @Column(length = 6)
    private String verificationCode;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Address> addresses = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<Order> orders = new ArrayList<>();

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;
}

public enum Gender {
    MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
}
```

### 3.2. Entidad Address

```java
@Entity
@Table(name = "addresses")
public class Address {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, length = 255)
    private String street;

    @Column(nullable = false, length = 100)
    private String city;

    @Column(nullable = false, length = 20)
    private String postalCode;

    @Column(nullable = false, length = 5)
    private String countryCode;

    @Column(nullable = false)
    private boolean defaultAddress;
}
```

### 3.3. Modificaciones a Order

```java
// Añadir a Order.java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "user_id")
private User user;
```

---

## 4. API Endpoints

### 4.1. Autenticación

| Método | Endpoint | Descripción |
|:---|:---|:---|
| `POST` | `/api/v1/auth/register` | Registro de usuario |
| `POST` | `/api/v1/auth/verify-email` | Verificar email con código |
| `POST` | `/api/v1/auth/resend-verification` | Reenviar código de verificación |
| `POST` | `/api/v1/auth/login` | Login con email + contraseña |
| `POST` | `/api/v1/auth/google` | Login con Google |
| `POST` | `/api/v1/auth/forgot-password` | Solicitar recuperación |
| `POST` | `/api/v1/auth/reset-password` | Resetear contraseña con código |
| `POST` | `/api/v1/auth/refresh` | Refresh token |
| `GET` | `/api/v1/auth/me` | Usuario actual |

### 4.2. Perfil

| Método | Endpoint | Descripción |
|:---|:---|:---|
| `GET` | `/api/v1/users/me` | Obtener perfil |
| `PUT` | `/api/v1/users/me` | Actualizar perfil (incluye altura, peso) |
| `DELETE` | `/api/v1/users/me` | Eliminar cuenta |

### 4.3. Direcciones

| Método | Endpoint | Descripción |
|:---|:---|:---|
| `GET` | `/api/v1/users/me/addresses` | Listar direcciones (máx 2) |
| `POST` | `/api/v1/users/me/addresses` | Añadir dirección |
| `PUT` | `/api/v1/users/me/addresses/{id}` | Actualizar dirección |
| `DELETE` | `/api/v1/users/me/addresses/{id}` | Eliminar dirección |

### 4.4. Pedidos

| Método | Endpoint | Descripción |
|:---|:---|:---|
| `GET` | `/api/v1/users/me/orders` | Historial de pedidos |
| `GET` | `/api/v1/users/me/orders/{orderNumber}` | Detalle de pedido |

---

## 5. Flujo de Autenticación

### 5.1. Registro

```
1. Usuario envía: { email, password, firstName, lastName, birthDate, gender, phone? }
2. Backend valida datos
3. Backend verifica que email no existe
4. Hash de contraseña con BCrypt
5. Generar código de verificación (6 dígitos)
6. Guardar usuario en BD (emailVerified = false)
7. Enviar email con código de verificación
8. Devolver: { message: "Email de verificación enviado" }
```

### 5.2. Verificación de Email

```
1. Usuario envía: { email, code }
2. Backend verifica código
3. Actualizar emailVerified = true
4. Generar JWT token
5. Devolver: { token, user }
```

### 5.3. Login

```
1. Usuario envía: { email, password }
2. Backend busca usuario por email
3. Verifica contraseña con BCrypt
4. Verifica emailVerified
5. Generar JWT token
6. Devolver: { token, user }
```

### 5.4. Login con Google

```
1. Usuario envía: { googleToken }
2. Backend verifica token con Google
3. Busca o crea usuario por email
4. Generar JWT token
5. Devolver: { token, user }
```

### 5.5. Recuperación de Contraseña

```
1. Usuario envía: { email }
2. Generar código de 6 dígitos
3. Guardar código en BD con expiración (15 min)
4. Enviar email con código
5. Usuario envía: { email, code, newPassword }
6. Verificar código y expiración
7. Actualizar contraseña
```

---

## 6. Seguridad

### 6.1. Contraseñas
- Hash con BCrypt (factor de costo 12)
- Mínimo 8 caracteres, mayúsculas, números
- Nunca almacenar contraseña en texto plano

### 6.2. JWT
- Access token: 24 horas
- Refresh token: 7 días
- Algoritmo: HS256
- Secret: Variable de entorno `JWT_SECRET`

### 6.3. Códigos de Verificación
- 6 dígitos numéricos
- Expiración: 15 minutos
- Un solo uso
- Máximo 3 intentos

### 6.4. Roles
- Solo `USER` por ahora
- `ADMIN` se añade después con panel de gestión

### 6.5. Protección de Endpoints
- `/api/v1/auth/**` — Público
- `/api/v1/users/**` — Autenticado
- `/api/v1/orders/**` — Autenticado
- `/api/v1/products/**` — Público (catálogo)
- `/api/v1/pricing/**` — Público
- `/api/v1/inventory/**` — Público

---

## 7. Frontend — Estado de Autenticación

### 7.1. AuthContext

```typescript
interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    verifyEmail: (email: string, code: string) => Promise<void>;
    loginWithGoogle: (googleToken: string) => Promise<void>;
    logout: () => void;
    updateProfile: (data: ProfileData) => Promise<void>;
    forgotPassword: (email: string) => Promise<void>;
    resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
}
```

### 7.2. Migración del Carrito

```typescript
// Al iniciar sesión, migrar carrito de localStorage a BD
async function migrateCart(userId: string, localCart: CartItem[]) {
    await api.migrateCart(userId, localCart);
    localStorage.removeItem('nexus-cart');
}
```

### 7.3. Recomendación de Tallas

```typescript
// Con altura y peso, recomendar talla
function recommendSize(height: number, weight: number, product: Product): string {
    // Lógica de recomendación basada en medidas
    // Similar a Zara
}
```

---

## 8. Estructura de Ramas

```
feat/user-management (rama padre)
├── feat/user-auth         → Tarea 5.1 (Registro + Login + Google)
├── feat/user-profile      → Tarea 5.2 (Perfil + Medidas + Direcciones)
└── feat/user-orders       → Tarea 5.3 (Historial de pedidos)
```

---

## 9. Archivos a Crear/Modificar

### Backend — Auth
| Archivo | Propósito |
|:---|:---|
| `entity/User.java` | Entidad de usuario |
| `entity/Address.java` | Entidad de dirección |
| `repository/UserRepository.java` | Repositorio de usuarios |
| `repository/AddressRepository.java` | Repositorio de direcciones |
| `service/AuthService.java` | Lógica de autenticación |
| `service/UserService.java` | Lógica de usuarios |
| `service/EmailService.java` | Envío de emails |
| `controller/AuthController.java` | Endpoints de auth |
| `controller/UserController.java` | Endpoints de usuarios |
| `security/JwtService.java` | Generación/validación de JWT |
| `security/JwtAuthenticationFilter.java` | Filtro de autenticación |
| `security/SecurityConfig.java` | Configuración de seguridad |
| `dto/RegisterRequest.java` | DTO de registro |
| `dto/LoginRequest.java` | DTO de login |
| `dto/AuthResponse.java` | DTO de respuesta auth |
| `dto/UserResponse.java` | DTO de usuario |
| `dto/AddressRequest.java` | DTO de dirección |

### Frontend — Auth
| Archivo | Propósito |
|:---|:---|
| `context/AuthContext.tsx` | Estado de autenticación |
| `components/LoginForm.tsx` | Formulario de login |
| `components/RegisterForm.tsx` | Formulario de registro |
| `components/VerifyEmailForm.tsx` | Formulario de verificación |
| `components/ForgotPasswordForm.tsx` | Formulario de recuperación |
| `components/ProtectedRoute.tsx` | Ruta protegida |
| `app/login/page.tsx` | Página de login |
| `app/register/page.tsx` | Página de registro |
| `app/verify-email/page.tsx` | Página de verificación |
| `app/forgot-password/page.tsx` | Página de recuperación |
| `app/profile/page.tsx` | Página de perfil |
| `app/addresses/page.tsx` | Página de direcciones |
| `app/orders/page.tsx` | Página de historial |

---

## 10. Orden de Implementación

### Tarea 5.1 — Registro y Login (`feat/user-auth`)

1. **Backend**: Entidades `User`, `Address` + repositorios
2. **Backend**: Seguridad (JWT, SecurityConfig, filtros)
3. **Backend**: `AuthService` + `AuthController`
4. **Backend**: Verificación de email con código
5. **Backend**: Login con Google
6. **Backend**: Recuperación de contraseña
7. **Frontend**: `AuthContext` + páginas de login/register/verify
8. **Tests**: Tests de auth

### Tarea 5.2 — Perfil y Direcciones (`feat/user-profile`)

1. **Backend`: `UserService` + `UserController`
2. **Backend**: CRUD de direcciones (máx 2)
3. **Frontend**: Página de perfil con medidas
4. **Frontend**: Página de direcciones
5. **Tests**: Tests de perfil y direcciones

### Tarea 5.3 — Historial de Pedidos (`feat/user-orders`)

1. **Backend**: Relación `Order` ↔ `User`
2. **Backend**: Endpoints de historial
3. **Frontend**: Página de historial de pedidos
4. **Tests**: Tests de historial

---

## 11. Criterios de Aceptación

- [ ] Registro con email + contraseña + datos personales funciona
- [ ] Verificación de email con código de 6 dígitos
- [ ] Login con email + contraseña funciona
- [ ] Login con Google funciona
- [ ] Recuperación de contraseña por email funciona
- [ ] Perfil con altura, peso, fecha de nacimiento, género
- [ ] Recomendación de tallas basada en medidas
- [ ] Máximo 2 direcciones, una principal
- [ ] Migración del carrito de localStorage a BD
- [ ] Carrito compartido entre dispositivos
- [ ] Historial de pedidos por usuario
- [ ] Tests pasando (backend + frontend)

---

## 12. Estimación

| Tarea | Estimación |
|:---|:---|
| **5.1** — Auth | 5-6 horas |
| **5.2** — Perfil + Direcciones | 3-4 horas |
| **5.3** — Historial | 2-3 horas |
| **Total** | 10-13 horas |

---

*Documento actualizado con respuestas del usuario. Pendiente de aprobación para pasar a modo ejecución.*
