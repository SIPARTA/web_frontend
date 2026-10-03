import { useState } from "react";

// ── Gas dataset ──
const gases = [
  {
    name: "Karbon Monoksida",
    formula: "CO",
    sources: "Asap Rokok",
    level: "Sangat berbahaya",
    levelClass: "risk-high",
    emoji: "🔴",
    detail:
      "Gas tidak berwarna dan tidak berbau yang sangat beracun. Mengikat hemoglobin 200× lebih kuat dari O₂, menyebabkan hipoksia jaringan. Konsentrasi >100 ppm dapat menyebabkan sakit kepala, >400 ppm mengancam jiwa dalam 1–2 jam.",
    sensors: ["MICS-5524", "MQ-2"],
  },
  {
    name: "Amonia",
    formula: "NH₃",
    sources: "Larutan Amonia",
    level: "Berbahaya pada konsentrasi tinggi",
    levelClass: "risk-medium",
    emoji: "🟠",
    detail:
      "Gas alkalin yang korosif terhadap saluran pernapasan. Bau menyengat pada >25 ppm. Paparan >300 ppm dapat menyebabkan edema paru. Sangat berbahaya jika dicampur dengan pemutih (menghasilkan kloramin).",
    sensors: ["MQ-135"],
  },
  {
    name: "Metana",
    formula: "CH₄",
    sources: "Sampah organik busuk",
    level: "Mudah terbakar",
    levelClass: "risk-medium",
    emoji: "🟠",
    detail:
      "Komponen utama gas alam. Tidak beracun secara langsung, tetapi sangat mudah terbakar dan meledak pada konsentrasi 5–15% di udara (LEL–UEL). Pada konsentrasi tinggi dapat menyebabkan asfiksia.",
    sensors: ["MICS-5524", "MQ-2", "Figaro TGS2600"],
  },
  {
    name: "Propana",
    formula: "C₃H₈",
    sources: "Tabung LPG",
    level: "Mudah terbakar dan dapat menyebabkan ledakan",
    levelClass: "risk-high",
    emoji: "🔴",
    detail:
      "Komponen utama LPG yang lebih berat dari udara sehingga terakumulasi di lantai. LEL 2.1%, UEL 9.5%. Kebocoran kecil pun dapat mengisi ruangan tertutup dan menyulut ledakan dari percikan kecil.",
    sensors: ["MICS-5524", "MQ-2", "Figaro TGS2600"],
  },
  {
    name: "Isobutana",
    formula: "C₄H₁₀",
    sources: "Mancis korek api",
    level: "Mudah terbakar",
    levelClass: "risk-high",
    emoji: "🔴",
    detail:
      "Lebih berat dari propana dan terakumulasi lebih cepat di area rendah. LEL 1.8%. Sering ditemukan dalam aerosol rumah tangga dan korek gas portabel. Paparan inhalasi berlebih dapat menyebabkan aritmia jantung.",
    sensors: ["MICS-5524", "MQ-2"],
  },
  {
    name: "Hidrogen",
    formula: "H₂",
    sources: "Larutan hidrogen peroksida",
    level: "Mudah terbakar",
    levelClass: "risk-medium",
    emoji: "🟠",
    detail:
      "Gas paling ringan yang mudah menyebar ke atas. Sangat mudah terbakar dengan rentang LEL–UEL 4–75%. Nyala api hidrogen hampir tidak terlihat. Dihasilkan saat pengisian baterai aki (charging lead-acid batteries).",
    sensors: ["MICS-5524", "MQ-2", "Figaro TGS2600"],
  },
  {
    name: "Etanol",
    formula: "C₂H₅OH",
    sources: "Alkohol",
    level: "Mudah menguap dan mudah terbakar",
    levelClass: "risk-low",
    emoji: "🟡",
    detail:
      "Uap etanol mudah terbakar pada konsentrasi >3.3% (LEL). Flash point rendah (13°C). Banyak terdapat di produk rumah tangga. Sensor dapat mendeteksi akumulasi uap di ruangan tertutup terutama saat hand sanitizer digunakan berlebihan.",
    sensors: ["MICS-5524", "MQ-2", "MQ-135", "Figaro TGS2600"],
  },
  {
    name: "Hidrogen Sulfida",
    formula: "H₂S",
    sources: "Septic Tank",
    level: "Sangat berbahaya (sensitivitas silang)",
    levelClass: "risk-high",
    emoji: "🔴",
    detail:
      "Gas beracun berbau telur busuk pada konsentrasi rendah (<10 ppm), tetapi melumpuhkan indra penciuman pada >100 ppm. Konsentrasi >300 ppm dapat menyebabkan kematian dalam hitungan menit. Terdeteksi oleh sensitivitas silang sensor.",
    sensors: ["MQ-2", "MQ-135"],
  },
];

