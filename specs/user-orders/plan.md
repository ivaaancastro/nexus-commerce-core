# Plan: Tarea 5.3 — Historial de Pedidos

> **Estado**: PENDIENTE  
> **Fecha**: 2026-10-01  
> **Rama**: `feat/user-orders`

---

## 1. Objetivos

Implementar historial de pedidos por usuario:
- Lista de pedidos del usuario
- Detalle de pedido con tracking
- Notificaciones de estado

---

## 2. Alcance

### Historial
- Lista de pedidos del usuario autenticado
- Detalle de pedido con información completa
- Estado del pedido (CONFIRMED, SHIPPED, DELIVERED, CANCELLED)

---

## 3. API Endpoints

| Método | Endpoint | Descripción |
|:---|:---|:---|
| `GET` | `/api/v1/users/me/orders` | Historial de pedidos |
| `GET` | `/api/v1/users/me/orders/{orderNumber}` | Detalle de pedido |

---

## 4. Criterios de Aceptación

- [ ] Historial de pedidos funciona
- [ ] Detalle de pedido accesible
- [ ] Tests pasando

---

## 5. Estimación

- **Backend**: 1-2 horas
- **Frontend**: 1-2 horas
- **Tests**: 1 hora
- **Total**: 3-5 horas
