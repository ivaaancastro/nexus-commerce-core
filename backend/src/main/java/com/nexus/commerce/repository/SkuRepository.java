package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Sku;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkuRepository extends JpaRepository<Sku, Long> {
}