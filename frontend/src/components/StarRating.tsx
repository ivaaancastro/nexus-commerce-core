import React from "react";

interface StarRatingProps {
    rating: number; // 0 to 5
    maxRating?: number;
    size?: "sm" | "md" | "lg";
    interactive?: boolean;
    onRatingChange?: (rating: number) => void;
}

export const StarRating: React.FC<StarRatingProps> = ({
    rating,
    maxRating = 5,
    size = "sm",
    interactive = false,
    onRatingChange,
}) => {
    const [hoverRating, setHoverRating] = React.useState<number | null>(null);

    const sizeClasses = {
        sm: "w-3.5 h-3.5",
        md: "w-5 h-5",
        lg: "w-6 h-6",
    }[size];

    return (
        <div className="flex items-center gap-1">
            {Array.from({ length: maxRating }, (_, i) => {
                const starValue = i + 1;
                const active = (hoverRating !== null ? hoverRating : rating) >= starValue;

                return (
                    <button
                        key={i}
                        type={interactive ? "button" : undefined}
                        disabled={!interactive}
                        className={interactive ? "cursor-pointer focus:outline-none" : "cursor-default"}
                        onMouseEnter={() => interactive && setHoverRating(starValue)}
                        onMouseLeave={() => interactive && setHoverRating(null)}
                        onClick={() => interactive && onRatingChange && onRatingChange(starValue)}
                        aria-label={`${starValue} de ${maxRating} estrellas`}
                    >
                        <svg
                            className={`${sizeClasses} ${active ? "text-neutral-900 fill-neutral-900" : "text-neutral-300 fill-neutral-200"}`}
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="1.5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385c.103.43-.356.785-.742.546l-4.705-2.885a.563.563 0 00-.586 0L6.982 20.54c-.386.239-.845-.116-.742-.546l1.285-5.385a.563.563 0 00-.182-.557l-4.204-3.602c-.38-.325-.178-.948.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                            />
                        </svg>
                    </button>
                );
            })}
        </div>
    );
};
