"tsx"
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ReviewSummaryResponse } from "@/types/commerce";
import { StarRating } from "./StarRating";
import { getFriendlyErrorMessage } from "@/lib/errors";

interface ProductReviewsSectionProps {
    productId: number;
}

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({ productId }) => {
    const [summary, setSummary] = useState<ReviewSummaryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [rating, setRating] = useState(5);
    const [title, setTitle] = useState("");
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function loadReviews() {
            try {
                setLoading(true);
                const data = await api.getProductReviews(productId);
                if (!cancelled) setSummary(data);
            } catch (err) {
                console.error("Error loading reviews", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadReviews();
        return () => { cancelled = true; };
    }, [productId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setSuccessMsg(null);
        setSubmitting(true);

        try {
            await api.createProductReview(productId, { rating, title, comment });
            setSuccessMsg("¡Gracias por tu opinión!");
            setTitle("");
            setComment("");
            setRating(5);
            setShowForm(false);
            // Refresh reviews directly
            const data = await api.getProductReviews(productId);
            setSummary(data);
        } catch (err) {
            setFormError(getFriendlyErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="py-8 text-xs text-neutral-500 uppercase tracking-widest">Cargando opiniones…</div>;
    }

    return (
        <section className="mt-16 border-t border-neutral-200 pt-12" data-testid="product-reviews-section">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-900 mb-2">
                        Opiniones de clientes
                    </h2>
                    <div className="flex items-center gap-3">
                        <StarRating rating={summary?.averageRating || 0} size="md" />
                        <span className="text-sm font-medium text-neutral-900">
                            {summary?.averageRating ? summary.averageRating.toFixed(1) : "0.0"} / 5.0
                        </span>
                        <span className="text-xs text-neutral-500 uppercase tracking-wider">
                            ({summary?.totalReviews || 0} {summary?.totalReviews === 1 ? "opinión" : "opiniones"})
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => setShowForm(!showForm)}
                    className="px-6 py-3 bg-neutral-900 text-white text-xs uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors"
                >
                    {showForm ? "Cancelar" : "Escribir una opinión"}
                </button>
            </div>

            {successMsg && (
                <div className="mb-6 p-4 bg-neutral-100 border border-neutral-300 text-xs uppercase tracking-widest text-neutral-900">
                    {successMsg}
                </div>
            )}

            {showForm && (
                <form onSubmit={handleSubmit} className="mb-12 p-6 bg-neutral-50 border border-neutral-200 max-w-2xl">
                    <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-900 mb-4">
                        Comparte tu experiencia con este producto
                    </h3>

                    <div className="mb-4">
                        <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-2">
                            Puntuación
                        </label>
                        <StarRating rating={rating} size="lg" interactive onRatingChange={setRating} />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="review-title-input" className="block text-xs uppercase tracking-widest text-neutral-600 mb-2">
                            Título
                        </label>
                        <input
                            id="review-title-input"
                            type="text"
                            required
                            maxLength={100}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 text-neutral-900 text-sm focus:outline-none focus:border-neutral-900"
                            placeholder="Ej: Excelente calidad"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-2">
                            Comentario (opcional)
                        </label>
                        <textarea
                            rows={4}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 text-neutral-900 text-sm focus:outline-none focus:border-neutral-900"
                            placeholder="Cuéntanos qué te ha parecido..."
                        />
                    </div>

                    {formError && (
                        <div className="mb-4 text-xs text-red-600 uppercase tracking-wider">{formError}</div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-3 bg-neutral-900 text-white text-xs uppercase tracking-widest font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                    >
                        {submitting ? "Enviando..." : "Publicar opinión"}
                    </button>
                </form>
            )}

            {summary?.reviews.length === 0 ? (
                <p className="text-xs text-neutral-500 uppercase tracking-widest">
                    Aún no hay opiniones para este producto. ¡Sé el primero en opinar!
                </p>
            ) : (
                <div className="space-y-6 divide-y divide-neutral-200">
                    {summary?.reviews.map((review) => (
                        <div key={review.id} className="pt-6 first:pt-0">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-neutral-900">{review.userEmail}</span>
                                <span className="text-xs text-neutral-400">
                                    {new Date(review.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="mb-2">
                                <StarRating rating={review.rating} size="sm" />
                            </div>
                            <h4 className="text-xs font-medium uppercase tracking-wider text-neutral-900 mb-1">
                                {review.title}
                            </h4>
                            {review.comment && (
                                <p className="text-sm font-light text-neutral-700 leading-relaxed">
                                    {review.comment}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};
