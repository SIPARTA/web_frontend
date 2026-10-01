import Image from "next/image";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

const metrics = [
  { label: "Dataset gas", value: "8 jenis" },
  { label: "Sensor aktif", value: "4 komponen" },
  { label: "Akses tambahan", value: "MetaMask" },
];

const modules = [
  {
    title: "Pemeriksaan sebelum pakai",
    desc: "Pengguna memilih dua bahan rumah tangga, lalu sistem menampilkan status risiko dan arahan singkat.",
  },
  {
    title: "Referensi bahan",
    desc: "Daftar bahan dibuat ringkas agar mudah dibaca oleh pengguna non-teknis.",
  },
  {
    title: "Catatan peringatan",
    desc: "Riwayat dapat disiapkan untuk kebutuhan dokumentasi dan audit penggunaan.",
  },
];

const risks = [
  { pair: "Pemutih + Amonia", note: "Berisiko menghasilkan gas kloramin", level: "Tinggi", cls: "risk-high" },
  { pair: "Pemutih + Cuka", note: "Berisiko menghasilkan gas klorin", level: "Tinggi", cls: "risk-high" },
  { pair: "Cuka + Sabun cuci piring", note: "Gunakan sesuai label produk", level: "Sedang", cls: "risk-medium" },
  { pair: "Sabun cuci piring + Air", note: "Umumnya aman untuk penggunaan biasa", level: "Rendah", cls: "risk-low" },
];

export default function Home() {
  const { authenticationStatus } = useAuth();
  const isAuthenticated = authenticationStatus === "authenticated";

  return (
    <div className="space-y-14">
      <section className="grid items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-7">
          <div className="eyebrow">SIPARTA</div>
          <div className="space-y-5">
            <h1 className="hero-title max-w-3xl">
              Sistem Pintar Deteksi Kimia Rumah Tangga
            </h1>
            <p className="max-w-2xl text-lg leading-8" style={{ color: "var(--muted)" }}>
              SIPARTA membantu pengguna memeriksa risiko pencampuran bahan pembersih rumah
              tangga melalui tampilan yang rapi, jelas, dan mudah digunakan di desktop.
            </p>
          </div>

          {!isAuthenticated && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/signin" className="btn-primary text-sm">
                Masuk Akun
              </Link>
              <Link href="/signup" className="btn-outline-primary text-sm">
                Daftar Akun
              </Link>
            </div>
          )}

          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {metrics.map((item) => (
              <div key={item.label} className="metric-card">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  {item.label}
                </p>
                <p className="mt-2 text-base font-extrabold" style={{ color: "var(--section-title)" }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="desktop-panel">
          <div className="panel-topbar">
            <div className="flex items-center gap-2">
              <span className="window-dot" />
              <span className="window-dot" />
              <span className="window-dot" />
            </div>
            <div className="status-pill">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--teal-400)" }} />
              Sistem siap
            </div>
          </div>

          <div className="p-5">
            <div className="mb-5 flex items-center gap-4">
              <div className="relative h-14 w-14 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-soft)" }}>
                <Image src="/logo.png" alt="SIPARTA" fill sizes="56px" className="object-contain p-1" priority />
              </div>
              <div>
                <p className="text-sm font-extrabold" style={{ color: "var(--section-title)" }}>
                  Pemeriksaan campuran
                </p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Pilih bahan sebelum digunakan bersamaan.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Bahan pertama
                </label>
                <div className="rounded-md border bg-white px-3 py-3 text-sm font-semibold" style={{ borderColor: "var(--border-soft)", color: "var(--section-title)", background: "var(--surface)" }}>
                  Pemutih
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Bahan kedua
                </label>
                <div className="rounded-md border px-3 py-3 text-sm font-semibold" style={{ borderColor: "var(--border-soft)", color: "var(--section-title)", background: "var(--surface)" }}>
                  Amonia
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border p-4" style={{ borderColor: "rgba(220,38,38,0.22)", background: "rgba(220,38,38,0.06)" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold text-red-700">Risiko tinggi</p>
                  <p className="mt-1 text-sm leading-6 text-red-700/80">
                    Jangan mencampur pemutih dengan amonia. Gunakan secara terpisah dan pastikan
                    ventilasi terbuka.
                  </p>
                </div>
                <span className="risk-badge risk-high">Tinggi</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {["NaClO", "NH3", "HCl"].map((formula) => (
                <div key={formula} className="rounded-md border px-3 py-3 text-center font-mono text-sm font-bold" style={{ borderColor: "var(--border-soft)", color: "var(--muted)", background: "var(--surface-soft)" }}>
                  {formula}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <div>
          <p className="section-kicker">Alur kerja</p>
          <h2 className="section-title mt-3">Dirancang untuk keputusan cepat di rumah.</h2>
          <p className="mt-4 leading-7" style={{ color: "var(--muted)" }}>
            Tampilan dibuat ringkas agar pengguna tidak perlu membaca instruksi panjang saat
            sedang memakai bahan pembersih. Informasi utama selalu berada di depan: bahan,
            tingkat risiko, dan tindakan yang disarankan.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {modules.map((item) => (
            <div key={item.title} className="module-card">
              <h3 className="text-base font-extrabold" style={{ color: "var(--section-title)" }}>
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="soft-panel p-6 md:p-7">
        <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="section-kicker">Referensi cepat</p>
            <h2 className="section-title mt-3">Contoh tingkat risiko campuran</h2>
          </div>
          <Link href={isAuthenticated ? "/monitoring" : "/signin"} className="btn-secondary text-sm">
            Masuk ke SIPARTA
          </Link>
        </div>

        <div className="rounded-lg border bg-white px-5" style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}>
          {risks.map((item) => (
            <div key={item.pair} className="risk-row">
              <div>
                <p className="font-bold" style={{ color: "var(--section-title)" }}>
                  {item.pair}
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  {item.note}
                </p>
              </div>
              <span className={`risk-badge ${item.cls}`}>{item.level}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
