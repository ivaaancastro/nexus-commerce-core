package com.nexus.commerce.service;

import com.nexus.commerce.dto.ProductResponse;
import com.nexus.commerce.dto.SkuResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogService {

    private final ProductRepository productRepository;

    public List<ProductResponse> getAllProducts() {
        return productRepository.findAll()
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    public Optional<ProductResponse> getProductByReference(String referenceCode) {
        return productRepository.findByReferenceCode(referenceCode)
                .map(this::mapToResponse);
    }

    private ProductResponse mapToResponse(Product product) {
        List<SkuResponse> skuResponses = product.getSkus().stream()
                .map(this::mapSkuToResponse)
                .toList();

        return new ProductResponse(
                product.getId(),
                product.getReferenceCode(),
                product.getName(),
                product.getDescription(),
                product.getFamily(),
                skuResponses
        );
    }

    private SkuResponse mapSkuToResponse(Sku sku) {
        return new SkuResponse(
                sku.getId(),
                sku.getBarcode(),
                sku.getColor(),
                sku.getSize()
        );
    }
}