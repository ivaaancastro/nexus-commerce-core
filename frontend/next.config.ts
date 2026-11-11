import type { NextConfig } from "next";

// Fase 10 (R1 · D2): destino del proxy parametrizado. Sin `BACKEND_URL` es el
// backend local de siempre, así que dev, CI y E2E no cambian. En Vercel apunta
// al backend de Render; el navegador sigue hablando SOLO con el origen del
// frontend (ADR-0004: sin CORS ni cookies cross-site).
const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:8080").replace(/\/+$/, "");

const nextConfig: NextConfig = {
    // R6: acota la canalización de optimización a las imágenes del catálogo
    // y (Fase 10, R10) a las capturas de la landing `/proyecto`.
    // Cualquier otra ruta local se rechaza con 400 en vez de optimizarse.
    images: {
        localPatterns: [
            {
                pathname: "/products/**",
                search: "",
            },
            {
                pathname: "/landing/**",
                search: "",
            },
        ],
    },
    async rewrites() {
        return [
            {
                source: "/api/v1/:path*",
                destination: `${BACKEND_URL}/api/v1/:path*`,
            },
        ];
    },
};

export default nextConfig;
