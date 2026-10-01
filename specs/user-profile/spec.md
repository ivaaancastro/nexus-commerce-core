# Spec: Tarea 5.2 — Perfil de Usuario y Direcciones

> **Estado**: ✅ APROBADA por el usuario — 2026-10-01
> **Fecha**: 2026-10-01
> **Rama**: `feat/user-profile`

---

## 1. Requisitos

### R1 — Consultar perfil
El usuario autenticado debe poder ver sus datos.

**Criterio**: `GET /api/v1/users/me` devuelve id, email, nombre, apellido, teléfono, fecha de nacimiento, género, altura, peso.

### R2 — Actualizar perfil
El usuario debe poder modificar sus datos personales.

**Criterio**: `PUT /api/v1/users/me` persiste los cambios. El email no es modificable.

### R3 — Medidas para recomendación de tallas
El perfil debe.store altura y peso en centímetros y kilogramos.

**Criterio**: Campos `height` (Double) y `weight` (Double). Valores entre 100-250 cm y 30-250 kg.

### R4 — Validación de medidas
Las medidas deben validarse en cliente y servidor.

**Criterio**: Altura 100-250 cm, peso 30-250 kg. Valores fuera de rango se rechazan.

### R5 — Listar direcciones
El usuario debe poder ver sus direcciones de entrega.

**Criterio**: `GET /api/v1/users/me/addresses` devuelve máximo 2 direcciones.

### R6 — Añadir dirección
El usuario debe poder añadir una dirección de entrega.

**Criterio**: `POST /api/v1/users/me/addresses` con nombre, calle, ciudad, código postal y país.

### R7 — Límite de 2 direcciones
No se pueden tener más de 2 direcciones.

**Criterio**: La tercera dirección se rechaza con error explicativo.

### R8 — Dirección principal
Una dirección debe estar marcada como principal.

**Criterio**: Solo una puede ser principal. Al marcar una nueva como principal, la anterior se desmarca automáticamente.

### R9 — Actualizar dirección
El usuario debe poder editar una dirección existente.

**Criterio**: `PUT /api/v1/users/me/addresses/{id}` con validación de pertenencia al usuario.

### R10 — Eliminar dirección
El usuario debe poder eliminar una dirección.

**Criterio**: `DELETE /api/v1/users/me/addresses/{id}`. Si era la principal, la otra pasa a ser principal.

### R11 — Página de perfil
Debe existir una interfaz para ver y editar el perfil.

**Criterio**: Ruta `/profile` con formulario precargado.

### R12 — Página de direcciones
Debe existir una interfaz para gestionar direcciones.

**Criterio**: Ruta `/addresses` con lista, formulario de alta y edición.

### R13 — Ruta protegida
Las páginas de perfil y direcciones requieren autenticación.

**Criterio**: Sin token válido, redirige a `/login`.

### R14 — Recomendación de talla
Con las medidas del perfil, se puede recomendar una talla por producto.

**Criterio**: Función que recibe altura, peso y tabla de tallas del producto, y devuelve la talla sugerida.

---

## 2. API

### Endpoints

| Método | Endpoint | Auth | Descripción |
|:---|:---|:---:|:---|
| `GET` | `/api/v1/users/me` | ✅ | Obtener perfil |
| `PUT` | `/api/v1/users/me` | ✅ | Actualizar perfil |
| `GET` | `/api/v1/users/me/addresses` | ✅ | Listar direcciones |
| `POST` | `/api/v1/users/me/addresses` | ✅ | Añadir dirección |
| `PUT` | `/api/v1/users/me/addresses/{id}` | ✅ | Actualizar dirección |
| `DELETE` | `/api/v1/users/me/addresses/{id}` | ✅ | Eliminar dirección |

### DTOs

```java
public record ProfileUpdateRequest(
    String firstName,
    String lastName,
    String phone,
    LocalDate birthDate,
    Gender gender,
    Double height,
    Double weight
) {}

public record AddressRequest(
    String fullName,
    String street,
    String city,
    String postalCode,
    String countryCode,
    boolean defaultAddress
) {}

public record AddressResponse(
    Long id,
    String fullName,
    String street,
    String city,
    String postalCode,
    String countryCode,
    boolean defaultAddress
) {}
```

---

## 3. Modelo de Datos

No hay cambios de esquema. Las entidades `User` y `Address` ya existen desde Tarea 5.1.

---

## 4. Criterios de Aceptación

- [x] El perfil se muestra con los datos del usuario autenticado
- [x] Los datos se actualizan correctamente
- [x] Altura y peso se validan (100-250 cm, 30-250 kg)
- [x] Se pueden listar, añadir, editar y eliminar direcciones
- [x] No se pueden añadir más de 2 direcciones
- [x] Solo una dirección es principal
- [x] Las páginas requieren autenticación
- [x] La recomendación de talla funciona con las medidas

---

## 5. Casos de Error

