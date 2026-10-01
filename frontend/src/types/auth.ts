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
