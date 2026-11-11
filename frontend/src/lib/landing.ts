/**
 * Contenido de la landing `/proyecto` (Fase 10, R9).
 *
 * <p>Vive en un solo módulo para que la página, el script de capturas
 * (`npm run shots`) y los tests lean la misma lista: si se añade una captura,
 * se añade aquí.</p>
 */

export const REPO_URL = "https://github.com/ivaaancastro/nexus-commerce-core";

/**
 * Swagger del backend desplegado. En la demo lo fija Vercel
 * (`NEXT_PUBLIC_API_DOCS_URL`); sin él, el backend local.
 */
export const API_DOCS_URL =
    process.env.NEXT_PUBLIC_API_DOCS_URL || "http://localhost:8080/swagger-ui.html";

/** Dimensiones declaradas de cada captura: reserva de espacio → CLS 0 (R10). */
export const SHOT_WIDTH = 1600;
export const SHOT_HEIGHT = 1000;

/** Ancho medido de la columna del tour: una por fila en móvil, dos desde `md`. */
export const SHOT_SIZES = "(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw";

export interface LandingShot {
    /** Fichero en `public/landing/` (lo genera `npm run shots`). */
    file: string;
    /** Ruta de la tienda que se captura. */
    route: string;
    /** ¿Necesita sesión? `user` = cliente demo · `admin` = administrador demo. */
    session: "none" | "user" | "admin";
    title: string;
    alt: string;
    caption: string;
}

export const LANDING_SHOTS: LandingShot[] = [
    {
        file: "catalogo.webp",
        route: "/catalog",
        session: "none",
        title: "Catálogo con filtros",
        alt: "Catálogo de la tienda con la columna de filtros por familia, talla y color",
        caption:
            "Filtrado en el servidor y precios del mercado activo: España, Reino Unido, Estados Unidos o Suiza, cada uno con su moneda e impuesto.",
    },
    {
        file: "ficha.webp",
        route: "/products/0432%2F021",
        session: "none",
        title: "Ficha de producto",
        alt: "Ficha de un blazer con galería vertical, selector de talla y botón de añadir a la bolsa",
        caption:
            "Stock disponible por almacén calculado en vivo, galería con visor ampliado y fotos por color.",
    },
    {
        file: "carrito.webp",
        route: "/cart",
        session: "user",
        title: "Bolsa y checkout",
        alt: "Bolsa con un artículo, dirección de envío y resumen con impuestos incluidos",
        caption:
            "El checkout reserva el stock con bloqueo pesimista y crea el pedido en una sola transacción, con clave de idempotencia.",
    },
    {
        file: "pago.webp",
        route: "/orders",
        session: "user",
        title: "Pedidos y pago con Stripe",
        alt: "Historial de pedidos del cliente con su estado y el estado del pago",
        caption:
            "El pago con tarjeta usa el Payment Element de Stripe; el pedido solo se confirma cuando llega el webhook firmado.",
    },
    {
        file: "admin-pedidos.webp",
        route: "/admin/orders",
        session: "admin",
        title: "Panel de pedidos",
        alt: "Panel de administración con la lista de pedidos filtrable por estado",
        caption:
            "Máquina de estados de pedido, seguimiento del envío y reembolsos parciales o totales contra Stripe.",
    },
    {
        file: "dashboard.webp",
        route: "/admin",
        session: "admin",
        title: "Dashboard",
        alt: "Dashboard con ingresos por moneda, pedidos por estado y métricas de usuarios",
        caption:
            "Agregados en SQL sin N+1: ingresos por moneda (sin sumar divisas), descontando impagados y reembolsos.",
    },
];

export interface HardPart {
    title: string;
    body: string;
}

export const HARD_PARTS: HardPart[] = [
    {
        title: "Concurrencia de stock",
        body: "La reserva bloquea la fila con PESSIMISTIC_WRITE y valida el disponible dentro de la misma transacción que crea el pedido: dos compras simultáneas de la última unidad nunca venden dos.",
    },
    {
        title: "Checkout idempotente",
        body: "Cada checkout lleva una cabecera Idempotency-Key respaldada por una restricción UNIQUE en la base de datos: reintentar tras un corte de red devuelve el mismo pedido, sin duplicar reservas ni cargos.",
    },
    {
        title: "Pagos con webhook firmado",
        body: "El webhook de Stripe es la fuente de verdad: se verifica la firma sobre el cuerpo crudo, cada evento se procesa una sola vez y los eventos fuera de orden no pueden deshacer un reembolso.",
    },
    {
        title: "Outbox de emails",
        body: "La intención de enviar un email se guarda en la misma transacción que el cambio de estado; un poller la envía con reintentos y backoff. Un fallo de SMTP nunca cambia el resultado del pedido.",
    },
];

export const DEMO_ACCOUNTS = [
    { role: "Cliente", email: "demo@nexus.dev", password: "Demo1234!" },
    { role: "Administrador", email: "admin@nexus.dev", password: "Admin1234!" },
] as const;

export const TEST_CARDS = [
    { label: "Pago correcto", number: "4242 4242 4242 4242" },
    { label: "Con verificación 3D Secure", number: "4000 0027 6000 3184" },
    { label: "Tarjeta rechazada", number: "4000 0000 0000 0002" },
] as const;
