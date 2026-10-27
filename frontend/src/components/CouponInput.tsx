import { useState } from 'react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Componente de input para cupón promocional en el carrito. */
export const CouponInput: React.FC = () => {
    const [code, setCode] = useState('');
    const [validating, setValidating] = useState(false);
    type CouponValidation = { valid: boolean; message?: string; discountAmount?: number; couponType?: 'PERCENTAGE' | 'FIXED' };
    const [validation, setValidation] = useState<CouponValidation | null>(null);

    // Debounce para validación (500ms)
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCode(e.target.value);

        setTimeout(async () => {
            if (code.length < 3) {
                setValidation(null);
                return;
            }

            setValidating(true);
            try {
                const res = await fetch(`${BASE_URL}/api/v1/coupons/validate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        code: code.toUpperCase().trim(),
                        subtotal: 0,
                    }),
                });
                const response = await res.json();
                setValidation(response);

                if (!response.valid) {
                    window.alert(response.message);
                }
            } finally {
                setValidating(false);
            }
        }, 500);
    };

    return (
        <div className="space-y-2">
            <input
                type="text"
                value={code}
                onChange={handleChange}
                placeholder="Código de cupón..."
                className="w-full border rounded-md px-3 py-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                disabled={validating}
                aria-label="Código de cupón"
                inputMode="text"
            />
            {validating && <p className="text-xs text-neutral-500">Validando...</p>}

            {validation && (
                <div className="mt-2 pt-2 border-t">
                    {validation.valid ? (
                        <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-neutral-900">
                                {getMessage(validation.valid, validation.discountAmount, validation.couponType ?? 'PERCENTAGE')}
                            </span>
                            <span className="text-sm text-neutral-600">
                                -{getDiscountFormatted(validation.discountAmount, validation.couponType ?? 'PERCENTAGE')}
                            </span>
                        </div>
                    ) : (
                        <p className="text-sm text-neutral-400">{validation.message}</p>
                    )}
                </div>
            )}
        </div>
    );
};

/** Devuelve el mensaje según el tipo de cupón */
const getMessage = (valid: boolean, discount: number | undefined, type: 'PERCENTAGE' | 'FIXED') => {
    if (valid) {
        if (type === 'PERCENTAGE') {
            return `Descuento del ${discount ?? 0}% aplicado`;
        }
        return `Descuento de $${discount ?? 0} aplicado`;
    }
    return 'Cupón no aplicable';
};

/** Formatea el descuento para mostrarlo */
const getDiscountFormatted = (discount: number | undefined, type: 'PERCENTAGE' | 'FIXED'): string => {
    if (type === 'PERCENTAGE') {
        return `${discount ?? 0}%`;
    }
    return `$${discount ?? 0}`;
};