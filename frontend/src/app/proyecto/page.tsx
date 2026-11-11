import type { Metadata } from "next";
import Link from "next/link";
import LandingShotFigure from "@/components/landing/LandingShotFigure";
import {
    API_DOCS_URL,
    DEMO_ACCOUNTS,
    HARD_PARTS,
    LANDING_SHOTS,
    REPO_URL,
    TEST_CARDS,
} from "@/lib/landing";

const TITLE = "Nexus Commerce Core — ecommerce multimercado de extremo a extremo";
const DESCRIPTION =
    "Proyecto de portfolio: Spring Boot 3 + Java 21, PostgreSQL con pgvector y Next.js. Stock concurrente, checkout idempotente, pagos con Stripe y panel de administración. Pruébalo en vivo.";

/**
 * Metadatos de la landing (Fase 10, R14): título, descripción y Open Graph
 * para la tarjeta de LinkedIn. `og:image` necesita URL absoluta: la base la da
 * `NEXT_PUBLIC_SITE_URL` en Vercel. **Ninguna analítica.**
 */
export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: TITLE,
    description: DESCRIPTION,
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        type: "website",
        locale: "es_ES",
        url: "/proyecto",
        images: [{ url: "/landing/og.png", width: 1200, height: 630, alt: "Nexus Commerce Core" }],
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const STACK = ["Java 21", "Spring Boot 3.4", "PostgreSQL 16 + pgvector", "Next.js 16", "TypeScript", "Stripe", "Playwright"];

const FIGURES = [
    { value: "550+", label: "tests de backend, con PostgreSQL real" },
    { value: "600+", label: "tests de frontend" },
    { value: "3", label: "navegadores en los E2E" },
    { value: "4", label: "mercados y monedas" },
];

const sectionTitle = "text-lg font-medium uppercase tracking-widest text-neutral-900";
const linkButton =
    "inline-block px-6 py-3 text-xs uppercase tracking-wide transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

/**
 * Landing del proyecto `/proyecto` (Fase 10, R9 · D4 · D9).
 *
 * <p>La tienda (`/`) no se toca: el enlace de LinkedIn apunta aquí. Página de
 * servidor y estática — sin `fetch`, así que no depende de que el backend de
 * la demo esté despierto. Estilo editorial del resto (§6.4).</p>
 */
