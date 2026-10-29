package com.nexus.commerce.dto;

import java.math.BigDecimal;

/**
 * DTO de request para iniciar un reembolso.
 * 
 * amount: Si es null → reembolso total. Si tiene valor → reembolso parcial.
 * reason: Motivo del reembolso (opcional, ej: customer_request, duplicate_charge).
 */
public class RefundRequest {

    private BigDecimal amount; // null = reembolso total
    private String reason; // opcional

    public RefundRequest() {
    }

    public RefundRequest(BigDecimal amount, String reason) {
        this.amount = amount;
        this.reason = reason;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}