// ── Sensor components ──
const sensors = [
  {
    name: "MICS-5524",
    manufacturer: "SGX Sensortech / Amphenol",
    type: "MEMS Metal Oxide Semiconductor",
    detects: ["CO", "CH₄", "C₃H₈", "C₄H₁₀", "H₂", "C₂H₅OH"],
    range: "1–1000 ppm (CO), 100–10000 ppm (CH₄/LPG)",
    voltage: "5V DC, heater ~50 mW",
    description:
      "Sensor MEMS berukuran sangat kecil (5×5 mm) dengan dua elemen sensing dalam satu paket. Cocok untuk perangkat portabel dan IoT bertenaga baterai karena konsumsi daya sangat rendah. Memiliki dua keluaran analog untuk dua kelompok gas yang berbeda.",
    advantages: ["Daya sangat rendah (~50 mW)", "Ukuran kecil (MEMS)", "Dual sensing element", "Cocok untuk IoT portabel"],
    color: "var(--teal-600)",
  },
  {
    name: "MQ-2",
    manufacturer: "Hanwei / Zhengzhou Winsen",
    type: "Heated Metal Oxide Semiconductor (SnO₂)",
    detects: ["CO", "CH₄", "C₃H₈", "C₄H₁₀", "H₂", "C₂H₅OH", "H₂S (silang)"],
    range: "200–10000 ppm (combustible gases)",
    voltage: "5V DC, heater ~800 mW",
    description:
      "Sensor semikonduktor SnO₂ yang paling populer untuk deteksi gas mudah terbakar. Memiliki sensitivitas luas terhadap banyak jenis gas. Ideal untuk deteksi kebocoran LPG dan gas rumah tangga dengan harga terjangkau.",
    advantages: ["Sensitivitas tinggi", "Harga terjangkau", "Spektrum deteksi luas", "Umum tersedia di pasaran"],
    color: "var(--orange-500)",
  },
  {
    name: "MQ-135",
    manufacturer: "Hanwei / Zhengzhou Winsen",
    type: "Heated Metal Oxide Semiconductor (SnO₂)",
    detects: ["NH₃", "CO₂", "C₂H₅OH", "Benzene", "NOₓ", "H₂S (silang)"],
    range: "10–1000 ppm (NH₃), 10–300 ppm (Benzene)",
    voltage: "5V DC, heater ~800 mW",
    description:
      "Sensor kualitas udara yang sensitif terhadap gas berbahaya di lingkungan dalam ruangan. Sangat efektif mendeteksi amonia dari produk pembersih dan polutan udara umum. Sering digunakan untuk sistem monitoring kualitas udara indoor.",
    advantages: ["Deteksi kualitas udara", "Sensitif terhadap NH₃", "Monitoring indoor", "Sensitivitas silang H₂S"],
    color: "var(--teal-400)",
  },
  {
    name: "Figaro TGS2600",
    manufacturer: "Figaro Engineering Inc. (Jepang)",
    type: "Heated Metal Oxide Semiconductor",
    detects: ["CH₄", "C₃H₈", "C₄H₁₀", "H₂", "C₂H₅OH", "VOCs"],
    range: "1–100 ppm (kontaminan udara)",
    voltage: "5V DC, heater ~210 mW",
    description:
      "Sensor premium buatan Jepang yang didesain untuk mendeteksi kontaminan udara pada konsentrasi rendah. Sensitivitas tinggi terhadap gas mudah terbakar pada level sub-ppm. Ideal untuk deteksi kebocoran gas alam tahap awal.",
    advantages: ["Sensitivitas sub-ppm", "Konsumsi daya moderat", "Presisi tinggi", "Kualitas industri Jepang"],
    color: "#0ea5e9",
  },
];

