"use client";

import React, { useEffect, useState } from "react";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { AdminProductReview } from "@/types/commerce";
import { StarRating } from "@/components/StarRating";
import { getFriendlyErrorMessage } from "@/lib/errors";

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState<AdminProductReview[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const cargando = reviews === null && error === null;

    useEffect(() => {
        let activo = true;
        api.getAdminReviews(0, 50)
            .then((pagina) => {
                if (activo) setReviews(pagina.reviews);
            })
            .catch((err: unknown) => {
                if (activo) {
                    setError(getFriendlyErrorMessage(err));
                    setReviews([]);
                }
            });
        return () => {
            activo = false;
        };
    }, []);

    const handleDelete = async (reviewId: number) => {
        if (!window.confirm("¿Estás seguro de que quieres borrar esta reseña?")) return;

        try {
            await api.adminDeleteProductReview(reviewId);
            setReviews((prev) => (prev ?? []).filter((r) => r.id !== reviewId));
        } catch (err) {
            alert(getFriendlyErrorMessage(err));
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col">
            <Header />
            <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-xl font-medium uppercase tracking-widest text-neutral-900">
                        Moderación de reseñas
                    </h1>
                </div>

                <div className="bg-white border border-neutral-200">
                    <div className="p-6 border-b border-neutral-200">
                        <p className="text-sm text-neutral-600 font-light">
                            Desde aquí puedes eliminar reseñas que incumplan las normas de la comunidad.
                        </p>
                    </div>

                    {cargando ? (
                        <div className="p-12 text-center">
                            <p className="text-xs uppercase tracking-widest text-neutral-500">
                                Cargando reseñas...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center">
                            <p className="text-xs uppercase tracking-widest text-red-600">{error}</p>
                        </div>
                    ) : (reviews ?? []).length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-xs uppercase tracking-widest text-neutral-500">
                                No hay reseñas para moderar.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-neutral-200">
                            {(reviews ?? []).map((review) => (
                                <div key={review.id} className="p-6 flex flex-col md:flex-row justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <StarRating rating={review.rating} size="sm" />
                                            <span className="text-xs font-medium text-neutral-900">{review.userEmail}</span>
                                            <span className="text-xs text-neutral-400">
                                                {new Date(review.createdAt).toLocaleDateString()}
                                            </span>
                                            <span className="text-xs text-neutral-400">
                                                · {review.productName}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-medium text-neutral-900 mb-1">{review.title}</h4>
                                        <p className="text-sm font-light text-neutral-600">{review.comment}</p>
                                    </div>
                                    <button
                                        onClick={() => void handleDelete(review.id)}
                                        className="text-[10px] uppercase tracking-widest text-red-600 hover:text-red-800 font-medium self-start md:self-center"
                                    >
                                        Borrar reseña
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}