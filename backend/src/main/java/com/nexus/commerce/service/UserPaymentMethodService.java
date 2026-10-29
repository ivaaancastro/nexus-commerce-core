package com.nexus.commerce.service;

import com.nexus.commerce.dto.PaymentMethodResponse;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.PaymentMethod;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class UserPaymentMethodService {

    private static final Logger log = LoggerFactory.getLogger(UserPaymentMethodService.class);

    private final OrderRepository orderRepository;

    public UserPaymentMethodService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    /**
     * Lista los métodos de pago attachados al customer del usuario autenticado.
     * 
     * En un implementation completo con Stripe, esto consultaría el Customer
     * de Stripe y listaría sus paymentMethods. Por ahora, simulamos con
     * los métodos de pedidos previos del usuario.
     * 
     * @return Lista de PaymentMethodResponse (vacía si el usuario no tiene pedidos)
     */
    @Transactional(readOnly = true)
    public List<PaymentMethodResponse> getUserPaymentMethods(String userEmail) {
        // Buscar órdenes del usuario para inferir métodos de pago
        Optional<Order> orderOptional = orderRepository.findByUserEmail(userEmail);

        List<Order> orders = orderOptional.isPresent() ? List.of(orderOptional.get()) : List.of();

        if (orders.isEmpty()) {
            log.info("Usuario '{}' no tiene pedidos previos, lista de métodos vacía", userEmail);
            return List.of();
        }

        // Extraer métodos de pago únicos de las órdenes del usuario
        return orders.stream()
                .filter(order -> order.getPaymentMethod() != null)
                .map(order -> new PaymentMethodResponse(
                        order.getPaymentMethod().name(),
                        // Marca por defecto basada en el nombre
                        order.getPaymentMethod().name().equalsIgnoreCase("VISA") ? "visa" :
                                order.getPaymentMethod().name().equalsIgnoreCase("MASTERCARD") ? "mastercard" : "card",
                        order.getPaymentMethod().name(),
                        "****", // Los últimos 4 dígitos no están disponibles en el resumen
                        12, // Fecha de expiración simulada
                        2030, // Año de expiración simulado
                        userEmail
                ))
                .distinct()
                .collect(Collectors.toList());
    }
}