export default function DatasetPage() {
  const [expandedGas, setExpandedGas] = useState<string | null>(null);
  const [expandedSensor, setExpandedSensor] = useState<string | null>(null);

  return (
    <div className="space-y-14">
      {/* Header */}
      <section className="space-y-5">
        <div className="eyebrow">Dataset & Sensor</div>
        <h1 className="hero-title max-w-3xl" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}>
          Dataset Gas Beracun & Komponen Sensor
        </h1>
        <p className="max-w-2xl text-base leading-7" style={{ color: "var(--muted)" }}>
          Data referensi 8 jenis gas beracun yang dapat dideteksi oleh sistem SIPARTA, beserta detail komponen sensor yang digunakan untuk training model JST.
        </p>
      </section>

      {/* Gas Dataset Table */}
      <section>
        <div className="mb-5">
          <p className="section-kicker">Training data</p>
          <h2 className="section-title mt-3">Dataset Gas Beracun Rumah Tangga</h2>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
            Klik pada baris gas untuk melihat detail lengkap dan sensor pendeteksinya.
          </p>
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
              {gases.length} gas terdaftar
            </div>
          </div>

          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <th style={{ textAlign: "left", padding: "0.75rem 1rem", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>No</th>
                  <th style={{ textAlign: "left", padding: "0.75rem 1rem", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Gas</th>
                  <th style={{ textAlign: "left", padding: "0.75rem 1rem", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Formula</th>
                  <th style={{ textAlign: "left", padding: "0.75rem 1rem", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Sumber</th>
                  <th style={{ textAlign: "left", padding: "0.75rem 1rem", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Tingkat Bahaya</th>
                </tr>
              </thead>
              <tbody>
                {gases.map((gas, idx) => (
                  <>
                    <tr
                      key={gas.formula}
                      onClick={() => setExpandedGas(expandedGas === gas.formula ? null : gas.formula)}
                      style={{
                        borderBottom: expandedGas === gas.formula ? "none" : "1px solid var(--border-soft)",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-soft)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "var(--muted)", fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--section-title)" }}>{gas.name}</span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <code style={{ fontSize: "0.85rem", fontWeight: 700, fontFamily: "var(--font-geist-mono, monospace)", color: "var(--teal-600)" }}>{gas.formula}</code>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "var(--muted)", maxWidth: "280px" }}>{gas.sources}</td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span className={`risk-badge ${gas.levelClass}`}>{gas.emoji} {gas.level}</span>
                      </td>
                    </tr>
                    {expandedGas === gas.formula && (
                      <tr key={`${gas.formula}-detail`} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                        <td colSpan={5} style={{ padding: "0 1rem 1rem 1rem" }}>
                          <div style={{ background: "var(--surface-soft)", borderRadius: "8px", padding: "1.25rem", border: "1px solid var(--border-soft)" }}>
                            <p style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "var(--muted)", marginBottom: "0.75rem" }}>
                              {gas.detail}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                              <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginRight: "0.25rem", lineHeight: "1.75rem" }}>Sensor:</span>
                              {gas.sensors.map((s) => (
                                <span key={s} className="hero-tag" style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem" }}>
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Sensor Components */}
      <section>
        <div className="mb-5">
          <p className="section-kicker">Hardware</p>
          <h2 className="section-title mt-3">Komponen Sensor Deteksi Gas</h2>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
            Empat sensor utama yang digunakan sistem SIPARTA untuk mendeteksi gas beracun secara multi-channel.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sensors.map((sensor) => (
            <div
              key={sensor.name}
              className="module-card"
              style={{ cursor: "pointer" }}
              onClick={() => setExpandedSensor(expandedSensor === sensor.name ? null : sensor.name)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <span style={{ display: "inline-block", width: "0.5rem", height: "0.5rem", borderRadius: "9999px", background: sensor.color }} />
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--section-title)" }}>{sensor.name}</h3>
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, marginBottom: "0.25rem" }}>{sensor.manufacturer}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{sensor.type}</p>
                </div>
                <span className="badge-pill" style={{ fontSize: "0.7rem", flexShrink: 0 }}>
                  {sensor.detects.length} gas
                </span>
              </div>

              <p style={{ fontSize: "0.85rem", lineHeight: 1.65, color: "var(--muted)", marginTop: "0.75rem" }}>
                {sensor.description}
              </p>

              {expandedSensor === sensor.name && (
                <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--surface-soft)", borderRadius: "8px", border: "1px solid var(--border-soft)" }}>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "0.5rem" }}>Gas yang Dideteksi</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {sensor.detects.map((g) => (
                        <span key={g} className="hero-tag" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>{g}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.8rem" }}>
                    <div>
                      <p style={{ fontWeight: 800, color: "var(--section-title)", marginBottom: "0.25rem" }}>Range</p>
                      <p style={{ color: "var(--muted)" }}>{sensor.range}</p>
                    </div>
                    <div>
                      <p style={{ fontWeight: 800, color: "var(--section-title)", marginBottom: "0.25rem" }}>Tegangan</p>
                      <p style={{ color: "var(--muted)" }}>{sensor.voltage}</p>
                    </div>
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "0.5rem" }}>Keunggulan</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {sensor.advantages.map((a) => (
                        <span key={a} style={{ display: "inline-flex", padding: "0.2rem 0.55rem", borderRadius: "6px", background: "var(--surface-muted)", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)" }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Sensor-Gas Matrix */}
      <section className="soft-panel p-6 md:p-7">
        <div className="mb-5">
          <p className="section-kicker">Matriks</p>
          <h2 className="section-title mt-3">Sensor × Gas Detection Matrix</h2>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
            Pemetaan kapabilitas setiap sensor terhadap jenis gas yang dapat dideteksi untuk konfigurasi multi-sensor.
          </p>
        </div>

        <div className="overflow-x-auto">
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", borderRadius: "8px", padding: "1rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-strong)" }}>
                  <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", fontWeight: 800, color: "var(--section-title)" }}>Gas</th>
                  {sensors.map((s) => (
                    <th key={s.name} style={{ textAlign: "center", padding: "0.6rem 0.75rem", fontWeight: 800, color: "var(--section-title)" }}>{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gases.map((gas) => (
                  <tr key={gas.formula} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 700, color: "var(--section-title)" }}>
                      {gas.formula}
                      <span style={{ marginLeft: "0.5rem", fontWeight: 400, color: "var(--muted)" }}>{gas.name}</span>
                    </td>
                    {sensors.map((sensor) => (
                      <td key={sensor.name} style={{ textAlign: "center", padding: "0.6rem 0.75rem" }}>
                        {gas.sensors.includes(sensor.name) ? (
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "1.5rem", height: "1.5rem", borderRadius: "6px", background: "rgba(15, 118, 110, 0.12)", color: "var(--teal-600)", fontWeight: 800 }}>✓</span>
                        ) : (
                          <span style={{ color: "var(--border-strong)" }}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
