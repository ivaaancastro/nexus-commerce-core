package com.nexus.commerce.service;

/**
 * Plantilla HTML <strong>compartida por los tres tipos de email</strong> de
 * Nexus (V1 {@code order-status-emails}, R7): verificación, recuperación de
 * contraseña y notificaciones de pedido. Todos comparten el mismo envoltorio
 * para que el correo «vaya acorde con la webapp» (petición del usuario).
 *
 * <p><strong>Decisiones de diseño contra los clientes de correo</strong> (plan
 * D5, son restricciones reales, no preferencias):</p>
 * <ul>
 *   <li><strong>CSS inline en cada elemento</strong> — Gmail y otros clientes
 *       eliminan las etiquetas {@code <style>}; nada viaja en hoja externa.</li>
 *   <li><strong>Tipografía con pila de respaldo</strong> —
 *       {@code Geist} (la web) primero y {@code -apple-system, "Segoe UI",
 *       Helvetica, Arial} detrás: Outlook <em>no</em> carga webfonts y los
 *       clientes móviles caen a la del sistema.</li>
 *   <li><strong>Layout con tablas {@code role="presentation"}}</strong> — la
 *       única estructura fiable en Outlook; columna única (600 px máx.).</li>
 *   <li><strong>Cero imágenes</strong> — no hay logo en {@code public/}, así
 *       que la marca es el <em>wordmark</em> «NEXUS» en texto: imposible que
 *       se rompa o se bloquee el tracking.</li>
 * </ul>
 *
 * <p>La <strong>paleta</strong> es la de la web: fondo {@code #f5f5f5} con
 * tarjeta blanca, filetes {@code #e5e5e5} (neutral-200), texto {@code #171717}
 * (neutral-900), texto secundario {@code #525252} (neutral-600 — el 500 midió
 * 4,35:1 en la 4.3, insuficiente) y botón {@code neutral-900} con texto blanco
 * en mayúsculas, igual que los de la vitrina.</p>
 *
 * <p><strong>Las variables van como tokens {@code {{...}}}</strong>
 * sustituidos con {@code String.replace} (plan D5): simple, testeable y sin
 * añadir stack — nada de {@code String.format}, cuyo orden posicional de
 * {@code %s} y el escape {@code %%} son fuentes silenciosas de error.</p>
 *
 * <p>Los valores interpolados se escapan con {@link #escapar(String)} — sobre
 * todo campos que escribe una persona (transportista, seguimiento).</p>
 */
public final class EmailHtmlTemplates {

    /** Pila tipográfica: Geist (la web) + respaldos por si el cliente no la tiene. */
    private static final String FUENTE =
            "Geist, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

    /** Ancho de la tarjeta: columna única, como la web. */
    private static final String ANCHO_TARJETA = "600";

    private EmailHtmlTemplates() {
    }

    /**
     * Composición completa de un email: asunto + HTML + texto plano de
     * respaldo (multipart/alternative, plan D6).
     */
    public record Mensaje(String asunto, String html, String texto) {
    }

