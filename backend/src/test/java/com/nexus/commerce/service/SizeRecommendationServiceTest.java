package com.nexus.commerce.service;

import com.nexus.commerce.dto.SizeRecommendationResponse;
import com.nexus.commerce.entity.Gender;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SizeRecommendationServiceTest {

    private static final String EMAIL = "ana@example.com";

    @Mock
    private ProductRepository productRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SizeRecommendationService sizeRecommendationService;

    private List<String> sizes(String... labels) {
        return List.of(labels);
    }

    // ── Algoritmo puro ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("Algoritmo de recomendación")
    class Algorithm {

        @Test
        @DisplayName("175 cm / 70 kg con tallas M y L → M (cae en el centro de M)")
        void shouldRecommendMediumForAverageBuild() {
            // WHEN
            SizeRecommendationResponse result =
                    sizeRecommendationService.build(175, 70, sizes("M", "L"));

            // THEN
            assertThat(result.recommendedSize()).isEqualTo("M");
        }

        @Test
        @DisplayName("180 cm / 78 kg con tallas M y L → L")
        void shouldRecommendLargeForTallerBuild() {
            // WHEN
            SizeRecommendationResponse result =
                    sizeRecommendationService.build(180, 78, sizes("M", "L"));

            // THEN
            assertThat(result.recommendedSize()).isEqualTo("L");
        }

        @Test
        @DisplayName("160 cm / 52 kg con tallas XS, S y M → XS")
        void shouldRecommendExtraSmallForPetiteBuild() {
            // WHEN
            SizeRecommendationResponse result =
                    sizeRecommendationService.build(160, 52, sizes("XS", "S", "M"));

            // THEN
            assertThat(result.recommendedSize()).isEqualTo("XS");
        }

        @Test
        @DisplayName("En empate exacto se prefiere la talla mayor (más cómoda)")
        void shouldPreferLargerSizeOnTie() {
            // GIVEN: 173 cm / 69 kg da ordinal ideal exactamente 2,
            //        y S(1) y L(3) están a la misma distancia.
            // WHEN
            SizeRecommendationResponse result =
                    sizeRecommendationService.build(173, 69, sizes("S", "L"));

            // THEN
            assertThat(result.recommendedSize()).isEqualTo("L");
        }

        @Test
        @DisplayName("Si solo hay una talla disponible, se devuelve esa")
        void shouldReturnTheOnlyAvailableSize() {
            // WHEN
            SizeRecommendationResponse result =
                    sizeRecommendationService.build(190, 100, sizes("L"));

            // THEN
            assertThat(result.recommendedSize()).isEqualTo("L");
        }

        @Test
        @DisplayName("Escalas numéricas no canónicas se resuelven por posición")
        void shouldHandleNumericScalesByRank() {
            // GIVEN: escala 38/40/42/44 desconocida del algoritmo canónico.
            // WHEN  : 173 cm / 69 kg → ordinal ideal 2 → 40 % del rango.
            SizeRecommendationResponse result =
                    sizeRecommendationService.build(173, 69, sizes("38", "40", "42", "44"));

            // THEN
            assertThat(result.recommendedSize()).isIn("38", "40", "42", "44");
            assertThat(result.recommendedSize()).isEqualTo("40");
        }

        @Test
        @DisplayName("El mensaje explica el porqué con las medidas del usuario")
        void shouldExplainReasonWithMeasurements() {
            // WHEN
            SizeRecommendationResponse result =
                    sizeRecommendationService.build(175, 70, sizes("M", "L"));

            // THEN
            assertThat(result.reason())
                    .contains("175")
                    .contains("70")
                    .contains("M");
        }

        @Test
        @DisplayName("Medidas dentro de la tabla y coherentes → confianza Alta")
        void shouldReportHighConfidenceWhenConsistent() {
            // WHEN
            SizeRecommendationResponse result =
                    sizeRecommendationService.build(175, 70, sizes("M", "L"));

            // THEN
            assertThat(result.confidence()).isEqualTo("Alta");
        }

        @Test
        @DisplayName("Escala no canónica → confianza Media")
        void shouldReportMediumConfidenceForUnknownScale() {
            // WHEN
            SizeRecommendationResponse result =
                    sizeRecommendationService.build(175, 70, sizes("38", "40"));

            // THEN
            assertThat(result.confidence()).isEqualTo("Media");
        }

        @Test
        @DisplayName("Medida fuera del rango fiable de la tabla → confianza Baja")
        void shouldReportLowConfidenceOutsideTable() {
            // WHEN
            SizeRecommendationResponse result =
                    sizeRecommendationService.build(140, 40, sizes("XS", "S"));

            // THEN
            assertThat(result.confidence()).isEqualTo("Baja");
        }
    }

    // ── Orquestación con BD ─────────────────────────────────────────────────

    @Nested
    @DisplayName("Orquestación con base de datos")
    class Orchestration {

        private User userWithMeasurements(Double height, Double weight) {
            return User.builder()
                    .id(1L)
                    .email(EMAIL)
                    .firstName("Ana")
                    .lastName("García")
                    .birthDate(LocalDate.of(1990, 5, 20))
                    .gender(Gender.FEMALE)
                    .height(height)
                    .weight(weight)
                    .emailVerified(true)
                    .build();
        }

        private Product productWithSizes(String... label) {
            Product product = Product.builder()
                    .id(10L)
                    .referenceCode("REF-001")
                    .name("Abrigo")
                    .family("OUTERWEAR")
                    .build();
            for (String size : label) {
                Sku sku = Sku.builder()
                        .barcode("B-" + size)
                        .color("Negro")
                        .size(size)
                        .product(product)
                        .build();
                product.getSkus().add(sku);
            }
            return product;
        }

        @Test
        @DisplayName("Devuelve la talla sugerida a partir del perfil y el producto")
        void shouldRecommendFromProfileAndProduct() {
            // GIVEN
            when(userRepository.findByEmail(EMAIL))
                    .thenReturn(Optional.of(userWithMeasurements(175.0, 70.0)));
            when(productRepository.findWithSkusById(10L))
                    .thenReturn(Optional.of(productWithSizes("M", "L")));

            // WHEN
            SizeRecommendationResponse result = sizeRecommendationService.recommend(EMAIL, 10L);

            // THEN
            assertThat(result.recommendedSize()).isEqualTo("M");
            assertThat(result.reason()).isNotBlank();
        }

        @Test
        @DisplayName("Sin medidas en el perfil no se puede recomendar")
        void shouldRejectWhenNoMeasurements() {
            // GIVEN
            when(userRepository.findByEmail(EMAIL))
                    .thenReturn(Optional.of(userWithMeasurements(null, null)));

            // WHEN / THEN
            assertThatThrownBy(() -> sizeRecommendationService.recommend(EMAIL, 10L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("altura y tu peso");
        }

        @Test
        @DisplayName("Producto inexistente → 404")
        void shouldReturn404WhenProductNotFound() {
            // GIVEN
            when(userRepository.findByEmail(EMAIL))
                    .thenReturn(Optional.of(userWithMeasurements(175.0, 70.0)));
            when(productRepository.findWithSkusById(99L)).thenReturn(Optional.empty());

            // WHEN / THEN
            assertThatThrownBy(() -> sizeRecommendationService.recommend(EMAIL, 99L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Producto no encontrado");
        }

        @Test
        @DisplayName("Producto sin tallas → 404 con mensaje específico")
        void shouldReturn404WhenProductHasNoSizes() {
            // GIVEN
            when(userRepository.findByEmail(EMAIL))
                    .thenReturn(Optional.of(userWithMeasurements(175.0, 70.0)));
            when(productRepository.findWithSkusById(10L))
                    .thenReturn(Optional.of(productWithSizes()));

            // WHEN / THEN
            assertThatThrownBy(() -> sizeRecommendationService.recommend(EMAIL, 10L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Este producto no tiene tallas disponibles");
        }
    }
}
