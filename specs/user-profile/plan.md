# Plan: Tarea 5.2 — Perfil de Usuario y Direcciones

> **Estado**: PENDIENTE  
> **Fecha**: 2026-10-01  
> **Rama**: `feat/user-profile`

---

## 1. Objetivos

Implementar gestión de perfil de usuario y direcciones de entrega:
- CRUD de perfil (nombre, apellido, email, teléfono, fecha nacimiento, género, altura, peso)
- Gestión de direcciones (máximo 2, una principal)
- Recomendación de tallas basada en medidas

---

## 2. Alcance

### Perfil
- Ver y actualizar datos personales
- Altura y peso para recomendación de tallas

### Direcciones
- Listar direcciones del usuario
- Añadir nueva dirección (máximo 2)
- Actualizar dirección existente
- Eliminar dirección
- Seleccionar dirección principal

---

## 3. API Endpoints

| Método | Endpoint | Descripción |
|:---|:---|:---|
| `GET` | `/api/v1/users/me` | Obtener perfil |
| `PUT` | `/api/v1/users/me` | Actualizar perfil |
| `GET` | `/api/v1/users/me/addresses` | Listar direcciones |
| `POST` | `/api/v1/users/me/addresses` | Añadir dirección |
| `PUT` | `/api/v1/users/me/addresses/{id}` | Actualizar dirección |
| `DELETE` | `/api/v1/users/me/addresses/{id}` | Eliminar dirección |

---

## 4. Criterios de Aceptación

- [ ] Perfil se puede actualizar
- [ ] Direcciones CRUD funciona
- [ ] Máximo 2 direcciones por usuario
- [ ] Una dirección marcada como principal
- [ ] Tests pasando

---

## 5. Estimación

- **Backend**: 2-3 horas
- **Frontend**: 2-3 horas
- **Tests**: 1 hora
- **Total**: 5-7 horas
