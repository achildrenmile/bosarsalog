import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface Admin {
  id: number;
  callsign: string;
  name: string;
  role: string;
}

interface AuthContextType {
  token: string | null;
  admin: Admin | null;
  login: (callsign: string, pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [admin, setAdmin] = useState<Admin | null>(() => {
    const stored = localStorage.getItem('admin');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (callsign: string, pin: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callsign: callsign.toUpperCase(), pin }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Anmeldung fehlgeschlagen');
    }
    const data = await res.json();
    setToken(data.token);
    setAdmin(data.admin);
    localStorage.setItem('token', data.token);
    localStorage.setItem('admin', JSON.stringify(data.admin));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
  }, []);

  return (
    <AuthContext.Provider value={{ token, admin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
