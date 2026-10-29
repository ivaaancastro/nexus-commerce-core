package com.nexus.commerce.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.CONFLICT)
public class CouponCodeExistsException extends RuntimeException {
    public CouponCodeExistsException(String message) {
        super(message);
    }
}