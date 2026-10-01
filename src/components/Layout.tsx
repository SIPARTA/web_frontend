import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { memo } from "react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { href: "/", label: "Beranda" },
  { href: "/monitoring", label: "Monitoring" },
  { href: "/dataset", label: "Dataset & Sensor" },
  { href: "/transactions", label: "Transaksi" },
  { href: "/signin", label: "Masuk" },
  { href: "/signup", label: "Daftar" },
  { href: "/metamask", label: "MetaMask" },
];

function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { authenticationStatus, user, logout, authMethod } = useAuth();
  const isAuthenticated = authenticationStatus === "authenticated";

  return (
    <div className="min-h-screen">
      <header
        className="app-header sticky top-0 z-10 border-b"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-lg">
              <Image src="/logo.png" alt="SIPARTA" width={32} height={32} className="rounded-md" priority />
            </span>
            <div>
              <div className="font-bold leading-tight" style={{ color: "var(--section-title)" }}>
                SIPARTA
              </div>
              <div className="hidden text-xs sm:block" style={{ color: "var(--muted)" }}>
                Sistem Pintar Deteksi Kimia Rumah Tangga
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              // Hide Monitoring and Transaksi for Guest (unauthenticated)
              if (!isAuthenticated && (item.href === "/monitoring" || item.href === "/transactions")) return null;

              // Hide Sign In and Sign Up when authenticated (any method)
              if (isAuthenticated && (item.href === "/signin" || item.href === "/signup")) return null;

              // MetaMask navigation logic
              if (item.href === "/metamask") {
                 if (isAuthenticated && (authMethod === "google" || authMethod === "email_password")) {
                    return null; // Hide for Web2 users
                 }
                 // Show for Guest or MetaMask SIWE users
              }

              const isActive = router.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={item.href === "/blockchain" ? false : undefined}
                  className="nav-link rounded-md px-3 py-2 text-sm font-semibold"
                  style={
                    isActive
                      ? { background: "var(--nav-active-bg)", color: "var(--nav-active-text)" }
                      : { color: "var(--muted)" }
                  }
                >
                  {item.label}
                </Link>
              );
            })}

            {isAuthenticated && (
              <div className="flex items-center gap-3 ml-4 border-l pl-4 border-[var(--border-soft)]">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-semibold" style={{ color: "var(--section-title)" }}>
                    {authMethod === "metamask_siwe" && user?.wallet_address 
                      ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}`
                      : user?.name || user?.full_name || (user?.role === "admin" ? "Admin" : "User")}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                    {authMethod === "google" 
                        ? "Google Auth" 
                        : authMethod === "email_password"
                          ? "Email Auth"
                          : authMethod === "metamask_siwe"
                            ? "Polygon Amoy"
                            : ""}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 md:px-8">{children}</main>
    </div>
  );
}

export default memo(Layout);
