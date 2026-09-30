package com.nexus.commerce.service;

import com.nexus.commerce.entity.Warehouse;
import com.nexus.commerce.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Servicio de selección de almacén óptimo basado en distancia geográfica.
 * Selecciona el almacén más cercano al destino de entrega que tenga stock.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WarehouseSelectionService {

    private final WarehouseRepository warehouseRepository;

    /**
     * Selecciona el almacén más cercano al destino que tenga stock para el SKU dado.
     *
     * @param skuId ID del SKU
     * @param destinationCountryCode código de país destino (ISO 3166-1 alpha-2)
     * @param destinationLatitude latitud del destino
     * @param destinationLongitude longitud del destino
     * @return código del almacén seleccionado, o null si no hay ninguno con stock
     */
    public String selectOptimalWarehouse(Long skuId, String destinationCountryCode,
                                         Double destinationLatitude, Double destinationLongitude) {
        List<Warehouse> warehouses = warehouseRepository.findWarehousesWithStockForSku(skuId);

        if (warehouses.isEmpty()) {
            log.warn("No hay almacenes con stock para el SKU {}", skuId);
            return null;
        }

        // Si no hay coordenadas de destino, seleccionar el primer almacén con stock
        if (destinationLatitude == null || destinationLongitude == null) {
            log.info("Sin coordenadas de destino. Seleccionando primer almacén con stock para SKU {}", skuId);
            return warehouses.get(0).getCode();
        }

        // Buscar almacén más cercano
        Warehouse optimal = warehouses.stream()
                .min((w1, w2) -> {
                    double d1 = calculateDistance(destinationLatitude, destinationLongitude,
                            w1.getLatitude(), w1.getLongitude());
                    double d2 = calculateDistance(destinationLatitude, destinationLongitude,
                            w2.getLatitude(), w2.getLongitude());
                    return Double.compare(d1, d2);
                })
                .orElse(warehouses.get(0));

        log.info("Almacén óptimo seleccionado para SKU {}: {} ({} km)",
                skuId, optimal.getCode(),
                String.format("%.0f", calculateDistance(destinationLatitude, destinationLongitude,
                        optimal.getLatitude(), optimal.getLongitude())));

        return optimal.getCode();
    }

    /**
     * Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine.
     * @return distancia en kilómetros
     */
    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        final int EARTH_RADIUS_KM = 6371;

        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);

        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS_KM * c;
    }
}
