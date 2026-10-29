package com.nexus.commerce.dto;

/**
 * DTO de response para métodos de pago del usuario (wallet).
 * 
 * Muestra los métodos de pago attachados al Customer de Stripe
 * que el usuario puede seleccionar en futuros checkouts.
 */
public class PaymentMethodResponse {

    private final String id;
    private final String type;
    private final String brand;
    private final String last4;
    private final Integer expMonth;
    private final Integer expYear;
    private final String customerId;

    public PaymentMethodResponse(String id, String type, String brand, String last4,
                                 Integer expMonth, Integer expYear, String customerId) {
        this.id = id;
        this.type = type;
        this.brand = brand;
        this.last4 = last4;
        this.expMonth = expMonth;
        this.expYear = expYear;
        this.customerId = customerId;
    }

    public String getId() {
        return id;
    }

    public String getType() {
        return type;
    }

    public String getBrand() {
        return brand;
    }

    public String getLast4() {
        return last4;
    }

    public Integer getExpMonth() {
        return expMonth;
    }

    public Integer getExpYear() {
        return expYear;
    }

    public String getCustomerId() {
        return customerId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != getClass()) return false;
        PaymentMethodResponse that = (PaymentMethodResponse) o;
        return id.equals(that.id) &&
                type.equals(that.type) &&
                brand.equals(that.brand) &&
                last4.equals(that.last4) &&
                expMonth.equals(that.expMonth) &&
                expYear.equals(that.expYear) &&
                customerId.equals(that.customerId);
    }

    @Override
    public int hashCode() {
        int result = id.hashCode();
        result = 31 * result + type.hashCode();
        result = 31 * result + brand.hashCode();
        result = 31 * result + last4.hashCode();
        result = 31 * result + expMonth.hashCode();
        result = 31 * result + expYear.hashCode();
        result = 31 * result + customerId.hashCode();
        return result;
    }

    @Override
    public String toString() {
        return "PaymentMethodResponse{" +
                "id='" + id + '\'' +
                ", type='" + type + '\'' +
                ", brand='" + brand + '\'' +
                ", last4='" + last4 + '\'' +
                ", expMonth=" + expMonth +
                ", expYear=" + expYear +
                ", customerId='" + customerId + '\'' +
                '}';
    }
}