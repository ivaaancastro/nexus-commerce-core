import { useState, useRef } from 'react';
import { CouponValidateRequest, CouponValidationResponse, CouponType } from '@/types/commerce';
import { api } from '@/lib/api';

/** Componente de input para cupón promocional en el carrito. */
export const CouponInput: React.FC = () => {
    const [code, setCode] = useState('');
    const [validating, setValidating] = useState(false);
    const [validation, setValidation] = useState<CouponValidationResponse | null>(null);
    const debounceRef = useRef<NodeJS.Timeout>();

    // Debounce para validación (500ms)
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCode(e.target.value);

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            if (code.length < 3) {
                setValidation(null);
                return;
            }

            setValidating(true);
            try {
                const response = await api.validateCoupon({
                    code: code.toUpperCase().trim(),
                    subtotal: 0, // Se calculará en el checkout, aquí usamos 0 como placeholder
                });
                setValidation(response);

                if (!response.valid) {
                    // Mostrar mensaje de error simple
                    alert(response.message);
                }
            } catch (error) {
                alert('Error al validar el cupón');
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
                                {getMessage(validation.valid, validation.discountAmount, validation.coupon.type)}
                            </span>
                            <span className="text-sm text-neutral-600">
                                -{getDiscountFormatted(validation.discountAmount, validation.coupon.type)}
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
const getMessage = (valid: boolean, discount: number, type: CouponType) => {
    if (valid) {
        if (type === 'PERCENTAGE') {
            return `Descuento del ${discount}% aplicado`;
        }
        return `Descuento de $${discount} aplicado`;
    }
    return 'Cupón no aplicable';
};

/** Formatea el descuento para mostrarlo */
const getDiscountFormatted = (discount: number, type: CouponType): string => {
    if (type === 'PERCENTAGE') {
        return `${discount}%`;
    }
    return `$${discount}`;
};