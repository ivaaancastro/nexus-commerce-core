import { describe, it, expect, vi } from "vitest";
import { api } from "@/lib/api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("api.ts — Product Reviews (V4)", () => {
    it("getProductReviews llama al endpoint correcto", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            text: () => Promise.resolve(JSON.stringify({ averageRating: 5, totalReviews: 1, reviews: [] })),
        });

        const res = await api.getProductReviews(1);
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/products/1/reviews"), expect.any(Object));
        expect(res.totalReviews).toEqual(1);
    });

    it("createProductReview hace POST correctamente", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            text: () => Promise.resolve(JSON.stringify({ id: 10 })),
        });

        const res = await api.createProductReview(1, { rating: 5, title: "Genial" });
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/products/1/reviews"), expect.objectContaining({
            method: "POST",
        }));
        expect(res.id).toEqual(10);
    });

    it("deleteProductReview hace DELETE correctamente", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
            text: () => Promise.resolve(""),
        });

        await api.deleteProductReview(1, 10);
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/products/1/reviews/10"), expect.objectContaining({
            method: "DELETE",
        }));
    });

    it("adminDeleteProductReview hace DELETE correctamente", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
            text: () => Promise.resolve(""),
        });

        await api.adminDeleteProductReview(10);
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/admin/reviews/10"), expect.objectContaining({
            method: "DELETE",
        }));
    });

    it("getAdminReviews llama al endpoint correcto y parsea la página", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            text: () => Promise.resolve(JSON.stringify({
                reviews: [{ id: 1, productId: 1, productName: "Blazer", userEmail: "a@b.com", rating: 5, title: "t", comment: "c", createdAt: "2026-10-28T00:00:00Z" }],
                page: 0, size: 20, totalElements: 1, totalPages: 1,
            })),
        });

        const res = await api.getAdminReviews(0, 20);
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/admin/reviews"), expect.any(Object));
        expect(res.reviews).toHaveLength(1);
        expect(res.totalElements).toBe(1);
    });
});
