import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api';

interface User {
    userId: string;
    username: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isAdmin: boolean;
    isAnalyst: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Restore session
        const savedToken = localStorage.getItem('bfi_token');
        const savedUser = localStorage.getItem('bfi_user');
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = async (username: string, password: string) => {
        const res = await authApi.login(username, password);
        const { token: jwt, user: userData } = res.data;
        setToken(jwt);
        setUser(userData);
        localStorage.setItem('bfi_token', jwt);
        localStorage.setItem('bfi_user', JSON.stringify(userData));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('bfi_token');
        localStorage.removeItem('bfi_user');
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            login,
            logout,
            isAdmin: user?.role === 'admin',
            isAnalyst: user?.role === 'fraud_analyst' || user?.role === 'admin',
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
