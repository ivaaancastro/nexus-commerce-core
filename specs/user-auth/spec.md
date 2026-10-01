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

---

## 2. Criterios de Aceptación

- [x] Registro con email + contraseña + datos personales funciona
- [x] Verificación de email con código de 6 dígitos
- [x] Login con email + contraseña funciona
- [x] Recuperación de contraseña por email funciona
- [x] Reenvío de código de verificación
- [x] Tests pasando (38 backend + 27 frontend)

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

---

*Spec creado en modo plan.*
