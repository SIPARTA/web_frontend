import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";

type AuthState = {
  walletStatus: "connected" | "disconnected" | "initializing";
  authenticationStatus: "authenticated" | "unauthenticated" | "authenticating" | "initializing";
  databaseSyncStatus: "synchronized" | "unsynchronized" | "initializing";
  user: any | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const account = useActiveAccount();
  const [walletStatus, setWalletStatus] = useState<"connected" | "disconnected" | "initializing">("initializing");
  const [authenticationStatus, setAuthenticationStatus] = useState<"authenticated" | "unauthenticated" | "authenticating" | "initializing">("initializing");
  const [databaseSyncStatus, setDatabaseSyncStatus] = useState<"synchronized" | "unsynchronized" | "initializing">("initializing");
  const [user, setUser] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAuthenticating = useRef(false);

  useEffect(() => {
    if (account?.address) {
      setWalletStatus("connected");
    } else if (account === undefined) {
      // thirdweb is still initializing or disconnected
      // but let's wait for a definitive state or assume disconnected if not connected
      // Actually useActiveAccount returns undefined when not connected.
      setWalletStatus("disconnected");
    } else {
      setWalletStatus("disconnected");
    }
  }, [account]);

  const logout = useCallback(async () => {
    localStorage.removeItem("siparta_web3_user");
    setAuthenticationStatus("unauthenticated");
    setDatabaseSyncStatus("unsynchronized");
    setUser(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout failed:", e);
    }
  }, []);

  const login = useCallback(async () => {
    if (isAuthenticating.current) return;
    if (!account?.address) {
      setError("MetaMask disconnected");
      return;
    }

    // Check if already authenticated with the same address
    const saved = localStorage.getItem("siparta_web3_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.wallet_address === account.address) {
          setUser(parsed);
          setAuthenticationStatus("authenticated");
          setDatabaseSyncStatus("synchronized");
          return;
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }

    isAuthenticating.current = true;
    setAuthenticationStatus("authenticating");

    try {
      setError(null);
      
      // 1. Dapatkan Nonce dari backend
      const nonceRes = await fetch(`/api/auth/nonce?address=${account.address}`);
      if (!nonceRes.ok) throw new Error("Gagal mendapatkan nonce dari server");
      const { nonce } = await nonceRes.json();

      // 2. Minta Signature dari user (SIWE Message)
      const message = `Welcome to SIPARTA!\n\nPlease sign this message to verify your identity.\n\nNonce: ${nonce}`;
      
      // In v5 thirdweb, account object has signMessage
      let signature;
      if (typeof account.signMessage === 'function') {
        signature = await account.signMessage({ message });
      } else {
        throw new Error("Fungsi signMessage tidak didukung pada versi wallet ini");
      }

      // 3. Verifikasi Signature ke backend
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: account.address,
          signature,
          message
        })
      });

      if (!verifyRes.ok) throw new Error("Autentikasi gagal atau tidak valid");
      const data = await verifyRes.json();

      if (data.success && data.user) {
        // 4. Sukses, set session
        localStorage.setItem("siparta_web3_user", JSON.stringify(data.user));
        setUser(data.user);
        setDatabaseSyncStatus("synchronized");
        setAuthenticationStatus("authenticated");
      } else {
        throw new Error("Database belum sinkron atau data invalid");
      }
    } catch (err: any) {
      console.error("[AuthContext] Login Error:", err);
      setError(err.message || "Terjadi kesalahan saat login");
      setAuthenticationStatus("unauthenticated");
      setDatabaseSyncStatus("unsynchronized");
      setUser(null);
    } finally {
      isAuthenticating.current = false;
    }
  }, [account]);

  const previousAddress = useRef<string | undefined>(undefined);

  // Cek sesi yang ada di localStorage saat pertama kali load
  useEffect(() => {
    const saved = localStorage.getItem("siparta_web3_user");
    
    if (account?.address) {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.wallet_address === account.address) {
            setUser(parsed);
            setAuthenticationStatus("authenticated");
            setDatabaseSyncStatus("synchronized");
          } else {
            // Address berubah, harus login ulang
            logout();
          }
        } catch (e) {
          logout();
        }
      } else {
        // Connected to wallet but no session in localStorage
        setAuthenticationStatus("unauthenticated");
        setDatabaseSyncStatus("unsynchronized");
      }
    } else if (account === undefined) {
      // Thirdweb account might be undefined during initial hydration even if connected.
      // If we previously had an address and now we don't, it's a genuine disconnect.
      if (previousAddress.current !== undefined) {
        logout();
      } else if (!saved) {
        // Only if there is absolutely no saved session, we confirm unauthenticated.
        setAuthenticationStatus("unauthenticated");
        setDatabaseSyncStatus("unsynchronized");
      }
      // If there IS a saved session and we never had an address yet, we wait (hydration).
    }

    previousAddress.current = account?.address;
  }, [account?.address, logout]);

  return (
    <AuthContext.Provider value={{ walletStatus, authenticationStatus, databaseSyncStatus, user, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
