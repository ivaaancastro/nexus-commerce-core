package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Address;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AddressRepository extends JpaRepository<Address, Long> {
    List<Address> findByUserId(Long userId);
    long countByUserId(Long userId);

    /**
     * Dirección comprobando la propiedad <strong>en la propia consulta</strong>
     * (Tarea 5.5, R1). Resolverla así hace que «no existe» y «es de otro
     * usuario» devuelvan lo mismo —vacío—, sin filtrar nunca una dirección ajena.
     */
    Optional<Address> findByIdAndUserId(Long id, Long userId);
}
