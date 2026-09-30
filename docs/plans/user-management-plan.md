# Plan de Implementación: Fase 5 — Gestión de Usuarios y Autenticación

> **Estado**: Planificación  
> **Fecha**: 2026-09-30  
> **Rama objetivo**: `feat/user-management`

---

## 1. Objetivos

Implementar un sistema completo de gestión de usuarios que permita:
- Registro y autenticación con email + contraseña
- Sesiones persistentes con JWT
- Perfil de usuario con datos personales
- Múltiples direcciones de entrega
- Historial de pedidos por usuario
- Migración del carrito de localStorage a base de datos

---

## 2. Stack Tecnológico Propuesto

### Backend
| Tecnología | Uso |
|:---|:---|
| Spring Security | Autenticación y autorización |
| JWT (jjwt) | Tokens de sesión |
| BCrypt | Hash de contraseñas |
| Spring Data JPA | Persistencia de usuarios |

### Frontend
| Tecnología | Uso |
|:---|:---|
| React Context | Estado de autenticación |
| API Client | Llamadas protegidas |
| Form Hook | Gestión de formularios |

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
    private String phone;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Address> addresses = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<Order> orders = new ArrayList<>();

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;
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
| `POST` | `/api/v1/auth/login` | Login (devuelve JWT) |
| `POST` | `/api/v1/auth/refresh` | Refresh token |
| `GET` | `/api/v1/auth/me` | Usuario actual |

### 4.2. Perfil

| Método | Endpoint | Descripción |
|:---|:---|:---|
| `GET` | `/api/v1/users/me` | Obtener perfil |
| `PUT` | `/api/v1/users/me` | Actualizar perfil |
| `DELETE` | `/api/v1/users/me` | Eliminar cuenta |

### 4.3. Direcciones

| Método | Endpoint | Descripción |
|:---|:---|:---|
| `GET` | `/api/v1/users/me/addresses` | Listar direcciones |
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
1. Usuario envía: { email, password, firstName, lastName }
2. Backend valida datos
3. Backend verifica que email no existe
4. Hash de contraseña con BCrypt
5. Guardar usuario en BD
6. Generar JWT token
7. Devolver: { token, user }
```

### 5.2. Login

```
1. Usuario envía: { email, password }
2. Backend busca usuario por email
3. Verifica contraseña con BCrypt
4. Generar JWT token
5. Devolver: { token, user }
```

### 6.3. Requests Autenticados

```
Client → API: Authorization: Bearer <token>
Backend: Filtro JWT valida token
Backend: Carga usuario del token
Controller: Usa usuario autenticado
```

---

## 6. Seguridad

### 6.1. Contraseñas
- Hash con BCrypt (factor de costo 12)
- Nunca almacenar contraseña en texto plano
- Validación de fortaleza (mínimo 8 caracteres, mayúsculas, números)

### 6.2. JWT
- Expiración: 24 horas (access token)
- Refresh token: 7 días
- Algoritmo: HS256
- Secret: Variable de entorno `JWT_SECRET`

### 6.3. Protección de Endpoints
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
    logout: () => void;
    updateProfile: (data: ProfileData) => Promise<void>;
}
```

### 7.2. Protección de Rutas

```typescript
// Componente de ruta protegida
function ProtectedRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    
    if (isLoading) return <Loading />;
    if (!isAuthenticated) return <Navigate to="/login" />;
    
    return children;
}
```

### 7.3. Migración del Carrito

```typescript
// Al iniciar sesión, migrar carrito de localStorage a BD
async function migrateCart(userId: string, localCart: CartItem[]) {
    await api.migrateCart(userId, localCart);
    localStorage.removeItem('nexus-cart');
}
```

---

## 8. Archivos a Crear/Modificar

### Backend
| Archivo | Propósito |
|:---|:---|
| `entity/User.java` | Entidad de usuario |
| `entity/Address.java` | Entidad de dirección |
| `repository/UserRepository.java` | Repositorio de usuarios |
| `repository/AddressRepository.java` | Repositorio de direcciones |
| `service/AuthService.java` | Lógica de autenticación |
| `service/UserService.java` | Lógica de usuarios |
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

### Frontend
| Archivo | Propósito |
|:---|:---|
| `context/AuthContext.tsx` | Estado de autenticación |
| `components/LoginForm.tsx` | Formulario de login |
| `components/RegisterForm.tsx` | Formulario de registro |
| `components/ProtectedRoute.tsx` | Ruta protegida |
| `app/login/page.tsx` | Página de login |
| `app/register/page.tsx` | Página de registro |
| `app/profile/page.tsx` | Página de perfil |
| `app/addresses/page.tsx` | Página de direcciones |
| `app/orders/page.tsx` | Página de historial |

---

## 9. Orden de Implementación

### Paso 1: Backend — Entidades y Repositorios
1. Crear `User.java` y `Address.java`
2. Crear `UserRepository.java` y `AddressRepository.java`
3. Añadir relación `user_id` a `Order.java`
4. Migración Flyway `V6__users_schema.sql`

### Paso 2: Backend — Seguridad
1. Añadir dependencias: `spring-security`, `jjwt`
2. Crear `JwtService.java`
3. Crear `JwtAuthenticationFilter.java`
4. Crear `SecurityConfig.java`

### Paso 3: Backend — Auth API
1. Crear `AuthService.java`
2. Crear `AuthController.java`
3. Crear DTOs: `RegisterRequest`, `LoginRequest`, `AuthResponse`

### Paso 4: Backend — Users API
1. Crear `UserService.java`
2. Crear `UserController.java`
3. Crear DTOs: `UserResponse`, `AddressRequest`

### Paso 5: Frontend — Auth Context
1. Crear `AuthContext.tsx`
2. Añadir métodos de login/register/logout
3. Integrar en `layout.tsx`

### Paso 6: Frontend — Páginas de Auth
1. Crear `app/login/page.tsx`
2. Crear `app/register/page.tsx`
3. Crear `components/ProtectedRoute.tsx`

### Paso 7: Frontend — Perfil y Direcciones
1. Crear `app/profile/page.tsx`
2. Crear `app/addresses/page.tsx`
3. Crear formularios de perfil y direcciones

### Paso 8: Tests
1. Tests de `AuthService`
2. Tests de `UserService`
3. Tests de integración de auth
4. Tests de frontend de login/register

---

## 10. Criterios de Aceptación

- [ ] Registro con email + contraseña funciona
- [ ] Login devuelve JWT válido
- [ ] Requests con token válido son autenticados
- [ ] Requests sin token son rechazados (401)
- [ ] Contraseñas se hashean con BCrypt
- [ ] Perfil de usuario se puede actualizar
- [ ] Direcciones CRUD funciona
- [ ] Historial de pedidos por usuario funciona
- [ ] Carrito migra de localStorage a BD al iniciar sesión
- [ ] Tests pasando (backend + frontend)

---

## 11. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|:---|:---|
| JWT secret expuesto | Usar variable de entorno, nunca en código |
| Contraseñas débiles | Validación de fortaleza en registro |
| SQL Injection | Usar JPA (parametrizado) |
| CSRF | JWT en header (no cookie) |
| Token robado | Expiración corta + refresh token |

---

## 12. Estimación

- **Backend**: 4-5 horas
- **Frontend**: 3-4 horas
- **Tests**: 2 horas
- **Total**: 9-11 horas

---

*Documento creado en modo plan. Pendiente de aprobación para pasar a modo ejecución.*
