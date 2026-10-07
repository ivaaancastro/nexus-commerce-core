"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "@/lib/api";
import { User, RegisterData, LoginData } from "@/types/auth";

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (data: LoginData) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    verifyEmail: (email: string, code: string) => Promise<void>;
    resendVerificationCode: (email: string) => Promise<void>;
    logout: () => void;
    forgotPassword: (email: string) => Promise<void>;
    resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
    /** Recarga el usuario desde el backend tras editar el perfil. */
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Una sola cadena de promesa en lugar de un `if/else`: sin token la
        // promesa ya resuelta hace `setUser(null)` (que es null de todos modos)
        // y `finally` apaga `isLoading` igual que antes. Lo importante es que
        // ningún `setState` se llama de forma síncrona en el cuerpo del efecto,
        // que es lo que prohíbe react-hooks/set-state-in-effect.
        const token = localStorage.getItem("nexus-auth-token");
        const session = token ? api.getCurrentUser() : Promise.resolve(null);
        session
            .then(setUser)
            .catch(() => localStorage.removeItem("nexus-auth-token"))
            .finally(() => setIsLoading(false));
    }, []);

    const login = async (data: LoginData) => {
        const response = await api.login(data);
        localStorage.setItem("nexus-auth-token", response.token);
        localStorage.setItem("nexus-refresh-token", response.refreshToken);
        setUser(response.user);
    };

    const register = async (data: RegisterData) => {
        await api.register(data);
    };

    const verifyEmail = async (email: string, code: string) => {
        await api.verifyEmail(email, code);
    };

    const resendVerificationCode = async (email: string) => {
        await api.resendVerificationCode(email);
    };

    const logout = () => {
        localStorage.removeItem("nexus-auth-token");
        localStorage.removeItem("nexus-refresh-token");
        setUser(null);
    };

    const forgotPassword = async (email: string) => {
        await api.forgotPassword(email);
    };

    const resetPassword = async (email: string, code: string, newPassword: string) => {
        await api.resetPassword(email, code, newPassword);
    };

    const refreshUser = async () => {
        const updated = await api.getProfile();
        setUser(updated);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                login,
                register,
                verifyEmail,
                resendVerificationCode,
                logout,
                forgotPassword,
                resetPassword,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth debe usarse dentro de un AuthProvider");
    }
    return context;
}
