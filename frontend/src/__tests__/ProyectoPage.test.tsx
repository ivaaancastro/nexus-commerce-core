import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { existsMock } = vi.hoisted(() => ({ existsMock: vi.fn() }));
vi.mock("@/lib/landing-files", () => ({ landingShotExists: existsMock }));

import ProyectoPage, { metadata } from "@/app/proyecto/page";
import { DEMO_ACCOUNTS, HARD_PARTS, LANDING_SHOTS, REPO_URL, TEST_CARDS } from "@/lib/landing";

describe("Fase 10 · landing /proyecto (R9, R10, R14)", () => {
    beforeEach(() => {
        existsMock.mockReset();
        existsMock.mockReturnValue(true);
    });

    it("R9 — hero con un único h1 y los CTA a la demo y al código", () => {
        render(<ProyectoPage />);

        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nexus Commerce Core");
        expect(screen.getByRole("link", { name: "Probar la demo" })).toHaveAttribute("href", "/");
        expect(screen.getByRole("link", { name: "Ver el código" })).toHaveAttribute("href", REPO_URL);
    });

    it("R9 — «Qué lo hace difícil» con los 4 bloques", () => {
        render(<ProyectoPage />);

        const seccion = screen.getByRole("heading", { level: 2, name: "Qué lo hace difícil" }).closest("section")!;
        expect(HARD_PARTS).toHaveLength(4);
        for (const part of HARD_PARTS) {
            expect(within(seccion).getByRole("heading", { level: 3, name: part.title })).toBeInTheDocument();
        }
    });

    it("R9 — «Pruébalo» enseña las cuentas demo, las tarjetas y el aviso del despertar", () => {
        render(<ProyectoPage />);

        const seccion = screen.getByRole("heading", { level: 2, name: "Pruébalo" }).closest("section")!;
        for (const a of DEMO_ACCOUNTS) expect(seccion).toHaveTextContent(`${a.email} · ${a.password}`);
        for (const c of TEST_CARDS) expect(seccion).toHaveTextContent(c.number);
        expect(seccion).toHaveTextContent(/hasta un minuto en despertar/);
    });

    it("R10 — las 6 capturas existentes se pintan con alt, dimensiones y sizes (CLS 0)", () => {
        render(<ProyectoPage />);

        expect(LANDING_SHOTS).toHaveLength(6);
        for (const shot of LANDING_SHOTS) {
            const img = screen.getByAltText(shot.alt);
            expect(img).toHaveAttribute("width", "1600");
            expect(img).toHaveAttribute("height", "1000");
            expect(img).toHaveAttribute("sizes");
        }
        expect(screen.queryAllByTestId("landing-shot-fallback")).toHaveLength(0);
    });

    it("R10 — una captura que falta cae a un recuadro neutro, sin <img> (cero 404)", () => {
        existsMock.mockImplementation((file: string) => file !== LANDING_SHOTS[0].file);
        render(<ProyectoPage />);

        expect(screen.queryByAltText(LANDING_SHOTS[0].alt)).not.toBeInTheDocument();
        const fallback = screen.getByTestId("landing-shot-fallback");
        expect(fallback).toHaveTextContent(LANDING_SHOTS[0].title);
        expect(fallback).toHaveAttribute("aria-hidden", "true");
        // El título y el pie siguen visibles: no se pierde información.
        expect(screen.getByRole("heading", { level: 3, name: LANDING_SHOTS[0].title })).toBeInTheDocument();
    });

    it("R14 — metadatos con Open Graph e imagen para la tarjeta de LinkedIn", () => {
        expect(metadata.title).toMatch(/Nexus Commerce Core/);
        expect(metadata.description).toBeTruthy();
        const og = metadata.openGraph as { images: { url: string; width: number; height: number }[] };
        expect(og.images[0]).toMatchObject({ url: "/landing/og.png", width: 1200, height: 630 });
        expect(metadata.metadataBase).toBeInstanceOf(URL);
    });
});
