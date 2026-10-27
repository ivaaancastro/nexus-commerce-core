package com.nexus.commerce.controller;

import com.nexus.commerce.dto.CreateReviewRequest;
import com.nexus.commerce.dto.ReviewResponse;
import com.nexus.commerce.dto.ReviewSummaryResponse;
import com.nexus.commerce.service.ProductReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class ProductReviewController {

    private final ProductReviewService reviewService;

    @GetMapping("/products/{productId}/reviews")
    public ResponseEntity<ReviewSummaryResponse> getReviewsForProduct(@PathVariable Long productId) {
        return ResponseEntity.ok(reviewService.getReviewsByProductId(productId));
    }

    @PostMapping("/products/{productId}/reviews")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<ReviewResponse> createReview(
            @PathVariable Long productId,
            Authentication authentication,
            @Valid @RequestBody CreateReviewRequest request) {
        String userEmail = authentication.getName();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reviewService.createOrUpdateReview(productId, userEmail, request));
    }

    @DeleteMapping("/products/{productId}/reviews/{reviewId}")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<Void> deleteReview(
            @PathVariable Long productId,
            @PathVariable Long reviewId,
            Authentication authentication) {
        String userEmail = authentication.getName();
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        reviewService.deleteReview(productId, reviewId, userEmail, isAdmin);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/admin/reviews/{reviewId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> adminDeleteReview(@PathVariable Long reviewId) {
        // En el servicio podemos delegar un borrado directo por reviewId para el admin
        reviewService.adminDeleteReview(reviewId);
        return ResponseEntity.noContent().build();
    }
}
