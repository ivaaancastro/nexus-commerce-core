"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Product } from "@/types/commerce";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import BackLink from "@/components/BackLink";
import AdminProductForm from "@/components/AdminProductForm";
import AdminSkuSection from "@/components/AdminSkuSection";
import ProductImage from "@/components/ProductImage";
import Toast from "@/components/Toast";
import { getProductImages, imageAlt } from "@/lib/product-images";

/**
 * Edición de producto: datos, galería y SKUs (Tarea 7.2, E.5/E.6).
 *
 * - Los datos van en `AdminProductForm` (referencia deshabilitada, R2.4).
 * - La galería es **sólo lectura** (D5): lee el manifiesto estático y, si la
 *   referencia no está en él, `ProductImage` cae al placeholder — cero 404.
 * - Borrar con pedidos responde 409 y el mensaje llega ya amigable.
 */
export default function EdicionProductoPage() {
    const params = useParams();
    const router = useRouter();
    const id = Number(params?.id);
    const idInvalido = !Number.isFinite(id);

    const [producto, setProducto] = useState<Product | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);
    // Cada mutación (SKU o borrado) sube la versión y el efecto recarga: la
    // cadena va inline en el efecto, el patrón aceptado por
    // react-hooks/set-state-in-effect (los setState viven en callbacks de promesa).
    const [version, setVersion] = useState(0);

    useEffect(() => {
        if (idInvalido) {
            return;
        }
        let activo = true;
        api.getAdminProduct(id)
            .then((obtenido) => {
                if (activo) {
                    setProducto(obtenido);
                    setError(null);
                }
            })
            .catch((err: unknown) => {
                if (activo) setError(getFriendlyErrorMessage(err));
            })
            .finally(() => {
                if (activo) setCargando(false);
            });
        return () => {
            activo = false;
        };
    }, [id, idInvalido, version]);

    function mostrarMensaje(mensaje: string) {
        setToastMessage(mensaje);
        setToastVisible(true);
    }

    async function borrarProducto() {
        if (!producto) return;
        const seguro = window.confirm(
            `¿Borrar el producto ${producto.referenceCode}? Se eliminan también sus SKUs, ` +
                "precios y stock. Esta acción no se puede deshacer."
        );
        if (!seguro) return;

        setError(null);
        try {
            await api.deleteAdminProduct(producto.id);
            router.push("/admin/products");
        } catch (err: unknown) {
            // 409 con pedidos: «…tiene pedidos asociados», sin volcado técnico.
            setError(getFriendlyErrorMessage(err));
        }
    }

    const imagenes = producto ? getProductImages(producto.referenceCode) : [];

    return (
        <>
            <BackLink href="/admin/products" label="Volver a productos" />

            {error && (
                <div role="alert" className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs">
                    {error}
                </div>
            )}

            {idInvalido && (
                <div className="border border-neutral-200 bg-white p-6">
                    <p className="text-sm font-light text-neutral-700">
                        Identificador de producto no válido.
                    </p>
                </div>
            )}

            {!idInvalido && cargando && (
                <p
                    role="status"
                    className="text-xs uppercase tracking-widest text-neutral-500 py-12 text-center"
                >
                    Cargando producto...
                </p>
            )}

            {!idInvalido && !cargando && !producto && !error && (
                <div className="border border-neutral-200 bg-white p-6">
                    <p className="text-sm font-light text-neutral-700">
                        No encontramos este producto. Puede que se haya borrado.
                    </p>
                </div>
            )}

            {!idInvalido && producto && (
                <>
                    <div className="flex flex-col gap-2">
                        <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                            Editar · {producto.referenceCode}
                        </p>
                        <h1 className="text-2xl font-medium uppercase tracking-widest">
                            {producto.name}
                        </h1>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[2fr_1fr] items-start">
                        <section className="border border-neutral-200 bg-white p-6">
                            <AdminProductForm
                                key={producto.id}
                                producto={producto}
                                onProductoGuardado={setProducto}
                            />
                        </section>

                        <section className="border border-neutral-200 bg-white p-6 flex flex-col gap-3">
                            <p className="text-[11px] uppercase tracking-wider text-neutral-500">
                                Imágenes
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                {imagenes.length > 0 ? (
                                    imagenes.map((src, index) => (
                                        <ProductImage
                                            key={src}
                                            src={src}
                                            alt={imageAlt(producto.name, index)}
                                            sizes="(max-width: 1024px) 33vw, 160px"
                                            name={producto.name}
                                            family={producto.family}
                                            eager={index === 0}
                                        />
                                    ))
                                ) : (
                                    <ProductImage
                                        src={undefined}
                                        alt=""
                                        sizes="160px"
                                        name={producto.name}
                                        family={producto.family}
                                        eager
                                    />
                                )}
                            </div>
                            <p className="text-xs font-light text-neutral-600">
                                Sólo lectura: para añadir imágenes, suelta los ficheros en{" "}
                                <code className="text-neutral-900">frontend/public/products/</code>{" "}
                                y ejecuta <code className="text-neutral-900">npm run images</code>.
                            </p>
                        </section>
                    </div>

                    <AdminSkuSection
                        producto={producto}
                        onCambiado={() => setVersion((v) => v + 1)}
                        onMensaje={mostrarMensaje}
                    />

                    <section className="border border-red-200 bg-white p-6 flex flex-col gap-3">
                        <p className="text-xs uppercase tracking-widest text-red-700">
                            Zona peligrosa
                        </p>
                        <p className="text-sm font-light text-neutral-700">
                            El borrado es definitivo. Si algún SKU tiene pedidos, el
                            backend lo rechaza y no se borra nada.
                        </p>
                        <button
                            type="button"
                            onClick={borrarProducto}
                            className="self-start border border-red-300 text-red-700 hover:bg-red-50 text-xs uppercase tracking-widest px-6 py-3 transition-colors"
                        >
                            Borrar producto
                        </button>
                    </section>
                </>
            )}

            <Toast
                message={toastMessage}
                isVisible={toastVisible}
                onClose={() => setToastVisible(false)}
            />
        </>
    );
}
