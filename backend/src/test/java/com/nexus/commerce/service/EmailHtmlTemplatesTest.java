package com.nexus.commerce.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La plantilla compartida (V1 R7): estilo webapp <em>medido</em>, no supuesto.
 * Estas asertaciones son las que impiden que un email vuelva a salir «plano».
 */
@DisplayName("EmailHtmlTemplates — plantilla HTML compartida (R7)")
class EmailHtmlTemplatesTest {

    @Test
    @DisplayName("El envoltorio lleva wordmark NEXUS, título en mayúsculas y pie — estilo web")
    void debeLlevarIdentidadVisual() {
        // WHEN
        String html = EmailHtmlTemplates.envoltorio("Hemos recibido tu pedido",
                EmailHtmlTemplates.parrafo("Hola"));

        // THEN
        assertThat(html)
                .contains("NEXUS")
                .contains("Hemos recibido tu pedido")
                .contains("text-transform:uppercase")   // títulos y wordmark en mayúsculas
                .contains("letter-spacing:0.25em")      // tracking editorial
                .contains("Nexus Core — comercio editorial");
    }

    @Test
    @DisplayName("Usa la pila tipográfica de la web con respaldo (Geist, luego sistema)")
    void debeUsarPilaTipograficaConRespaldo() {
        // WHEN
        String html = EmailHtmlTemplates.envoltorio("Título", EmailHtmlTemplates.parrafo("Cuerpo"));

        // THEN — Geist primero; si el cliente no la tiene, cae a las del sistema
        assertThat(html).contains("Geist, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif");
    }

    @Test
    @DisplayName("Todo el CSS va inline: cero etiquetas <style> ni hojas externas")
    void debeLlevarCssInlineSinStyleExterno() {
        // WHEN
        String html = EmailHtmlTemplates.envoltorio("Título",
                EmailHtmlTemplates.parrafo("Cuerpo") + "\n"
                        + EmailHtmlTemplates.dato("Estado", "Enviado") + "\n"
                        + EmailHtmlTemplates.boton("http://localhost:3000/orders/1", "Ver mi pedido"));

        // THEN — los clientes de correo eliminan <style>; sólo sobrevive el inline
        assertThat(html)
                .doesNotContain("<style")
                .doesNotContain("rel=\"stylesheet\"")
                .contains("style=\"");
    }

    @Test
    @DisplayName("El botón replica el estilo de la vitrina: fondo neutral-900, texto blanco en mayúsculas")
    void debeLlevarBotonEstiloVitrina() {
        // WHEN
        String boton = EmailHtmlTemplates.boton("http://localhost:3000/orders/NEX-1", "Ver mi pedido");

        // THEN
        assertThat(boton)
                .contains("background-color:#171717")
                .contains("color:#ffffff")
                .contains("text-transform:uppercase")
                .contains("href=\"http://localhost:3000/orders/NEX-1\"");
    }

    @Test
    @DisplayName("Sin imágenes: no hay ni una etiqueta <img> (no hay logo, el logo es texto)")
    void noDebeLlevarImagenes() {
        // WHEN
        String html = EmailHtmlTemplates.envoltorio("Título", EmailHtmlTemplates.parrafo("Cuerpo"));

        // THEN
        assertThat(html).doesNotContain("<img");
    }

    @Test
    @DisplayName("Las variables del envoltorio quedan sustituidas: ni rastro de {{...}}")
    void noDebeDezarVariablesSinSustituir() {
        // WHEN
        String html = EmailHtmlTemplates.envoltorio("Título", EmailHtmlTemplates.parrafo("Cuerpo"));

        // THEN
        assertThat(html).doesNotContain("{{");
    }

    @Test
    @DisplayName("Los valores interpolados se escapan (el seguimiento lo escribe una persona)")
    void debeEscaparValoresInterpolados() {
        // WHEN — un transportista malicioso teclea HTML en el panel
        String html = EmailHtmlTemplates.envoltorio("<script>alert(1)</script>",
                EmailHtmlTemplates.dato("Seguimiento", "<b>123</b>"));

        // THEN
        assertThat(html)
                .contains("&lt;script&gt;")
                .doesNotContain("<script>")
                .contains("&lt;b&gt;123&lt;/b&gt;");
    }
}
