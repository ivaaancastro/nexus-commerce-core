package com.nexus.commerce.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** V5: borrar un cupón ya usado (spec specs/coupons/ §2.2 → 409). */
@ResponseStatus(HttpStatus.CONFLICT)
public class CouponHasUsagesException extends RuntimeException {
    public CouponHasUsagesException(String message) {
        super(message);
    }
}
