package com.nexus.commerce.dto;

import java.util.UUID;

/**
 * DTO de response para el endpoint de checkout con PaymentIntent.
 * 
 * Este class es retornado al frontend después de crear el PaymentIntent
 * en Stripe test mode. Contiene el clientSecret necesario para confirmar
 * el pago desde la UI.
 * 
 * A diferencia de un record, esta clase permite mutabilidad controlada
 * y constructor personalizado para casos de simulación/dummy.
 */
public class PaymentIntentResponse {

    private final String orderNumber;
    private final String paymentIntentId;
    private final String clientSecret;
    private final String status;
    private final int amount; // Amount in cents ( smallest currency unit)
    private final String currency;
    private final String statusUrl;

    /**
     * Constructor completo.
     */
    public PaymentIntentResponse(
            String orderNumber,
            String paymentIntentId,
            String clientSecret,
            String status,
            int amount,
            String currency,
            String statusUrl
    ) {
        this.orderNumber = orderNumber != null ? orderNumber : "ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        this.paymentIntentId = paymentIntentId;
        this.clientSecret = clientSecret;
        this.status = status;
        this.amount = amount;
        this.currency = currency != null ? currency : "eur";
        this.statusUrl = statusUrl;
    }

    // Getters públicos para acceso de lectura
    public String getOrderNumber() {
        return orderNumber;
    }

    public String getPaymentIntentId() {
        return paymentIntentId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public String getStatus() {
        return status;
    }

    public int getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }

    public String getStatusUrl() {
        return statusUrl;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != getClass()) return false;
        PaymentIntentResponse that = (PaymentIntentResponse) o;
        return amount == that.amount &&
                orderNumber.equals(that.orderNumber) &&
                paymentIntentId.equals(that.paymentIntentId) &&
                clientSecret.equals(that.clientSecret) &&
                status.equals(that.status) &&
                currency.equals(that.currency) &&
                statusUrl.equals(that.statusUrl);
    }

    @Override
    public int hashCode() {
        int result = orderNumber.hashCode();
        result = 31 * result + paymentIntentId.hashCode();
        result = 31 * result + clientSecret.hashCode();
        result = 31 * result + status.hashCode();
        result = 31 * result + amount;
        result = 31 * result + currency.hashCode();
        result = 31 * result + statusUrl.hashCode();
        return result;
    }

    @Override
    public String toString() {
        return "PaymentIntentResponse{" +
                "orderNumber='" + orderNumber + '\'' +
                ", paymentIntentId='" + paymentIntentId + '\'' +
                ", clientSecret='" + clientSecret + '\'' +
                ", status='" + status + '\'' +
                ", amount=" + amount +
                ", currency='" + currency + '\'' +
                ", statusUrl='" + statusUrl + '\'' +
                '}';
    }
}