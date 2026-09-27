# SIPARTA Frontend (Web Dashboard)

Aplikasi web Next.js premium untuk sistem pemantauan dan peringatan dini gas beracun (SIPARTA) yang terhubung ke **Supabase** (Database) dan **ThirdWeb** (Polygon Amoy Blockchain).

## 1. Project Overview

Frontend ini bertugas untuk menyajikan dashboard pemantauan *real-time* kepada admin atau tim keselamatan. Aplikasi ini membaca riwayat insiden dari database Supabase yang disuplai oleh *backend*, menampilkan peringatan mitigasi dari Gemini AI, serta mengizinkan admin untuk mengamankan bukti menggunakan wallet MetaMask via ThirdWeb SDK.

## 2. Architecture Overview

Komponen utama:
- **Framework**: Next.js (React)
- **Styling**: Tailwind CSS dengan *glassmorphism* dan desain modern
- **Database Client**: Supabase SDK (menggunakan kunci publik/anonim)
- **Web3 Integration**: Thirdweb SDK untuk koneksi ke Polygon Amoy (MetaMask)
- **API Target**: Memanggil `web_backend` FastAPI (Render endpoint).

## 3. Prerequisites

- **Node.js** (versi 20 atau terbaru)
- **npm** (biasanya sepaket dengan Node.js)
- Browser dengan ekstensi **MetaMask** terinstal
- Akses ke dashboard Thirdweb untuk mendapatkan `Client ID`

## 4. Environment Configuration

File konfigurasi environment adalah `.env.local`. Salin dari contoh:
```bash
cp .env.example .env.local
```

Isi variabel-variabel berikut di `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` = URL proyek Supabase (bisa diambil dari dashboard Supabase).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *Anon/Public key* Supabase.
- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` = Dapatkan dengan membuat API Key di [thirdweb.com/dashboard/settings/api-keys](https://thirdweb.com/dashboard/settings/api-keys).
- `NEXT_PUBLIC_DISEASE_API_URL` = Endpoint menuju FastAPI `web_backend` yang sudah berjalan (Misal: `https://siparta-backend.onrender.com`).

*(Penting: Jangan pernah menggunakan `SUPABASE_SERVICE_ROLE_KEY` di environment dengan awalan `NEXT_PUBLIC_` karena akan terekspos ke publik).*

## 5. Installation & Setup

1. Buka terminal dan pastikan berada di direktori `web_frontend`.
2. Install semua *dependencies*:
   ```bash
   npm install
   ```
3. Pastikan konfigurasi `.env.local` telah terisi (Langkah 4).
4. Jalankan *development server*:
   ```bash
   npm run dev
   ```
5. Buka `http://localhost:3000` di browser Anda.

## 6. Integration Setup & Workflow

- **Frontend ↔ Supabase (Read)**: Dasbor `monitoring.tsx` melakukan fetching data langsung dari tabel `incidents` di Supabase untuk mendapatkan data paling *up-to-date*. Hal ini mengandalkan konfigurasi `NEXT_PUBLIC_SUPABASE_URL`.
- **Frontend ↔ Thirdweb**: Komponen Thirdweb Provider digunakan untuk membungkus `_app.tsx` atau `layout.tsx`, memungkinkan pengguna terhubung (*connect wallet*) menggunakan dompet kripto (MetaMask) ke jaringan *testnet* Polygon Amoy.

## 7. Troubleshooting

- **Symptom**: Gagal login dengan MetaMask (Error Thirdweb Provider).
  - **Penyebab**: `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` kosong atau *domain* (misal: localhost) belum dimasukkan ke daftar *Allowed Domains* di pengaturan ThirdWeb API Key.
  - **Solusi**: Masukkan Client ID yang benar dan tambahkan `localhost:3000` atau URL domain live ke *Allowed Domains* Thirdweb.
- **Symptom**: Data insiden kosong atau tidak diperbarui.
  - **Penyebab**: Row Level Security (RLS) di Supabase mencegah akses baca (SELECT) anonim.
  - **Solusi**: Pastikan di *Backend*, tabel `incidents` sudah memiliki _policy_ yang mengizinkan *public read* untuk kunci *anon*.
