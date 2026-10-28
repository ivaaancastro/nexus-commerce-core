package com.nexus.commerce.service;

import com.nexus.commerce.dto.AdminReviewPageResponse;
import com.nexus.commerce.dto.AdminReviewResponse;
import com.nexus.commerce.dto.CreateReviewRequest;
import com.nexus.commerce.dto.ReviewResponse;
import com.nexus.commerce.dto.ReviewSummaryResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.ProductReview;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.CatalogConflictException;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.ProductReviewRepository;
import com.nexus.commerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductReviewService {

    private final ProductReviewRepository reviewRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public ReviewSummaryResponse getReviewsByProductId(Long productId) {
        List<ProductReview> reviews = reviewRepository.findByProductIdOrderByCreatedAtDesc(productId);
        Double average = reviewRepository.findAverageRatingByProductId(productId);
        Long count = reviewRepository.countByProductId(productId);

        List<ReviewResponse> reviewResponses = reviews.stream()
                .map(r -> new ReviewResponse(r.getId(), r.getProduct().getId(), r.getUser().getEmail(), r.getRating(), r.getTitle(), r.getComment(), r.getCreatedAt()))
                .collect(Collectors.toList());

        return new ReviewSummaryResponse(average != null ? average : 0.0, count, reviewResponses);
    }

    @Transactional
    public ReviewResponse createOrUpdateReview(Long productId, String userEmail, CreateReviewRequest request) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));

        if (reviewRepository.findByProductIdAndUserId(productId, user.getId()).isPresent()) {
            throw new CatalogConflictException("Ya has publicado una opinión para este producto");
        }

        ProductReview review = ProductReview.builder()
                .product(product)
                .user(user)
                .rating(request.rating())
                .title(request.title())
                .comment(request.comment())
                .build();

        ProductReview savedReview = reviewRepository.save(review);
        log.info("Opinión creada para el producto {} por usuario {}", productId, userEmail);

        return new ReviewResponse(savedReview.getId(), productId, userEmail, savedReview.getRating(), savedReview.getTitle(), savedReview.getComment(), savedReview.getCreatedAt());
    }

    @Transactional
    public void deleteReview(Long productId, Long reviewId, String userEmail, boolean isAdmin) {
        ProductReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Opinión no encontrada"));

        if (!review.getProduct().getId().equals(productId)) {
            throw new ResourceNotFoundException("Opinión no pertenece a este producto");
        }

        if (!isAdmin && !review.getUser().getEmail().equals(userEmail)) {
            throw new IllegalArgumentException("No tienes permiso para borrar esta opinión");
        }

        reviewRepository.delete(review);
        log.info("Opinión {} borrada", reviewId);
    }

    @Transactional(readOnly = true)
    public AdminReviewPageResponse getAdminReviews(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, org.springframework.data.domain.Sort.by(
                org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
        Page<ProductReview> pagina = reviewRepository.findAllByOrderByCreatedAtDesc(pageable);

        List<AdminReviewResponse> items = pagina.getContent().stream()
                .map(r -> new AdminReviewResponse(
                        r.getId(),
                        r.getProduct().getId(),
                        r.getProduct().getName(),
                        r.getUser().getEmail(),
                        r.getRating(),
                        r.getTitle(),
                        r.getComment(),
                        r.getCreatedAt()))
                .toList();

        return new AdminReviewPageResponse(items, pagina.getNumber(), pagina.getSize(),
                pagina.getTotalElements(), pagina.getTotalPages());
    }

    @Transactional
    public void adminDeleteReview(Long reviewId) {
        ProductReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Opinión no encontrada"));
        reviewRepository.delete(review);
        log.info("Admin borró la opinión {}", reviewId);
    }
}
