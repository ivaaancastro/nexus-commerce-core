# ADR-0001: Definición de Stack Base, Concurrencia de Inventario y Precisión Financiera

* **Estado:** Aprobado
* **Fecha:** 2026-09-25
* **Decisores:** Equipo Nexus Core

---

## 1. Contexto y Problema

El desarrollo de un backend de comercio electrónico enterprise requiere resolver tres riesgos críticos de negocio:
1. **Pérdida de céntimos en liquidación fiscal:** El uso de tipos primitivos flotantes (`double`, `float`) introduce imprecisiones binarias inadmisibles en facturación y contabilidad.
2. **Sobreventa en picos de demanda (*Over-selling*):** Cuando múltiples compradores reservan el último SKU simultáneamente, se pueden generar reservas duplicadas si no hay un control de concurrencia atómico.
3. **Estabilidad del ecosistema con IA:** La incorporación de capacidades LLM requiere un framework estable que no comprometa el arranque ni las dependencias binarias del framework base.

---

## 2. Decisiones Tomadas

### 2.1 Stack Tecnológico Base: Java 21 + Spring Boot 3.4.3
* **Decisión:** Fijar la plataforma en **Spring Boot 3.4.3 LTS** sobre **Java 21**.
* **Motivo:** Garantiza compatibilidad binaria nativa con el ecosistema de **Spring AI (1.0.0-M6)**, evitando discrepancias de bytecode en llamadas a métodos de `HttpHeaders` presentes en versiones experimentales o incompatibles. Permite aprovechar las características modernas de Java 21 (Records, Text Blocks, Virtual Threads) manteniendo total estabilidad en producción.

### 2.2 Control de Concurrencia: Bloqueo Pesimista (`PESSIMISTIC_WRITE`)
* **Decisión:** Aplicar `@Lock(LockModeType.PESSIMISTIC_WRITE)` en las operaciones de mutación y reserva de inventario (`StockItemRepository.findBySkuIdAndWarehouseCodeForUpdate`).
* **Motivo:** En retail masivo, el coste de rechazar una operación por stock insuficiente (`409 Conflict`) es infinitamente menor que permitir una sobreventa (*over-selling*). El bloqueo a nivel de fila (`SELECT ... FOR UPDATE` en PostgreSQL) garantiza atomicidad sin depender de reintentos optimistas en carritos de alta fricción.

### 2.3 Precisión Financiera Estricta: `BigDecimal`
* **Decisión:** Prohibir el uso de `float` o `double` en entidades, servicios y DTOs monetarios.
* **Motivo:** Todos los cálculos aplican `BigDecimal` con escala definida y `RoundingMode.HALF_UP` para cumplir normativas tributarias europeas y de comercio internacional.

### 2.4 Salidas Estructuradas con IA (*Structured Outputs*)
* **Decisión:** Consumir modelos de lenguaje exclusivamente a través de la API fluida `ChatClient.prompt().call().entity(Class<T>)`.
* **Motivo:** Impide que respuestas en texto libre degraden o rompan el flujo de ingesta. Spring AI impone un esquema JSON estricto que deserializa directamente a Java Records tipados.

---

## 3. Consecuencias

### Positivas
* Integridad matemática absoluta en desglose impositivo y tarificación multidivisa.
* Cero sobreventas en escenarios de alta concurrencia de reservas.
* Entorno de testing determinista (>90% de cobertura sin llamadas externas a red).
* Compatibilidad total y binaria entre Spring Data JPA, Flyway, WebMvc y Spring AI.

### Compromisos Asumidos
* Los bloqueos pesimistas mantienen una conexión JDBC abierta brevemente durante la reserva; requiere monitorizar el pool de conexiones (HikariCP) bajo cargas extremas.