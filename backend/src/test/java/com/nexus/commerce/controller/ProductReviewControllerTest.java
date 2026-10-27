package com.nexus.commerce.controller;

import com.nexus.commerce.dto.CreateReviewRequest;
import com.nexus.commerce.dto.ReviewResponse;
import com.nexus.commerce.dto.ReviewSummaryResponse;
import com.nexus.commerce.service.ProductReviewService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.ZonedDateTime;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductReviewControllerTest {

    @Mock
    private ProductReviewService reviewService;

    @InjectMocks
    private ProductReviewController reviewController;

    @Mock
    private Authentication authentication;

    @Test
    @DisplayName("GET /api/v1/products/{id}/reviews retorna resumen y lista")
    void getReviewsReturnsSummary() {
        // GIVEN
        Long productId = 1L;
        ReviewSummaryResponse summary = new ReviewSummaryResponse(4.5, 2L, List.of(
                new ReviewResponse(1L, 1L, "user@test.com", 5, "Excelente", "Muy buena calidad", ZonedDateTime.now())
        ));
        when(reviewService.getReviewsByProductId(productId)).thenReturn(summary);

        // WHEN
        var response = reviewController.getReviewsForProduct(productId);

        // THEN
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(summary);
    }

    @Test
    @DisplayName("POST /api/v1/products/{id}/reviews crea la reseña correctamente")
    void createReviewSuccess() {
        // GIVEN
        Long productId = 1L;
        String email = "user@test.com";
        CreateReviewRequest req = new CreateReviewRequest(4, "Bueno", "Me gusta");
        ReviewResponse reviewRes = new ReviewResponse(10L, productId, email, 4, "Bueno", "Me gusta", ZonedDateTime.now());
        
        when(authentication.getName()).thenReturn(email);
        when(reviewService.createOrUpdateReview(eq(productId), eq(email), any())).thenReturn(reviewRes);

        // WHEN
        var response = reviewController.createReview(productId, authentication, req);

        // THEN
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isEqualTo(reviewRes);
    }

    @Test
    @DisplayName("DELETE /api/v1/admin/reviews/{id} borra como admin")
    void adminDeleteReview() {
        // GIVEN
        Long reviewId = 100L;

        // WHEN
        var response = reviewController.adminDeleteReview(reviewId);

        // THEN
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(reviewService).adminDeleteReview(reviewId);
    }
}
