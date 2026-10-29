package com.nexus.commerce.dto;

import java.math.BigDecimal;

/**
 * DTO de response para el endpoint de reembolso.
 * 
 * Contiene los datos del refund creado en Stripe y reflejado en la orden.
 */
public class RefundResponse {

    private final String refundId;
    private final BigDecimal amount;
    private final String currency;
    private final String status;
    private final String charge;

    public RefundResponse(String refundId, BigDecimal amount, String currency, String status, String charge) {
        this.refundId = refundId;
        this.amount = amount;
        this.currency = currency;
        this.status = status;
        this.charge = charge;
    }

    public String getRefundId() {
        return refundId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }

    public String getStatus() {
        return status;
    }

    public String getCharge() {
        return charge;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != getClass()) return false;
        RefundResponse that = (RefundResponse) o;
        return amount.equals(that.amount) &&
                currency.equals(that.currency) &&
                status.equals(that.status) &&
                refundId.equals(that.refundId) &&
                charge.equals(that.charge);
    }

    @Override
    public int hashCode() {
        int result = refundId.hashCode();
        result = 31 * result + amount.hashCode();
        result = 31 * result + currency.hashCode();
        result = 31 * result + status.hashCode();
        result = 31 * result + charge.hashCode();
        return result;
    }

    @Override
    public String toString() {
        return "RefundResponse{" +
                "refundId='" + refundId + '\'' +
                ", amount=" + amount +
                ", currency='" + currency + '\'' +
                ", status='" + status + '\'' +
                ", charge='" + charge + '\'' +
                '}';
    }
}