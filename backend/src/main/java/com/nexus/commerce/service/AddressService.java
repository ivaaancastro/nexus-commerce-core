package com.nexus.commerce.service;

import com.nexus.commerce.dto.AddressRequest;
import com.nexus.commerce.dto.AddressResponse;
import com.nexus.commerce.entity.Address;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.AddressRepository;
import com.nexus.commerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/**
 * CRUD de direcciones de entrega.
 *
 * Reglas de negocio:
 *  - Máximo {@value #MAX_ADDRESSES} direcciones por usuario (R7).
 *  - Solo una puede estar marcada como principal; al marcar una nueva, la
 *    anterior se desmarca automáticamente (R8).
 *  - Al eliminar la principal, la restante pasa a principal (R10).
 *  - Una dirección que no pertenezca al usuario responde 404, nunca 403,
 *    para no filtrar su existencia (R9).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AddressService {

    static final int MAX_ADDRESSES = 2;

    private final AddressRepository addressRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<AddressResponse> list(String email) {
        User user = findUser(email);

        return addressRepository.findByUserId(user.getId()).stream()
                .sorted(Comparator
                        .comparing(Address::isDefaultAddress).reversed()
                        .thenComparing(Address::getId))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AddressResponse create(String email, AddressRequest request) {
        User user = findUser(email);
        Long userId = user.getId();

        if (addressRepository.countByUserId(userId) >= MAX_ADDRESSES) {
            throw new IllegalArgumentException(
                    "Solo puedes guardar un máximo de " + MAX_ADDRESSES
                            + " direcciones. Elimina una para añadir otra.");
        }

        Address address = Address.builder()
                .user(user)
                .fullName(request.fullName().trim())
                .street(request.street().trim())
                .city(request.city().trim())
                .postalCode(request.postalCode().trim())
                .countryCode(request.countryCode().trim().toUpperCase())
                .defaultAddress(false)
                .build();

        address = addressRepository.save(address);

        // Primera dirección del usuario: nace como principal.
        // Las demás solo se marcan si lo pidió el usuario.
        if (request.defaultAddress() || addressRepository.countByUserId(userId) == 1) {
            address = makeDefault(userId, address);
        }

        log.info("Dirección id={} creada para usuario id={}", address.getId(), userId);
        return toResponse(address);
    }

    @Transactional
    public AddressResponse update(String email, Long addressId, AddressRequest request) {
        Address address = findOwned(email, addressId);

        address.setFullName(request.fullName().trim());
        address.setStreet(request.street().trim());
        address.setCity(request.city().trim());
        address.setPostalCode(request.postalCode().trim());
        address.setCountryCode(request.countryCode().trim().toUpperCase());

        Address saved = addressRepository.save(address);

        if (request.defaultAddress()) {
            saved = makeDefault(saved.getUser().getId(), saved);
        }

        return toResponse(saved);
    }

    @Transactional
    public void delete(String email, Long addressId) {
        Address address = findOwned(email, addressId);
        Long userId = address.getUser().getId();
        boolean wasDefault = address.isDefaultAddress();

        addressRepository.delete(address);

        if (wasDefault) {
            promoteRemainingDefault(userId);
        }

        log.info("Dirección id={} eliminada para usuario id={}", addressId, userId);
    }

    /**
     * Marca la dirección como principal y desmarca el resto en la misma transacción,
     * de modo que la unicidad se mantiene de forma atómica.
     */
    private Address makeDefault(Long userId, Address address) {
        addressRepository.findByUserId(userId).stream()
                .filter(other -> !other.getId().equals(address.getId()))
                .filter(Address::isDefaultAddress)
                .forEach(other -> {
                    other.setDefaultAddress(false);
                    addressRepository.save(other);
                });

        address.setDefaultAddress(true);
        return addressRepository.save(address);
    }

    private void promoteRemainingDefault(Long userId) {
        List<Address> remaining = addressRepository.findByUserId(userId);
        if (remaining.isEmpty()) {
            return;
        }

        Address first = remaining.getFirst();
        first.setDefaultAddress(true);
        addressRepository.save(first);
    }

    private Address findOwned(String email, Long addressId) {
        User user = findUser(email);

        return addressRepository.findById(addressId)
                .filter(address -> address.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Dirección no encontrada"));
    }

    private User findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
    }

    private AddressResponse toResponse(Address address) {
        return new AddressResponse(
                address.getId(),
                address.getFullName(),
                address.getStreet(),
                address.getCity(),
                address.getPostalCode(),
                address.getCountryCode(),
                address.isDefaultAddress()
        );
    }
}
