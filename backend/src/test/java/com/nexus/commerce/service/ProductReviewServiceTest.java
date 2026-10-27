package com.nexus.commerce.service;

import com.nexus.commerce.dto.CreateReviewRequest;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.ProductReview;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.ProductReviewRepository;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductReviewServiceTest {

    @Mock
    private ProductReviewRepository reviewRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ProductReviewService reviewService;

    @Test
    @DisplayName("GIVEN producto y usuario válidos WHEN crea review THEN guarda y retorna")
    void createReviewSuccess() {
        // GIVEN
        Long productId = 1L;
        String email = "user@test.com";
        CreateReviewRequest req = new CreateReviewRequest(5, "Genial", "Muy buena compra");
        
        Product product = Product.builder().id(productId).build();
        User user = User.builder().id(10L).email(email).build();
        
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(reviewRepository.findByProductIdAndUserId(productId, 10L)).thenReturn(Optional.empty());
        
        ProductReview saved = ProductReview.builder()
                .id(100L).product(product).user(user)
                .rating(5).title("Genial").comment("Muy buena compra")
                .build();
        when(reviewRepository.save(any(ProductReview.class))).thenReturn(saved);

        // WHEN
        var res = reviewService.createOrUpdateReview(productId, email, req);

        // THEN
        assertThat(res.id()).isEqualTo(100L);
        assertThat(res.rating()).isEqualTo(5);
        verify(reviewRepository).save(any(ProductReview.class));
    }

    @Test
    @DisplayName("GIVEN una review de admin WHEN borra THEN usa repositorio")
    void adminDeleteSuccess() {
        // GIVEN
        Long reviewId = 100L;
        ProductReview review = ProductReview.builder().id(reviewId).build();
        when(reviewRepository.findById(reviewId)).thenReturn(Optional.of(review));

        // WHEN
        reviewService.adminDeleteReview(reviewId);

        // THEN
        verify(reviewRepository).delete(review);
    }
}
