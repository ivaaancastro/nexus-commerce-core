package com.nexus.commerce.service;

import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderItem;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.repository.ProductReturnRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Regla de elegibilidad de devolución (spec Tarea 5.4, §2.3):
 *
 * <pre>
 * returnEligible = status == DELIVERED
 *               &amp;&amp; createdAt + 30d &gt; now
 *               &amp;&amp; !existsReturn(orderItemId)
 * </pre>
 *
 * <p><b>Orden de evaluación</b> — la spec fija la fórmula booleana pero no la
 * prioridad del motivo; aquí se evalúa así:</p>
 * <ol>
 *   <li>{@code NOT_DELIVERED} — compuerta de R2 y, además, el único caso que no
 *       consulta BD, de modo que el checkout (pedido {@code PENDING}) sale sin coste.</li>
 *   <li>{@code ALREADY_RETURNED} — el estado más específico y accionable: si la línea
 *       ya se devolvió, decir «plazo agotado» induciría a error.</li>
 *   <li>{@code EXPIRED} — R1, la ventana de 30 días.</li>
 * </ol>
 *
 * <p>La ventana se calcula desde la <b>fecha de compra</b>, no la de entrega, y es
 * estricta: a los 30 días exactos la línea ya no es devolvible.</p>
 */
@Service
@RequiredArgsConstructor
public class ReturnEligibilityService {

    public static final String REASON_NOT_DELIVERED = "NOT_DELIVERED";
    public static final String REASON_EXPIRED = "EXPIRED";
    public static final String REASON_ALREADY_RETURNED = "ALREADY_RETURNED";

    public static final int WINDOW_DAYS = 30;

    private final ProductReturnRepository productReturnRepository;
    private final Clock clock;

    /** Resultado de la evaluación: elegibilidad y motivo de inelegibilidad (o {@code null}). */
    public record Eligibility(boolean eligible, String ineligibleReason) {}

    public Eligibility evaluate(Order order, OrderItem item) {
        if (order.getStatus() != OrderStatus.DELIVERED) {
            return new Eligibility(false, REASON_NOT_DELIVERED);
        }

        if (productReturnRepository.existsByOrderItemId(item.getId())) {
            return new Eligibility(false, REASON_ALREADY_RETURNED);
        }

        if (!isWithinPurchaseWindow(order.getCreatedAt())) {
            return new Eligibility(false, REASON_EXPIRED);
        }

        return new Eligibility(true, null);
    }

    public boolean isEligible(Order order, OrderItem item) {
        return evaluate(order, item).eligible();
    }

    private boolean isWithinPurchaseWindow(Instant createdAt) {
        Instant deadline = createdAt.plus(WINDOW_DAYS, ChronoUnit.DAYS);
        return deadline.isAfter(clock.instant());
    }
}
