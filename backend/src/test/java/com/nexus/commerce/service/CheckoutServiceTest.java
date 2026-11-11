package com.nexus.commerce.service;

import com.nexus.commerce.dto.CheckoutRequest;
import com.nexus.commerce.dto.OrderResponse;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.PaymentStatus;
import com.nexus.commerce.exception.PaymentGatewayException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Fase 9 · R1 — {@link CheckoutService}: T1 → Stripe fuera de la transacción →
 * compensación. Todo con mocks: lo que se prueba es la <em>orquestación</em>.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Fase 9 - CheckoutService: PaymentIntent tras el commit, idempotencia y compensación")
class CheckoutServiceTest {

    private static final String NUM = "ORD-CK-1";

    @Mock private OrderService orderService;
    @Mock private PaymentService paymentService;
    @Mock private AdminOrderService adminOrderService;
    @Mock private StripeGateway stripeGateway;

    private CheckoutService service;
    private final CheckoutRequest request = mock(CheckoutRequest.class);

    @BeforeEach
    void crear() {
        service = new CheckoutService(orderService, paymentService, adminOrderService, stripeGateway);
    }

    private OrderResponse orden(PaymentStatus pago) {
        OrderResponse r = mock(OrderResponse.class);
        lenient().when(r.paymentStatus()).thenReturn(pago);
        lenient().when(r.orderNumber()).thenReturn(NUM);
        return r;
    }

    private static PaymentService.PaymentTarget objetivo(String paymentIntentId) {
        return new PaymentService.PaymentTarget(NUM, new BigDecimal("96.80"), "EUR", "idem-uuid",
                paymentIntentId, PaymentStatus.REQUIRES_PAYMENT, OrderStatus.PENDING);
    }

    @Test
    @DisplayName("modo sin pasarela (NONE): devuelve el pedido tal cual, sin tocar Stripe")
    void sinPasarela() {
        OrderResponse orden = orden(PaymentStatus.NONE);
        when(orderService.processCheckout("k", request, "a@b.c")).thenReturn(orden);

        assertThat(service.checkout("k", request, "a@b.c")).isSameAs(orden);
        verifyNoInteractions(stripeGateway, paymentService, adminOrderService);
    }

    @Test
    @DisplayName("tarjeta: crea el PaymentIntent con importe en céntimos e idempotency key del cliente y guarda su id")
    void creaElPaymentIntentDespuesDelCommit() {
        OrderResponse creada = orden(PaymentStatus.REQUIRES_PAYMENT);
        OrderResponse refrescada = mock(OrderResponse.class);
        when(orderService.processCheckout("k", request, "a@b.c")).thenReturn(creada);
        when(paymentService.paymentTarget(NUM)).thenReturn(objetivo(null));
        when(stripeGateway.createPaymentIntent(NUM, 9680L, "EUR", "idem-uuid"))
                .thenReturn(new StripeGateway.GatewayPaymentIntent("pi_1", "secret", "requires_payment_method"));
        when(orderService.getOrderByNumber(NUM)).thenReturn(Optional.of(refrescada));

        OrderResponse res = service.checkout("k", request, "a@b.c");

        assertThat(res).isSameAs(refrescada);
        verify(paymentService).attachPaymentIntent(NUM, "pi_1");
        verify(adminOrderService, never()).cancelarPorImpago(anyString());
    }

    @Test
    @DisplayName("repetición idempotente: si el PaymentIntent ya existe, no se crea otro")
    void repeticionIdempotente() {
        OrderResponse creada = orden(PaymentStatus.REQUIRES_PAYMENT);
        when(orderService.processCheckout("k", request, "a@b.c")).thenReturn(creada);
        when(paymentService.paymentTarget(NUM)).thenReturn(objetivo("pi_ya"));

        assertThat(service.checkout("k", request, "a@b.c")).isSameAs(creada);
        verifyNoInteractions(stripeGateway);
    }

    @Test
    @DisplayName("repetición de un checkout cuyo pedido ya se canceló (fallo previo de Stripe): NO crea un PaymentIntent para un pedido sin stock")
    void repeticionDeUnPedidoCanceladoNoCreaPaymentIntent() {
        OrderResponse cancelado = orden(PaymentStatus.REQUIRES_PAYMENT);
        when(orderService.processCheckout("k", request, "a@b.c")).thenReturn(cancelado);
        when(paymentService.paymentTarget(NUM)).thenReturn(new PaymentService.PaymentTarget(NUM,
                new BigDecimal("96.80"), "EUR", "idem-uuid", null, PaymentStatus.REQUIRES_PAYMENT, OrderStatus.CANCELLED));

        assertThat(service.checkout("k", request, "a@b.c")).isSameAs(cancelado);

        verifyNoInteractions(stripeGateway);
        verify(paymentService, never()).attachPaymentIntent(anyString(), anyString());
        verify(adminOrderService, never()).cancelarPorImpago(anyString());
    }