    /**
     * Envoltorio compartido (R7): wordmark «NEXUS», título en mayúsculas con
     * tracking, filete, cuerpo y pie. El CSS va inline, todo en tabla.
     */
    public static String envoltorio(String titulo, String cuerpoHtml) {
        return """
                <!DOCTYPE html>
                <html lang="es">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>{{TITULO}}</title>
                </head>
                <body style="margin:0; padding:0; background-color:#f5f5f5; font-family:{{FUENTE}}; -webkit-text-size-adjust:100%;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background-color:#f5f5f5; margin:0; padding:0; border-collapse:collapse;">
                    <tr>
                      <td align="center" style="padding:40px 16px;">
                        <table role="presentation" width="{{ANCHO}}" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:{{ANCHO}}px; background-color:#ffffff; border:1px solid #e5e5e5; border-collapse:collapse;">
                          <tr>
                            <td style="padding:32px 40px 0; text-align:center;">
                              <span style="display:inline-block; font-family:{{FUENTE}}; font-size:13px; font-weight:500; letter-spacing:0.25em; text-transform:uppercase; color:#171717;">NEXUS</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:24px 40px 0; font-size:0; line-height:0;">
                              <div style="border-top:1px solid #e5e5e5;"></div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:32px 40px; font-family:{{FUENTE}}; color:#171717;">
                              <p style="margin:0 0 24px; font-family:{{FUENTE}}; font-size:15px; font-weight:500; letter-spacing:0.1em; line-height:1.4; text-transform:uppercase; color:#171717;">{{TITULO}}</p>
                {{CUERPO}}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:0 40px; font-size:0; line-height:0;">
                              <div style="border-top:1px solid #e5e5e5;"></div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:24px 40px 32px; text-align:center; font-family:{{FUENTE}}; font-size:11px; font-weight:300; letter-spacing:0.05em; line-height:1.8; color:#525252;">
                              Nexus Core — comercio editorial<br>
                              Recibes este correo por tu actividad en Nexus.
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """
                .replace("{{FUENTE}}", FUENTE)
                .replace("{{ANCHO}}", ANCHO_TARJETA)
                .replace("{{TITULO}}", escapar(titulo))
                // El cuerpo va el ÚLTIMO: trae HTML de otros helpers que puede
                // contener literales «{{...}}» (un campo escrito por una
                // persona) y esos no deben sustituirse.
                .replace("{{CUERPO}}", indentar(cuerpoHtml));
    }

    /** Párrafo del cuerpo: peso 300 (font-light de la web), interlineado generoso. */
    public static String parrafo(String texto) {
        return "                              <p style=\"margin:0 0 16px; font-family:" + FUENTE +
                "; font-size:14px; font-weight:300; line-height:1.75; color:#171717;\">" +
                escapar(texto) + "</p>";
    }

    /**
     * Dato destacado en dos líneas (etiqueta pequeña en mayúsculas gris +
     * valor en negro) — el equivalente del «dato» editorial de la web.
     */
    public static String dato(String etiqueta, String valor) {
        return "                              <p style=\"margin:24px 0 4px; font-family:" + FUENTE +
                "; font-size:11px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:#525252;\">"
                + escapar(etiqueta) + "</p>\n" +
                "                              <p style=\"margin:0; font-family:" + FUENTE +
                "; font-size:15px; font-weight:500; line-height:1.5; color:#171717;\">" +
                escapar(valor) + "</p>";
    }

    /** Botón principal: fondo neutral-900, texto blanco en mayúsculas (estilo vitrina). */
    public static String boton(String href, String texto) {
        return """
                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px; border-collapse:collapse;">
                                      <tr>
                                        <td align="center" bgcolor="#171717" style="background-color:#171717;">
                                          <a href="{{ENLACE}}" style="display:inline-block; padding:14px 32px; font-family:{{FUENTE}}; font-size:11px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:#ffffff; text-decoration:none; border:1px solid #171717;">{{TEXTO}}</a>
                                        </td>
                                      </tr>
                                    </table>"""
                .replace("{{FUENTE}}", FUENTE)
                .replace("{{TEXTO}}", escapar(texto))
                // El enlace el último: es el valor más «externo» (lleva el
                // número de pedido dentro de la URL).
                .replace("{{ENLACE}}", escapar(href));
    }

    /** Caja del código (verificación/recuperación): cifra grande, tracked, sobre filete. */
    public static String codigo(String valor) {
        return """
                                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px; border-collapse:collapse;">
                                        <tr>
                                          <td style="border:1px solid #e5e5e5; padding:18px 36px; font-family:{{FUENTE}}; font-size:24px; font-weight:500; letter-spacing:0.3em; text-align:center; color:#171717;">{{VALOR}}</td>
                                        </tr>
                                      </table>"""
                .replace("{{FUENTE}}", FUENTE)
                .replace("{{VALOR}}", escapar(valor));
    }

    /** Escapado mínimo de HTML para valores interpolados (algunos los escribe una persona). */
    public static String escapar(String valor) {
        if (valor == null) {
            return "";
        }
        return valor
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    /** Da sangría al cuerpo insertado para que el HTML generado sea legible en logs y previews. */
    private static String indentar(String cuerpoHtml) {
        return cuerpoHtml == null ? "" : cuerpoHtml.replace("\n", "\n                ");
    }
}
