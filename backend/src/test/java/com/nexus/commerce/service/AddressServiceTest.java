package com.nexus.commerce.service;

import com.nexus.commerce.dto.AddressRequest;
import com.nexus.commerce.dto.AddressResponse;
import com.nexus.commerce.entity.Address;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.AddressRepository;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AddressServiceTest {

    private static final String EMAIL = "ana@example.com";
    private static final String OTHER_EMAIL = "otro@example.com";

    @Mock
    private AddressRepository addressRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AddressService addressService;

    private User user(Long id, String email) {
        return User.builder().id(id).email(email).build();
    }

    private Address address(Long id, User owner, boolean isDefault) {
        return Address.builder()
                .id(id)
                .user(owner)
                .fullName("Ana García")
                .street("Calle Mayor 1")
                .city("Madrid")
                .postalCode("28001")
                .countryCode("ES")
                .defaultAddress(isDefault)
                .build();
    }

    private AddressRequest request(boolean defaultAddress) {
        return new AddressRequest(
                "Ana García", "Calle Mayor 1", "Madrid", "28001", "ES", defaultAddress);
    }

    // ── R5: listar direcciones ──────────────────────────────────────────────

    @Test
    @DisplayName("R5: debe listar las direcciones con la principal primero")
    void shouldListAddressesWithDefaultFirst() {
        // GIVEN
        User owner = user(1L, EMAIL);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(owner));
        when(addressRepository.findByUserId(1L)).thenReturn(List.of(
                address(2L, owner, false),
                address(1L, owner, true)));

        // WHEN
        List<AddressResponse> result = addressService.list(EMAIL);

        // THEN
        assertThat(result).hasSize(2);
        assertThat(result.getFirst().id()).isEqualTo(1L);
        assertThat(result.getFirst().defaultAddress()).isTrue();
    }

    @Test
    @DisplayName("R5: un usuario sin direcciones devuelve lista vacía")
    void shouldReturnEmptyListWhenNoAddresses() {
        // GIVEN
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user(1L, EMAIL)));
        when(addressRepository.findByUserId(1L)).thenReturn(List.of());

        // WHEN
        List<AddressResponse> result = addressService.list(EMAIL);

        // THEN
        assertThat(result).isEmpty();
    }

    // ── R6: añadir dirección ────────────────────────────────────────────────

    @Test
    @DisplayName("R6: debe crear una dirección con el país en mayúsculas")
    void shouldCreateAddress() {
        // GIVEN
        User owner = user(1L, EMAIL);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(owner));
        when(addressRepository.countByUserId(1L)).thenReturn(0L);
        when(addressRepository.save(any(Address.class))).thenAnswer(inv -> {
            Address saved = inv.getArgument(0);
            saved.setId(10L);
            return saved;
        });

        // WHEN
        AddressResponse response = addressService.create(EMAIL, request(false));

        // THEN
        ArgumentCaptor<Address> captor = ArgumentCaptor.forClass(Address.class);
        verify(addressRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        Address saved = captor.getValue();
        assertThat(saved.getCountryCode()).isEqualTo("ES");
        assertThat(saved.getUser()).isSameAs(owner);
        assertThat(response.id()).isEqualTo(10L);
    }

    @Test
    @DisplayName("R6: la primera dirección del usuario nace como principal")
    void shouldMakeFirstAddressDefault() {
        // GIVEN
        User owner = user(1L, EMAIL);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(owner));
        // 0 antes de guardar, 1 después de guardar
        when(addressRepository.countByUserId(1L)).thenReturn(0L, 1L);
        when(addressRepository.findByUserId(1L)).thenReturn(List.of());
        when(addressRepository.save(any(Address.class))).thenAnswer(inv -> {
            Address saved = inv.getArgument(0);
            saved.setId(10L);
            return saved;
        });

        // WHEN
        AddressResponse response = addressService.create(EMAIL, request(false));

        // THEN
        assertThat(response.defaultAddress()).isTrue();
    }

    // ── R7: límite de 2 direcciones ─────────────────────────────────────────

    @Test
    @DisplayName("R7: debe rechazar la tercera dirección con mensaje explicativo")
    void shouldRejectThirdAddress() {
        // GIVEN
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user(1L, EMAIL)));
        when(addressRepository.countByUserId(1L)).thenReturn(2L);

        // WHEN / THEN
        assertThatThrownBy(() -> addressService.create(EMAIL, request(false)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("máximo de 2 direcciones")
                .hasMessageContaining("Elimina una");

        verify(addressRepository, never()).save(any());
    }

    // ── R8: una sola dirección principal ────────────────────────────────────

    @Test
    @DisplayName("R8: marcar una nueva principal desmarca la anterior")
    void shouldUnsetDefaultWhenSettingNewOne() {
        // GIVEN
        User owner = user(1L, EMAIL);
        Address oldDefault = address(1L, owner, true);
        Address target = address(2L, owner, false);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(owner));
        when(addressRepository.findById(2L)).thenReturn(Optional.of(target));
        when(addressRepository.findByUserId(1L)).thenReturn(List.of(oldDefault, target));
        when(addressRepository.save(any(Address.class))).thenAnswer(inv -> inv.getArgument(0));

        AddressRequest request = request(true);

        // WHEN
        addressService.update(EMAIL, 2L, request);

        // THEN
        assertThat(oldDefault.isDefaultAddress()).isFalse();
        assertThat(target.isDefaultAddress()).isTrue();
    }

    // ── R9: pertenencia de la dirección ─────────────────────────────────────

    @Test
    @DisplayName("R9: una dirección de otro usuario responde 404, no 403")
    void shouldReturn404ForAddressOfAnotherUser() {
        // GIVEN
        User owner = user(1L, EMAIL);
        User intruder = user(2L, OTHER_EMAIL);

        when(userRepository.findByEmail(OTHER_EMAIL)).thenReturn(Optional.of(intruder));
        when(addressRepository.findById(1L)).thenReturn(Optional.of(address(1L, owner, true)));

        // WHEN / THEN
        assertThatThrownBy(() -> addressService.update(OTHER_EMAIL, 1L, request(false)))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Dirección no encontrada");
    }

    @Test
    @DisplayName("R9: eliminar una dirección inexistente responde 404")
    void shouldReturn404WhenAddressDoesNotExist() {
        // GIVEN
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user(1L, EMAIL)));
        when(addressRepository.findById(99L)).thenReturn(Optional.empty());

        // WHEN / THEN
        assertThatThrownBy(() -> addressService.delete(EMAIL, 99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ── R10: eliminar dirección ─────────────────────────────────────────────

    @Test
    @DisplayName("R10: al eliminar la principal, la restante pasa a principal")
    void shouldPromoteRemainingAddressWhenDefaultDeleted() {
        // GIVEN
        User owner = user(1L, EMAIL);
        Address beingDeleted = address(1L, owner, true);
        Address remaining = address(2L, owner, false);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(owner));
        when(addressRepository.findById(1L)).thenReturn(Optional.of(beingDeleted));
        when(addressRepository.findByUserId(1L)).thenReturn(List.of(remaining));
        when(addressRepository.save(any(Address.class))).thenAnswer(inv -> inv.getArgument(0));

        // WHEN
        addressService.delete(EMAIL, 1L);

        // THEN
        verify(addressRepository).delete(beingDeleted);
        assertThat(remaining.isDefaultAddress()).isTrue();
    }

    @Test
    @DisplayName("R10: eliminar una dirección no principal no toca la principal")
    void shouldKeepDefaultWhenNonDefaultDeleted() {
        // GIVEN
        User owner = user(1L, EMAIL);
        Address nonDefault = address(2L, owner, false);
        Address theDefault = address(1L, owner, true);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(owner));
        when(addressRepository.findById(2L)).thenReturn(Optional.of(nonDefault));

        // WHEN
        addressService.delete(EMAIL, 2L);

        // THEN
        verify(addressRepository).delete(nonDefault);
        verify(addressRepository, never()).save(theDefault);
        verify(addressRepository, never()).findByUserId(1L);
        assertThat(theDefault.isDefaultAddress()).isTrue();
    }
}
