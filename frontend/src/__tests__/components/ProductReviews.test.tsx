import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StarRating } from "@/components/StarRating";
import { ProductReviewsSection } from "@/components/ProductReviewsSection";
import { api } from "@/lib/api";

// Mock de la API
vi.mock("@/lib/api", () => ({
    api: {
        getProductReviews: vi.fn(),
        createProductReview: vi.fn(),
    },
}));

describe("StarRating", () => {
    it("renderiza el número correcto de estrellas", () => {
        render(<StarRating rating={3} />);
        const stars = screen.getAllByRole("button", { hidden: true });
        expect(stars).toHaveLength(5);
    });

    it("es interactivo cuando se indica", () => {
        const onRatingChange = vi.fn();
        render(<StarRating rating={0} interactive onRatingChange={onRatingChange} />);
        const stars = screen.getAllByRole("button");
        fireEvent.click(stars[3]); // Click en la 4ª estrella
        expect(onRatingChange).toHaveBeenCalledWith(4);
    });
});

describe("ProductReviewsSection", () => {
    const mockSummary = {
        averageRating: 4.0,
        totalReviews: 1,
        reviews: [
            {
                id: 1,
                productId: 1,
                userEmail: "test@user.com",
                rating: 4,
                title: "Muy bueno",
                comment: "Me gusta mucho",
                createdAt: new Date().toISOString(),
            },
        ],
    };

    it("carga y muestra las reseñas al montar", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (api.getProductReviews as any).mockResolvedValue(mockSummary);
        render(<ProductReviewsSection productId={1} />);

        expect(screen.getByText(/Cargando opiniones/i)).toBeDefined();

        await waitFor(() => {
            expect(screen.getByText("Muy bueno")).toBeDefined();
            expect(screen.getByText("(1 opinión)")).toBeDefined();
        });
    });

    it("permite abrir el formulario de reseña", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (api.getProductReviews as any).mockResolvedValue(mockSummary);
        render(<ProductReviewsSection productId={1} />);

        await waitFor(() => expect(screen.getByText("Escribir una opinión")).toBeDefined());

        fireEvent.click(screen.getByText("Escribir una opinión"));

        expect(screen.getByLabelText(/Título/i)).toBeDefined();
        expect(screen.getByText("Publicar opinión")).toBeDefined();
    });
});
