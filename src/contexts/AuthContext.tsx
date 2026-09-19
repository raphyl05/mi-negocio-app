import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type AuthContextValue = {
  authed: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  authed: false,
  login: () => undefined,
  logout: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);

  const value: AuthContextValue = {
    authed,
    login: () => setAuthed(true),
    logout: () => setAuthed(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}