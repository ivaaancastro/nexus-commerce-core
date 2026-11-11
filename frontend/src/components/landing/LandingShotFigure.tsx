import Image from "next/image";
import { landingShotExists } from "@/lib/landing-files";
import { SHOT_HEIGHT, SHOT_SIZES, SHOT_WIDTH, type LandingShot } from "@/lib/landing";

/**
 * Una captura del tour de `/proyecto` (Fase 10, R10).
 *
 * <p>Componente de servidor: comprueba en el render (en el build, porque la
 * página es estática) si el fichero existe en `public/landing/`. Si falta, se
 * pinta un recuadro neutro con el título — **cero 404**, mismo contrato que
 * `ProductImage` con su manifiesto. Las dimensiones declaradas reservan el
 * espacio: CLS 0.</p>
 */
export default function LandingShotFigure({ shot }: { shot: LandingShot }) {
    const exists = landingShotExists(shot.file);

    return (
        <figure className="flex flex-col gap-3">
            {exists ? (
                <Image
                    src={`/landing/${shot.file}`}
                    alt={shot.alt}
                    width={SHOT_WIDTH}
                    height={SHOT_HEIGHT}
                    sizes={SHOT_SIZES}
                    className="w-full h-auto border border-neutral-200 bg-white"
                />
            ) : (
                <div
                    className="w-full aspect-[16/10] border border-neutral-200 bg-neutral-100 flex items-center justify-center"
                    data-testid="landing-shot-fallback"
                    aria-hidden="true"
                >
                    <span className="text-xs uppercase tracking-widest text-neutral-600">{shot.title}</span>
                </div>
            )}
            <figcaption>
                <h3 className="text-sm font-medium uppercase tracking-widest text-neutral-900">{shot.title}</h3>
                <p className="mt-1 text-sm font-light text-neutral-600 leading-relaxed">{shot.caption}</p>
            </figcaption>
        </figure>
    );
}
