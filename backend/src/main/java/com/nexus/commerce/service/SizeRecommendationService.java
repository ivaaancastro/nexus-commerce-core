package com.nexus.commerce.service;

import com.nexus.commerce.dto.SizeRecommendationResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Recomienda una talla a partir de las medidas del perfil (altura y peso)
 * y las tallas disponibles del producto (R14).
 *
 * El algoritmo es deliberadamente genérico porque el catálogo no fija una
 * escala única: funciona con etiquetas canónicas (XS-XXL), con numéricas
 * (38, 40, 42) y con escalas desconocidas mediante posición relativa.
 *
 * Método:
 *  1. Convertir altura y peso en un "ordinal de talla" continuo interpolando
 *     sobre la tabla de referencia de confección.
 *  2. Promediar ambos ordinales → ordinal ideal.
 *  3. Elegir la talla disponible más próxima al ideal.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SizeRecommendationService {

    /** Ordinal canónico: XS=0, S=1, M=2, L=3, XL=4, XXL=5, 3XL=6. */
    private static final Map<String, Integer> CANONICAL = new HashMap<>();
    static {
        CANONICAL.put("XXS", 0);
        CANONICAL.put("XS", 0);
        CANONICAL.put("S", 1);
        CANONICAL.put("M", 2);
        CANONICAL.put("L", 3);
        CANONICAL.put("XL", 4);
        CANONICAL.put("XXL", 5);
        CANONICAL.put("3XL", 6);
        CANONICAL.put("XXXL", 6);
    }

    /**
     * Centro de cada talla en la tabla de referencia, en cm.
     * Se usan los centros (no los límites) para que una persona en el rango
     * alto de una talla no sea empujada a la siguiente: 175 cm cae en el
     * centro de M (173), no en el borde de L.
     */
    private static final double[] HEIGHT_BREAKS = {159, 166.5, 173, 179, 186, 194};
    /** Centro de cada talla en la tabla de referencia, en kg. */
    private static final double[] WEIGHT_BREAKS = {51.5, 60, 69, 78.5, 88.5, 101};
    /** Ordinal asociado a cada punto de corte de las tablas anteriores. */
    private static final double[] ORDINALS = {0, 1, 2, 3, 4, 5};

    /** Rangos en los que la tabla de referencia sigue siendo fiable. */
    private static final double RELIABLE_HEIGHT_MIN = 150;
    private static final double RELIABLE_HEIGHT_MAX = 200;
    private static final double RELIABLE_WEIGHT_MIN = 45;
    private static final double RELIABLE_WEIGHT_MAX = 110;

    private static final int MAX_ORDINAL = 5;

    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public SizeRecommendationResponse recommend(String email, Long productId) {
        User user = findUser(email);

        if (user.getHeight() == null || user.getWeight() == null) {
            throw new IllegalArgumentException(
                    "Guarda tu altura y tu peso en el perfil para recibir una recomendación de talla.");
        }

        Product product = productRepository.findWithSkusById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));

        List<String> available = product.getSkus().stream()
                .map(Sku::getSize)
                .filter(size -> size != null && !size.isBlank())
                .toList();

        if (available.isEmpty()) {
            throw new ResourceNotFoundException("Este producto no tiene tallas disponibles");
        }

        return build(user.getHeight(), user.getWeight(), available);
    }

    /**
     * Núcleo puro del algoritmo, sin acceso a BD: se puede probar de forma aislada.
     */
    SizeRecommendationResponse build(double height, double weight, List<String> availableSizes) {
        double heightOrdinal = interpolate(height, HEIGHT_BREAKS, ORDINALS);
        double weightOrdinal = interpolate(weight, WEIGHT_BREAKS, ORDINALS);
        int ideal = (int) Math.round((heightOrdinal + weightOrdinal) / 2.0);

        List<String> distinct = distinctSizes(availableSizes);
        Optional<MappedSize> chosen = chooseCanonical(distinct, ideal);

        SizeRecommendationResponse response = chosen
                .map(size -> respond(size.label(), height, weight, confidence(height, weight, true)))
                .orElseGet(() -> {
                    String label = chooseByRank(distinct, ideal);
                    return respond(label, height, weight, confidence(height, weight, false));
                });

        log.debug("Recomendación de talla: altura={}cm peso={}kg → {}",
                height, weight, response.recommendedSize());
        return response;
    }

    /** Elige entre las tallas que conocemos en la escala canónica. */
    private Optional<MappedSize> chooseCanonical(List<String> sizes, int ideal) {
        List<MappedSize> mapped = sizes.stream()
                .map(this::toMapped)
                .flatMap(Optional::stream)
                .toList();

        if (mapped.isEmpty()) {
            return Optional.empty();
        }

        // Distancia al ideal; a empate gana la talla mayor, que es la más cómoda.
        return mapped.stream()
                .sorted((a, b) -> {
                    int da = Math.abs(a.ordinal() - ideal);
                    int db = Math.abs(b.ordinal() - ideal);
                    if (da != db) {
                        return Integer.compare(da, db);
                    }
                    return Integer.compare(b.ordinal(), a.ordinal());
                })
                .findFirst();
    }

    /**
     * Respaldo cuando no reconocemos la escala: ordena las tallas y selecciona
     * por posición proporcional al ordinal ideal.
     */
    private String chooseByRank(List<String> sizes, int ideal) {
        if (sizes.size() == 1) {
            return sizes.getFirst();
        }

        List<String> sorted = new ArrayList<>(sizes);
        sorted.sort(this::compareSizes);

        double ratio = Math.max(0, Math.min(1, (double) ideal / MAX_ORDINAL));
        int index = (int) Math.round(ratio * (sorted.size() - 1));
        return sorted.get(index);
    }

    /** Orden natural: numérico si todos lo son, alfabético como respaldo. */
    private int compareSizes(String a, String b) {
        Long na = parseNumber(a);
        Long nb = parseNumber(b);
        if (na != null && nb != null) {
            return na.compareTo(nb);
        }
        if (na != null) {
            return -1;
        }
        if (nb != null) {
            return 1;
        }
        return a.compareTo(b);
    }

    private Optional<MappedSize> toMapped(String size) {
        return Optional.ofNullable(CANONICAL.get(normalize(size)))
                .map(ordinal -> new MappedSize(size, ordinal));
    }

    private String normalize(String size) {
        return size.trim().toUpperCase(Locale.ROOT).replace("-", "").replace(" ", "");
    }

    private Long parseNumber(String size) {
        try {
            return Long.parseLong(size.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** Elimina duplicados preservando el orden de aparición. */
    private List<String> distinctSizes(List<String> sizes) {
        return new ArrayList<>(new LinkedHashSet<>(sizes));
    }

    /**
     * Confianza en la sugerencia:
     *  - Alta   → medidas dentro de la tabla y altura/peso apuntan a la misma talla.
     *  - Media  → medidas dentro de la tabla pero discrepantes, o escala no canónica.
     *  - Baja   → alguna medida fuera del rango fiable de la tabla.
     */
    private String confidence(double height, double weight, boolean canonical) {
        boolean inRange = height >= RELIABLE_HEIGHT_MIN && height <= RELIABLE_HEIGHT_MAX
                && weight >= RELIABLE_WEIGHT_MIN && weight <= RELIABLE_WEIGHT_MAX;

        if (!inRange) {
            return "Baja";
        }
        if (!canonical) {
            return "Media";
        }

        double diff = Math.abs(
                interpolate(height, HEIGHT_BREAKS, ORDINALS)
                        - interpolate(weight, WEIGHT_BREAKS, ORDINALS));
        return diff <= 1 ? "Alta" : "Media";
    }

    private SizeRecommendationResponse respond(String label, double height, double weight, String confidence) {
        String reason = String.format(
                "Con %s cm y %s kg, la talla %s es la que mejor se ajusta a tu constitución.",
                trim(height), trim(weight), label);
        return new SizeRecommendationResponse(label, reason, confidence);
    }

    /** Evita mostrar "175.0": 175 → "175", 175.5 → "175.5". */
    private String trim(double value) {
        if (value == Math.floor(value)) {
            return String.valueOf((long) value);
        }
        return String.valueOf(value);
    }

    /** Interpolación lineal por tramos, con extrapolación en los extremos. */
    private double interpolate(double value, double[] breaks, double[] ordinals) {
        int last = breaks.length - 1;

        if (value <= breaks[0]) {
            double slope = (ordinals[1] - ordinals[0]) / (breaks[1] - breaks[0]);
            return ordinals[0] + (value - breaks[0]) * slope;
        }
        if (value >= breaks[last]) {
            double slope = (ordinals[last] - ordinals[last - 1]) / (breaks[last] - breaks[last - 1]);
            return ordinals[last] + (value - breaks[last]) * slope;
        }
        for (int i = 0; i < last; i++) {
            if (value < breaks[i + 1]) {
                double t = (value - breaks[i]) / (breaks[i + 1] - breaks[i]);
                return ordinals[i] + t * (ordinals[i + 1] - ordinals[i]);
            }
        }
        return ordinals[last];
    }

    private record MappedSize(String label, int ordinal) {}

    private User findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
    }
}
