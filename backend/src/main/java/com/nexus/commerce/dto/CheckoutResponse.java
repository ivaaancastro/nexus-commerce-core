package com.nexus.commerce.dto;

/**
 * Response combinado para el endpoint de checkout.
 * 
 * Une los datos de la orden (OrderResponse) con la información del
 * PaymentIntent de Stripe necesario para que el frontend confirme el pago.
 * 
 * Esta clase es mutable controlada (fields are final, set only via constructor)
 * para permitir acceso directo desde los tests, a diferencia de un record donde
 * los components pueden tener problemas de acceso en algunos entornos.
 */
public class CheckoutResponse {

    private final OrderResponse order;
    private final String paymentIntentId;
    private final String clientSecret;

    /**
     * Constructor completo.
     */
    public CheckoutResponse(OrderResponse order, String paymentIntentId, String clientSecret) {
        this.order = order;
        this.paymentIntentId = paymentIntentId;
        this.clientSecret = clientSecret;
    }

    // Getters públicos para acceso de lectura
    public OrderResponse getOrder() {
        return order;
    }

    public String getPaymentIntentId() {
        return paymentIntentId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != getClass()) return false;
        CheckoutResponse that = (CheckoutResponse) o;
        return order.equals(that.order) &&
                paymentIntentId.equals(that.paymentIntentId) &&
                clientSecret.equals(that.clientSecret);
    }

    @Override
    public int hashCode() {
        return order.hashCode() * 31 + paymentIntentId.hashCode() * 31 + clientSecret.hashCode() * 31;
    }

    @Override
    public String toString() {
        return "CheckoutResponse{" +
                "order=" + order +
                ", paymentIntentId='" + paymentIntentId + '\'' +
                ", clientSecret='" + clientSecret + '\'' +
                '}';
    }
}