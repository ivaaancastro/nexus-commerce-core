import { cn } from "@/lib/utils";

interface SkeletonProps {
    className?: string;
}

/**
 * Componente base de Skeleton con animación de pulso sutil.
 * Evita layout shifts (CLS) mientras se cargan datos asíncronos.
 */
export default function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse bg-neutral-200 rounded-sm",
                className
            )}
            aria-hidden="true"
        />
    );
}
