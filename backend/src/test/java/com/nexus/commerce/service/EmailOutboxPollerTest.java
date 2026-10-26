package com.nexus.commerce.service;

import com.nexus.commerce.entity.EmailOutbox;
import com.nexus.commerce.entity.EmailOutboxStatus;
import com.nexus.commerce.repository.EmailOutboxRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@code EmailOutboxPoller} (V1, D3/RT5): reintentos con backoff, toma
 * condicionada y rendición a los 8 — todos los caminos <strong>medidos</strong>
 * con reloj fijo y {@code procesarPendientes()} a mano (D10: sin cron, sin
 * esperas).
 */
@ExtendWith(MockitoExtension.class)
class EmailOutboxPollerTest {

    private static final Instant AHORA = Instant.parse("2026-10-22T10:00:00Z");
    private static final Clock RELOJ = Clock.fixed(AHORA, ZoneOffset.UTC);
    private static final OffsetDateTime TARDE = OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC);

    @Mock
    private EmailOutboxRepository repository;

    @Mock
    private EmailService emailService;

    private EmailOutboxPoller poller;

    @BeforeEach
    void setUp() {
        poller = new EmailOutboxPoller(repository, emailService, RELOJ);
    }

    private EmailOutbox filaPendiente(int intentos) {
        return EmailOutbox.builder()
                .id(42L)
                .recipient("comprador@example.com")
                .subject("Nexus · Pedido NEX-1 — Enviado")
                .bodyHtml("<html>NEXUS</html>")
                .bodyText("Enviado")
                .status(EmailOutboxStatus.PENDING)
                .attempts(intentos)
                .nextAttemptAt(TARDE.minusSeconds(1)) // el turno ya llegó
                .build();
    }

    private void devolverPendientes(EmailOutbox... filas) {
        when(repository.findByStatusAndNextAttemptAtLessThanEqual(EmailOutboxStatus.PENDING, TARDE))
                .thenReturn(List.of(filas));
    }

    @Test
    @DisplayName("Fila lista y envío correcto → SENT con marca de enviado (R8)")
    void debeMarcarSentCuandoElEnvioVaBien() throws Exception {
        // GIVEN
        EmailOutbox fila = filaPendiente(0);
        devolverPendientes(fila);
        when(repository.tomarSiPendiente(anyLong(), any(), any(), any())).thenReturn(1);

        // WHEN
        int tomadas = poller.procesarPendientes();

        // THEN
        assertThat(tomadas).isEqualTo(1);
        verify(emailService).enviarPedido(eq("comprador@example.com"), any(EmailHtmlTemplates.Mensaje.class));
        assertThat(fila.getStatus()).isEqualTo(EmailOutboxStatus.SENT);
        assertThat(fila.getSentAt()).isEqualTo(TARDE);
        assertThat(fila.getAttempts()).isZero();
    }

    @Test
    @DisplayName("El SMTP falla → attempts++ y reprogramación con backoff de 30 s (R8/D3)")
    void debeReintentarConBackoffCuandoFalla() throws Exception {
        // GIVEN
        EmailOutbox fila = filaPendiente(0);
        devolverPendientes(fila);
        when(repository.tomarSiPendiente(anyLong(), any(), any(), any())).thenReturn(1);
        doThrow(new RuntimeException("SMTP caído")).when(emailService).enviarPedido(any(), any());

        // WHEN
        poller.procesarPendientes();

        // THEN
        assertThat(fila.getAttempts()).isEqualTo(1);
        assertThat(fila.getStatus()).isEqualTo(EmailOutboxStatus.PENDING);
        assertThat(fila.getNextAttemptAt()).isEqualTo(TARDE.plus(Duration.ofSeconds(30)));
        assertThat(fila.getLastError()).contains("SMTP caído");
    }

    @Test
    @DisplayName("Al octavo intento la fila se rinde como FAILED, sin bucle infinito (R8)")
    void debeFallarDefinitivamenteAlOctavoIntento() throws Exception {
        // GIVEN — ya llevaba 7 intentos
        EmailOutbox fila = filaPendiente(7);
        devolverPendientes(fila);
        when(repository.tomarSiPendiente(anyLong(), any(), any(), any())).thenReturn(1);
        doThrow(new RuntimeException("SMTP caído")).when(emailService).enviarPedido(any(), any());

        // WHEN
        poller.procesarPendientes();

        // THEN
        assertThat(fila.getAttempts()).isEqualTo(EmailOutboxPoller.MAX_INTENTOS);
        assertThat(fila.getStatus()).isEqualTo(EmailOutboxStatus.FAILED);
        assertThat(fila.getLastError()).contains("SMTP caído");
    }

    @Test
    @DisplayName("Si otro se llevó la fila (toma = 0), no se envía dos veces (RT5)")
    void laTomaCondicionadaImpideDoblesEnvios() throws Exception {
        // GIVEN — la carrera la ganó el otro
        devolverPendientes(filaPendiente(0));
        when(repository.tomarSiPendiente(anyLong(), any(), any(), any())).thenReturn(0);

        // WHEN
        int tomadas = poller.procesarPendientes();

        // THEN
        assertThat(tomadas).isZero();
        verify(emailService, never()).enviarPedido(any(), any());
    }

    @Test
    @DisplayName("El alquiler de la fila dura 10 minutos: así se recupera un corte (RT5)")
    void elAlquilerDeLaFilaEsDiezMinutos() {
        // GIVEN
        devolverPendientes(filaPendiente(0));
        when(repository.tomarSiPendiente(anyLong(), any(), any(), any())).thenReturn(1);

        // WHEN
        poller.procesarPendientes();

        // THEN
        ArgumentCaptor<OffsetDateTime> hasta = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(repository).tomarSiPendiente(anyLong(), any(), any(), hasta.capture());
        assertThat(hasta.getValue()).isEqualTo(TARDE.plus(EmailOutboxPoller.ALQUILER));
    }

    @Test
    @DisplayName("Filas atascadas en SENDING vuelven a la cola antes de mirar nada (RT5)")
    void debeRecuperarFilasAtascadasEnSending() throws Exception {
        // GIVEN — el recovery devuelve 1 y el poller sigue con la cola
        when(repository.recuperarAtascadas(any(), any(), any())).thenReturn(1);
        EmailOutbox fila = filaPendiente(1);
        devolverPendientes(fila);
        when(repository.tomarSiPendiente(anyLong(), any(), any(), any())).thenReturn(1);

        // WHEN
        poller.procesarPendientes();

        // THEN — umbral = ahora − alquiler (10 min)
        verify(repository).recuperarAtascadas(
                EmailOutboxStatus.SENDING, EmailOutboxStatus.PENDING, TARDE.minus(EmailOutboxPoller.ALQUILER));
        assertThat(fila.getStatus()).isEqualTo(EmailOutboxStatus.SENT);
    }

    @Test
    @DisplayName("Sin filas listas no se envía nada (el backoff respeta el turno)")
    void noDebeProcesarFilasQueNoEstenVencidas() throws Exception {
        // GIVEN — la consulta de turno devuelve vacío (sin stub, Mockito da [])
        // WHEN
        int tomadas = poller.procesarPendientes();

        // THEN
        assertThat(tomadas).isZero();
        verify(emailService, never()).enviarPedido(any(), any());
    }

    @Test
    @DisplayName("El latido del cron nunca lanza, aunque el repositorio explote (D3)")
    void elCronNuncaLanza() {
        // GIVEN
        when(repository.recuperarAtascadas(any(), any(), any()))
                .thenThrow(new RuntimeException("BD caída"));

        // WHEN - THEN
        assertThatCode(poller::programar).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("El backoff duplica desde 30 s y toca techo en ~1 h (R8)")
    void elBackoffDuplicaYTocaTecho() {
        assertThat(EmailOutboxPoller.espera(1)).isEqualTo(Duration.ofSeconds(30));
        assertThat(EmailOutboxPoller.espera(2)).isEqualTo(Duration.ofSeconds(60));
        assertThat(EmailOutboxPoller.espera(3)).isEqualTo(Duration.ofSeconds(120));
        assertThat(EmailOutboxPoller.espera(4)).isEqualTo(Duration.ofMinutes(4));
        assertThat(EmailOutboxPoller.espera(7)).isEqualTo(Duration.ofMinutes(32));
        assertThat(EmailOutboxPoller.espera(10)).isEqualTo(EmailOutboxPoller.ESPERA_TOPE);
    }
}
