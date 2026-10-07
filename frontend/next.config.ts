import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // R6: acota la canalización de optimización a las imágenes del catálogo.
    // Cualquier otra ruta local se rechaza con 400 en vez de optimizarse.
    images: {
        localPatterns: [
            {
                pathname: "/products/**",
                search: "",
            },
        ],
    },
    async rewrites() {
        return [
            {
                source: "/api/v1/:path*",
                destination: "http://localhost:8080/api/v1/:path*",
            },
        ];
    },
};

export default nextConfig;