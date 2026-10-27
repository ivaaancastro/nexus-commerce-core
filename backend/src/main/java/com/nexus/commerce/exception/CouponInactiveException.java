package com.nexus.commerce.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.BAD_REQUEST)
public class CouponInactiveException extends RuntimeException {
    public CouponInactiveException(String message) {
        super(message);
    }
}