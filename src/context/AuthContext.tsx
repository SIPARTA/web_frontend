import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
import { useActiveAccount, useActiveWalletChain, useSwitchActiveWalletChain } from "thirdweb/react";
import { polygonAmoy } from "thirdweb/chains";

type AuthState = {
  walletStatus: "connected" | "disconnected" | "initializing";
  authenticationStatus: "authenticated" | "unauthenticated" | "authenticating" | "initializing";
  databaseSyncStatus: "synchronized" | "unsynchronized" | "initializing";
  user: any | null;
  error: string | null;
  login: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  signUpWithEmail: (n: string, e: string, p: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

import { supabase } from "../lib/supabaseClient";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
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

      // Ensure chain is Polygon Amoy before signing
      if (activeChain?.id !== polygonAmoy.id) {
        try {
          await switchChain(polygonAmoy);
        } catch (switchErr) {
          throw new Error("Gagal mengganti jaringan ke Polygon Amoy. Harap ganti secara manual di wallet Anda.");
        }
      }
      
      // 1. Dapatkan Nonce dari backend
      const nonceRes = await fetch(`/api/auth/nonce?address=${account.address}`);
      if (!nonceRes.ok) throw new Error("Gagal mendapatkan nonce dari server");
      const { nonce } = await nonceRes.json();

      // 2. Minta Signature dari user (SIWE Message - EIP-4361 compliant)
      const domain = window.location.host;
      const origin = window.location.origin;
      const statement = 'Welcome to SIPARTA! Please sign this message to verify your identity.';
      const issuedAt = new Date().toISOString();

      const message = `${domain} wants you to sign in with your Ethereum account:\n${account.address}\n\n${statement}\n\nURI: ${origin}\nVersion: 1\nChain ID: ${polygonAmoy.id}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
      
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
  }, [account, activeChain, switchChain]);

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

  const completeEmailSession = async (session: any) => {
    // Send session to our unified backend to generate siparta JWT
    const verifyRes = await fetch("/api/auth/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: session.access_token,
      })
    });

    if (!verifyRes.ok) throw new Error("Gagal mapping sesi Email. Coba lagi.");
    const data = await verifyRes.json();

    if (data.success && data.user) {
      localStorage.setItem("siparta_web3_user", JSON.stringify(data.user));
      setUser(data.user);
      setDatabaseSyncStatus("synchronized");
      setAuthenticationStatus("authenticated");
    } else {
      throw new Error("Sesi tidak valid");
    }
  };

  const loginWithEmail = useCallback(async (email: string, pass: string) => {
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;
    setAuthenticationStatus("authenticating");
    try {
      setError(null);
      const { data, error: sbError } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });
      if (sbError) throw sbError;
      if (data.session) {
         await completeEmailSession(data.session);
      }
    } catch(err: any) {
      console.warn("[AuthContext] Email Login Error:", err.message);
      setError(err.message || "Gagal masuk. Periksa kembali email dan password.");
      setAuthenticationStatus("unauthenticated");
      setUser(null);
    } finally {
      isAuthenticating.current = false;
    }
  }, []);

  const signUpWithEmail = useCallback(async (name: string, email: string, pass: string) => {
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;
    setAuthenticationStatus("authenticating");
    try {
      setError(null);
      const { data, error: sbError } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            full_name: name
          }
        }
      });
      if (sbError) throw sbError;
      if (data.user && data.user.identities && data.user.identities.length === 0) {
         setError("Akun dengan email ini sudah terdaftar. Silakan Sign In.");
         setAuthenticationStatus("unauthenticated");
      } else if (data.session) {
         await completeEmailSession(data.session);
      } else {
         setError("Registrasi berhasil. Silakan periksa kotak masuk/spam email Anda untuk verifikasi.");
         setAuthenticationStatus("unauthenticated");
      }
    } catch(err: any) {
      console.warn("[AuthContext] Email SignUp Error:", err.message);
      setError(err.message || "Gagal mendaftar. Coba gunakan email lain.");
      setAuthenticationStatus("unauthenticated");
      setUser(null);
    } finally {
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
    if (account?.address && user) {
      // Jika user murni login via MetaMask (wallet_address starts with 0x)
      // dan address yang terhubung berubah, logout.
      // Atau jika user sudah melink MetaMask (metamask_address) dan berubah, logout.
      // TAPI jika user login via Google/Email dan belum punya metamask_address, biarkan saja (karena mau proses link).
      const isPureWeb3 = user.wallet_address?.startsWith("0x");
      const hasLinkedMetaMask = !!user.metamask_address;
      
      const isAddressMismatch = account.address !== user.wallet_address && account.address !== user.metamask_address;

      if (isAddressMismatch) {
        if (isPureWeb3 || hasLinkedMetaMask) {
           console.log("[AuthContext] Wallet account changed. Logging out...");
           logout();
        }
      }
    }
  }, [account?.address, user?.wallet_address, user?.metamask_address, logout]);

  return (
    <AuthContext.Provider value={{ walletStatus, authenticationStatus, databaseSyncStatus, user, error, login, loginWithGoogle, loginWithEmail, signUpWithEmail, logout }}>
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