export default function ProyectoPage() {
    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <header className="border-b border-neutral-200 bg-white">
                <nav
                    aria-label="Proyecto"
                    className="max-w-6xl mx-auto px-6 min-h-16 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2"
                >
                    <Link href="/" className="text-xl font-semibold tracking-widest uppercase text-neutral-900">
                        Nexus Core
                    </Link>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs uppercase tracking-wider font-medium text-neutral-600">
                        <a href="#dificil" className="hover:text-black transition-colors">Qué lo hace difícil</a>
                        <a href="#tour" className="hover:text-black transition-colors">Tour</a>
                        <a href="#pruebalo" className="hover:text-black transition-colors">Pruébalo</a>
                        <a href={REPO_URL} className="hover:text-black transition-colors">GitHub</a>
                    </div>
                </nav>
            </header>

            <main className="flex-1 w-full">
                {/* Hero */}
                <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
                    <p className="text-xs uppercase tracking-widest text-neutral-600">Proyecto de portfolio · 2026</p>
                    <h1 className="mt-4 text-3xl md:text-5xl font-medium uppercase tracking-widest text-neutral-900 leading-tight">
                        Nexus Commerce Core
                    </h1>
                    <p className="mt-6 max-w-2xl text-base md:text-lg font-light text-neutral-700 leading-relaxed">
                        Un ecommerce multimercado completo, del almacén al reembolso: catálogo con búsqueda
                        semántica, stock concurrente, checkout idempotente, pagos reales con Stripe en modo
                        de pruebas y un panel de administración. Hecho con especificaciones antes que código.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-4">
                        <Link href="/" className={`${linkButton} bg-neutral-900 text-white hover:bg-black`}>
                            Probar la demo
                        </Link>
                        <a
                            href={REPO_URL}
                            className={`${linkButton} border border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white`}
                        >
                            Ver el código
                        </a>
                    </div>
                    <ul aria-label="Tecnologías" className="mt-10 flex flex-wrap gap-2">
                        {STACK.map((item) => (
                            <li
                                key={item}
                                className="border border-neutral-200 bg-white px-3 py-1 text-[11px] uppercase tracking-wider text-neutral-700"
                            >
                                {item}
                            </li>
                        ))}
                    </ul>
                    <dl className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-neutral-200 pt-8">
                        {FIGURES.map((f) => (
                            <div key={f.label}>
                                <dt className="sr-only">{f.label}</dt>
                                <dd>
                                    <span className="block text-2xl font-medium text-neutral-900">{f.value}</span>
                                    <span className="block mt-1 text-xs uppercase tracking-wide text-neutral-600">
                                        {f.label}
                                    </span>
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>

                {/* Qué lo hace difícil */}
                <section id="dificil" className="bg-white border-y border-neutral-200">
                    <div className="max-w-6xl mx-auto px-6 py-16">
                        <h2 className={sectionTitle}>Qué lo hace difícil</h2>
                        <p className="mt-3 max-w-2xl text-sm font-light text-neutral-600 leading-relaxed">
                            Lo interesante de un ecommerce no es pintar productos, sino lo que pasa cuando dos
                            personas compran la última unidad a la vez o la red se corta en mitad de un pago.
                        </p>
                        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {HARD_PARTS.map((part) => (
                                <article key={part.title} className="border border-neutral-200 p-6">
                                    <h3 className="text-sm font-medium uppercase tracking-widest text-neutral-900">
                                        {part.title}
                                    </h3>
                                    <p className="mt-3 text-sm font-light text-neutral-700 leading-relaxed">{part.body}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Tour */}
                <section id="tour" className="max-w-6xl mx-auto px-6 py-16">
                    <h2 className={sectionTitle}>Tour</h2>
                    <p className="mt-3 max-w-2xl text-sm font-light text-neutral-600 leading-relaxed">
                        Capturas reales de la aplicación, generadas con un script de Playwright reproducible.
                    </p>
                    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                        {LANDING_SHOTS.map((shot) => (
                            <LandingShotFigure key={shot.file} shot={shot} />
                        ))}
                    </div>
                </section>

                {/* Pruébalo */}
                <section id="pruebalo" className="bg-white border-y border-neutral-200">
                    <div className="max-w-6xl mx-auto px-6 py-16">
                        <h2 className={sectionTitle}>Pruébalo</h2>
                        <p className="mt-3 max-w-2xl text-sm font-light text-neutral-600 leading-relaxed">
                            La demo es pública y sus datos son de prueba. Stripe está en modo de pruebas: ningún
                            cargo es real. Algunas acciones destructivas del panel están desactivadas para que la
                            demo siga en pie para el siguiente visitante.
                        </p>

                        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="border border-neutral-200 p-6">
                                <h3 className="text-sm font-medium uppercase tracking-widest text-neutral-900">
                                    Cuentas de la demo
                                </h3>
                                <dl className="mt-4 space-y-4 text-sm">
                                    {DEMO_ACCOUNTS.map((a) => (
                                        <div key={a.email}>
                                            <dt className="text-xs uppercase tracking-wide text-neutral-600">{a.role}</dt>
                                            <dd className="mt-1 font-mono text-neutral-900">
                                                {a.email} · {a.password}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                            <div className="border border-neutral-200 p-6">
                                <h3 className="text-sm font-medium uppercase tracking-widest text-neutral-900">
                                    Tarjetas de prueba
                                </h3>
                                <dl className="mt-4 space-y-4 text-sm">
                                    {TEST_CARDS.map((c) => (
                                        <div key={c.number}>
                                            <dt className="text-xs uppercase tracking-wide text-neutral-600">{c.label}</dt>
                                            <dd className="mt-1 font-mono text-neutral-900">{c.number}</dd>
                                        </div>
                                    ))}
                                </dl>
                                <p className="mt-4 text-xs font-light text-neutral-600">
                                    Cualquier fecha futura y cualquier CVC.
                                </p>
                            </div>
                        </div>

                        <p className="mt-8 border-l-2 border-neutral-900 pl-4 text-sm font-light text-neutral-700 leading-relaxed">
                            La demo corre en planes gratuitos: si nadie la ha usado en un rato, el backend tarda
                            hasta un minuto en despertar la primera vez. Después va fluida.
                        </p>
                    </div>
                </section>

                {/* Cómo se construyó */}
                <section className="max-w-6xl mx-auto px-6 py-16">
                    <h2 className={sectionTitle}>Cómo se construyó</h2>
                    <p className="mt-3 max-w-2xl text-sm font-light text-neutral-600 leading-relaxed">
                        Cada funcionalidad empezó como una especificación aprobada (plan, requisitos y tareas)
                        antes de escribir una línea de código, y cada decisión de arquitectura quedó registrada
                        en un ADR. Los umbrales de cobertura, accesibilidad y Core Web Vitals se miden y se
                        congelan en CI.
                    </p>
                    <ul className="mt-8 flex flex-wrap gap-4 text-xs uppercase tracking-wide">
                        <li>
                            <a href={`${REPO_URL}#readme`} className="underline underline-offset-4 text-neutral-900 hover:text-black">
                                README
                            </a>
                        </li>
                        <li>
                            <a href={`${REPO_URL}/tree/main/docs/adr`} className="underline underline-offset-4 text-neutral-900 hover:text-black">
                                Decisiones de arquitectura (ADR)
                            </a>
                        </li>
                        <li>
                            <a href={`${REPO_URL}/tree/main/specs`} className="underline underline-offset-4 text-neutral-900 hover:text-black">
                                Especificaciones
                            </a>
                        </li>
                        <li>
                            <a href={API_DOCS_URL} className="underline underline-offset-4 text-neutral-900 hover:text-black">
                                API (Swagger)
                            </a>
                        </li>
                    </ul>
                </section>
            </main>

            <footer className="border-t border-neutral-200 bg-white">
                <div className="max-w-6xl mx-auto px-6 py-6 text-xs uppercase tracking-wide text-neutral-600">
                    Nexus Commerce Core · Proyecto de portfolio · Sin cookies de seguimiento ni analítica
                </div>
            </footer>
        </div>
    );
}
