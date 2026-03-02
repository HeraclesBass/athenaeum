"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type UserInfo } from "./api";

const AuthContext = createContext<UserInfo>({ authenticated: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo>({ authenticated: false });

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser({ authenticated: false }));
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth(): UserInfo {
  return useContext(AuthContext);
}
