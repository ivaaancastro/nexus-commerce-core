# Spec: Tarea 5.2 — Perfil de Usuario y Direcciones

> **Estado**: PENDIENTE DE APROBACIÓN
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

- [ ] El perfil se muestra con los datos del usuario autenticado
- [ ] Los datos se actualizan correctamente
- [ ] Altura y peso se validan (100-250 cm, 30-250 kg)
- [ ] Se pueden listar, añadir, editar y eliminar direcciones
- [ ] No se pueden añadir más de 2 direcciones
- [ ] Solo una dirección es principal
- [ ] Las páginas requieren autenticación
- [ ] La recomendación de talla funciona con las medidas

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

---

*Spec pendiente de aprobación. No implementar hasta tener el OK del usuario.*