    @Test
    @DisplayName("checkout en Suiza (CHF): crea el PaymentIntent en francos, no compensa")
    void checkoutEnFrancosSuizos() {
        OrderResponse pendiente = orden(PaymentStatus.REQUIRES_PAYMENT);
        when(orderService.processCheckout("k", request, "a@b.c")).thenReturn(pendiente);
        when(paymentService.paymentTarget(NUM)).thenReturn(new PaymentService.PaymentTarget(NUM,
                new BigDecimal("89.90"), "CHF", "idem-uuid", null, PaymentStatus.REQUIRES_PAYMENT, OrderStatus.PENDING));
        when(stripeGateway.createPaymentIntent(NUM, 8990L, "CHF", "idem-uuid"))
                .thenReturn(new StripeGateway.GatewayPaymentIntent("pi_chf", "s", "requires_payment_method"));
        when(orderService.getOrderByNumber(NUM)).thenReturn(Optional.of(pendiente));

        service.checkout("k", request, "a@b.c");

        verify(paymentService).attachPaymentIntent(NUM, "pi_chf");
        verify(adminOrderService, never()).cancelarPorImpago(anyString());
    }

    @Test
    @DisplayName("si Stripe falla: compensa (cancela el pedido, libera stock y cupón) y responde 502")
    void stripeFallaCompensa() {
        OrderResponse pendiente = orden(PaymentStatus.REQUIRES_PAYMENT);
        when(orderService.processCheckout("k", request, "a@b.c")).thenReturn(pendiente);
        when(paymentService.paymentTarget(NUM)).thenReturn(objetivo(null));
        when(stripeGateway.createPaymentIntent(anyString(), anyLong(), anyString(), anyString()))
                .thenThrow(new PaymentGatewayException("Stripe caído"));

        assertThatThrownBy(() -> service.checkout("k", request, "a@b.c"))
                .isInstanceOf(PaymentGatewayException.class);

        verify(adminOrderService).cancelarPorImpago(NUM);
        verify(paymentService, never()).attachPaymentIntent(anyString(), anyString());
    }

    @Test
    @DisplayName("moneda no soportada: también compensa y se traduce a 502, sin llamar a Stripe")
    void monedaNoSoportadaCompensa() {
        OrderResponse pendiente = orden(PaymentStatus.REQUIRES_PAYMENT);
        when(orderService.processCheckout("k", request, "a@b.c")).thenReturn(pendiente);
        when(paymentService.paymentTarget(NUM)).thenReturn(new PaymentService.PaymentTarget(NUM,
                new BigDecimal("96.80"), "JPY", "idem-uuid", null, PaymentStatus.REQUIRES_PAYMENT, OrderStatus.PENDING));

        assertThatThrownBy(() -> service.checkout("k", request, "a@b.c"))
                .isInstanceOf(PaymentGatewayException.class);

        verify(adminOrderService).cancelarPorImpago(NUM);
        verifyNoInteractions(stripeGateway);
    }

    @Test
    @DisplayName("si el guardado del id falla tras crear el PaymentIntent, también compensa")
    void falloAlGuardarElIdCompensa() {
        OrderResponse pendiente = orden(PaymentStatus.REQUIRES_PAYMENT);
        when(orderService.processCheckout("k", request, "a@b.c")).thenReturn(pendiente);
        when(paymentService.paymentTarget(NUM)).thenReturn(objetivo(null));
        when(stripeGateway.createPaymentIntent(anyString(), anyLong(), anyString(), anyString()))
                .thenReturn(new StripeGateway.GatewayPaymentIntent("pi_1", "s", "requires_payment_method"));
        doThrow(new IllegalStateException("BD caída"))
                .when(paymentService).attachPaymentIntent(NUM, "pi_1");

        assertThatThrownBy(() -> service.checkout("k", request, "a@b.c"))
                .isInstanceOf(PaymentGatewayException.class);

        verify(adminOrderService).cancelarPorImpago(NUM);
        // y el PaymentIntent que Stripe ya había creado no queda huérfano
        verify(stripeGateway).cancelPaymentIntent("pi_1");
    }
}
