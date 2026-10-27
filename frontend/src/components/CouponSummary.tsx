import { CouponType } from '@/types/commerce';

/** Muestra un resumen visual del cupón aplicado en carrito o checkout. */
export const CouponSummary: React.FC<{
    couponCode?: string;
    discountAmount?: number;
    couponType?: CouponType;
    onRemove: () => void;
}> = ({ couponCode, discountAmount, couponType, onRemove }) => {
    if (!couponCode) {
        return null;
    }

    const typeLabel = couponType === 'PERCENTAGE' ? '%' : '$';

    return (
        <div className="flex items-center space-x-2 border-l-2 border-neutral-900 p-3 rounded-md bg-neutral-950">
            <span className="text-sm font-medium text-neutral-100">{couponCode}</span>
            {discountAmount !== undefined && (
                <span className="text-sm text-neutral-400">
                    -{couponType === 'PERCENTAGE'
                        ? `${discountAmount}%`
                        : `$${discountAmount}`}
                </span>
            )}
            <button
                type="button"
                onClick={onRemove}
                className="text-neutral-500 text-sm hover:text-neutral-400"
                aria-label="Quitar cupón"
            >
                ✕
            </button>
        </div>
    );
};