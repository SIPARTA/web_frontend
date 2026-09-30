import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";

type AuthState = {
  walletStatus: "connected" | "disconnected" | "initializing";
  authenticationStatus: "authenticated" | "unauthenticated" | "authenticating" | "initializing";
  databaseSyncStatus: "synchronized" | "unsynchronized" | "initializing";
  user: any | null;
  error: string | null;
  login: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

import { supabase } from "../lib/supabaseClient";

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
      await supabase.auth.signOut();
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

  const loginWithGoogle = useCallback(async () => {
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;
    setAuthenticationStatus("authenticating");
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // Note: Supabase will redirect the page, so we don't need to do anything else here.
    } catch (err: any) {
      console.error("[AuthContext] Google Login Error:", err);
      setError(err.message || "Gagal inisiasi Google Login");
      setAuthenticationStatus("unauthenticated");
      isAuthenticating.current = false;
    }
  }, []);

  // 1. Initial auth restoration (run once on mount)
  useEffect(() => {
    const saved = localStorage.getItem("siparta_web3_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        setAuthenticationStatus("authenticated");
        setDatabaseSyncStatus("synchronized");
      } catch (e) {
        // Invalid session data
        localStorage.removeItem("siparta_web3_user");
        setAuthenticationStatus("unauthenticated");
        setDatabaseSyncStatus("unsynchronized");
      }
    } else {
      // No saved session
      setAuthenticationStatus("unauthenticated");
      setDatabaseSyncStatus("unsynchronized");
    }
  }, []);

  // 2. Handle account changes (only if user is already authenticated)
  useEffect(() => {
    if (account?.address && user?.wallet_address) {
      // Jika account yang terhubung berbeda dengan session yang ada, dan bukan user google, logout!
      if (account.address !== user.wallet_address && !user.wallet_address.startsWith("google:")) {
        console.log("[AuthContext] Wallet account changed. Logging out...");
        logout();
      }
    }
  }, [account?.address, user?.wallet_address, logout]);

  return (
    <AuthContext.Provider value={{ walletStatus, authenticationStatus, databaseSyncStatus, user, error, login, loginWithGoogle, logout }}>
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
