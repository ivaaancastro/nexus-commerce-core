export interface User {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    birthDate: string;
    gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
    height?: number;
    weight?: number;
    emailVerified: boolean;
    /** Rol de autorización (7.1). El backend lo envía siempre en login, refresh y /users/me. */
    role: "USER" | "ADMIN";
}

export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    birthDate: string;
    gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
    height?: number;
    weight?: number;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface AuthResponse {
    token: string;
    refreshToken: string;
    user: User;
}

export interface Address {
    id: number;
    fullName: string;
    street: string;
    city: string;
    postalCode: string;
    countryCode: string;
    defaultAddress: boolean;
}

export interface AddressData {
    fullName: string;
    street: string;
    city: string;
    postalCode: string;
    countryCode: string;
    defaultAddress: boolean;
}

/**
 * Campos editables del perfil. El email no aparece: es el identificador
 * de la cuenta y no puede modificarse desde el formulario.
 */
export interface ProfileUpdateData {
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthDate?: string;
    gender?: User["gender"];
    height?: number;
    weight?: number;
}

export interface SizeRecommendation {
    recommendedSize: string;
    reason: string;
    confidence: "Alta" | "Media" | "Baja";
}