| Caso | Respuesta |
|:---|:---|
| Sin token | `401 Unauthorized` |
| Token inválido | `401 Unauthorized` |
| Dirección de otro usuario | `404 Not Found` |
| Tercera dirección | `400` con mensaje explicativo |
| Altura fuera de rango | `400` con mensaje de rango |
| Altura no numérica | `400` de validación |
| Sin medidas en el perfil al pedir talla | `400` pidiendo que guarde altura y peso |
| Producto sin tallas | `404` con mensaje específico |

---

## 6. Apuntes de Implementación

Decisiones tomadas durante la implementación que **no alteran el alcance**
pero sí su interpretación. Se registran aquí según la regla 3 del workflow SDD.

### 6.1. Los servicios trabajan con `email`, no con `userId`

Todos los servicios (`UserService`, `AddressService`, `SizeRecommendationService`)
reciben el `email` que Spring Security extrae del token. La resolución
`email → User` ocurre dentro de cada servicio.

**Por qué**: el controller solo dispone de `Authentication.getName()`. Pasar el
`userId` habría obligado a resolverlo en el controller, mezclando seguridad con
lógica de negocio. El contrato HTTP no cambia.

### 6.2. `PUT /me` es una actualización parcial

Los campos `null` **se ignoran** y conservan su valor actual.

**Por qué**: el formulario precarga todos los campos, así que un campo en blanco
significa "sin cambios". Un `PUT` clásico (reemplazo total) obligaría a enviar
siempre el perfil completo y haría imposible distinguir "borrado" de "olvido".

**Fuera de alcance**: vaciar una medida ya guardada. Para ello haría falta un
semántica explícita (p. ej. `clearMeasurements`) que la spec no contempla.

### 6.3. Recomendación de talla: escala genérica, no por familia

La spec habla de "tabla de tallas **del producto**". El catálogo actual solo
tiene una familia (`OUTERWEAR`) y dos tallas (`M`, `L`), por lo que crear una
tabla por familia habría sido infraestructura sin uso.

Se implementa una **escala de referencia única** (XS-XXL) con interpolación
lineal por tramos sobre los **centros** de cada talla:

```
altura 159 166.5 173 179 186 194 cm   → ordinal 0..5
peso   51.5  60   69 78.5 88.5 101 kg → ordinal 0..5
ideal = redondear( (altura + peso) / 2 )
```

Se usan centros y no límites porque con los límites una persona en lo alto de
una talla saltaba a la siguiente: 175 cm cae en el centro de `M` (173), no en
el borde de `L`.

- **Escala canónica** (`XS`-`XXL`): se elige la talla más cercana al ideal.
  En empate gana la **mayor**, que es la más cómoda.
- **Escala desconocida** (numérica 38/40/42, o cualquier otra): se ordena y se
  selecciona por **posición proporcional** al ordinal ideal.
- **Confianza**: `Alta` si las medidas están en la tabla y altura/peso coinciden;
  `Media` si discrepan o la escala no es canónica; `Baja` si alguna medida está
  fuera del rango fiable.

Si en el futuro hay familias con tablas propias (p. ej. pantalonería por
talla de cintura), se sustituye la escala única por un `Map<family, Scale>`
sin tocar el resto del flujo.

### 6.4. Formularios con `noValidate`

Los inputs conservan `required`, `min`, `max` como **pistas** para el usuario y
para accesibilidad, pero los formularios llevan `noValidate`.

**Por qué**: si no, el navegador bloquea el submit con su propio mensaje antes de
ejecutar la validación custom, y no veríamos los mensajes amigables del proyecto
(`getFriendlyErrorMessage`, textos en español, estilo editorial).

### 6.5. Trazabilidad de requisitos

| Requisito | Implementación | Test |
|:---|:---|:---|
| R1 | `UserService.getProfile` + `GET /me` | `UserServiceTest`, `UserControllerTest` |
| R2 | `UserService.updateProfile` + `PUT /me` | `UserServiceTest` (3), `UserControllerTest` |
| R3 | Campos `height`/`weight` en `User` | ya existentes desde Tarea 5.1 |
| R4 | Validación en DTO y en servicio | `UserServiceTest` (4) |
| R5 | `AddressService.list` | `AddressServiceTest` (2), `UserControllerTest` |
| R6 | `AddressService.create` | `AddressServiceTest` (2), `UserControllerTest` |
| R7 | Comprobación de límite en `create` | `AddressServiceTest` |
| R8 | `makeDefault` desmarca la anterior | `AddressServiceTest` |
| R9 | `findOwned` → `ResourceNotFoundException` | `AddressServiceTest` (2) |
| R10 | `promoteRemainingDefault` | `AddressServiceTest` (2) |
| R11 | `app/profile/page.tsx` | `UserProfilePage.test.tsx` |
| R12 | `app/addresses/page.tsx` | `AddressesPage.test.tsx` |
| R13 | `components/ProtectedRoute.tsx` | `ProtectedRoute.test.tsx` (3) |
| R14 | `SizeRecommendationService` | `SizeRecommendationServiceTest` (14) |

---

*Spec ✅ aprobada el 2026-10-01 e implementada el mismo día.*
