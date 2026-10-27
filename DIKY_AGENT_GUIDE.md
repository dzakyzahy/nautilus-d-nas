# 🧭 Panduan Komprehensif AI Agent untuk Diky (Nautilus D-NAS)

> **Dokumen ini dibuat khusus sebagai instruksi dan peta konteks lengkap bagi AI Coding Assistant yang mendampingi Diky Dwi Anggara Permadi.**  
> Dokumen ini memuat arsitektur sistem, status kode yang telah selesai dan terverifikasi (*ground truth*), kontrak data & API, serta daftar prioritas tugas yang perlu dikerjakan oleh Diky.

---

## 📌 1. Identitas & Konteks Proyek

- **Nama Proyek:** Nautilus D-NAS: Decentralized Marine Drone Swarm Storage
- **Event:** UGREEN Hackathon on AI NAS ($46,000 USD Prize Pool)
- **Kategori / Track:** *Open Innovation / Automate Your Workflow*
- **Platform Sasaran:** UGREEN AI NAS (UGOS Pro / iDX6011 Pro 64GB RAM)
- **Repositori GitHub:** [https://github.com/dzakyzahy/nautilus-d-nas](https://github.com/dzakyzahy/nautilus-d-nas) (Branch: `main`)
- **Pembagian Tim:**
  - **Diky Dwi Anggara Permadi:** *System Architecture, Distributed Erasure Coding & UGREEN AI NAS Integration* (Fokus: Core Codec, Audit NAS, Komponen UI Rekonstruksi & Visualizer).
  - **Dzaky Zahy Rabbani:** *Uliya AI Skill Orchestration, Marine Swarm Telemetry Simulation & Documentation* (Fokus: Simulator Misi Bawah Laut, Pipeline AI Uliya, Dokumentasi & Integrasi).

---

## ✅ 2. Status Kode Saat Ini (Ground Truth — 100% Selesai & Teruji)

Seluruh fondasi backend dan visualisasi 3D awal telah selesai dibangun, lulus **32/32 skenario pengujian `pytest`**, dan telah di-*push* ke GitHub:

```text
nautilus-d-nas/
├── nautilus_rs_codec/          # [CORE] Mesin Reed-Solomon GF(2^8) murni tanpa dependensi eksternal
│   ├── galois.py               # Aritmatika medan GF(2^8), lookup table O(1), operasi vektor
│   ├── matrix.py               # Inversi Gauss-Jordan GF(2^8), generator Vandermonde & Cauchy
│   ├── encoder.py              # Memecah payload -> k data + m parity shards + manifest.json
│   ├── decoder.py              # Rekonstruksi D = G_sub^-1 * S_sub + verifikasi SHA-256
│   └── __main__.py             # CLI: python -m nautilus_rs_codec [encode|decode|benchmark]
├── nas_auditor/                # [AUDIT] Pemeriksa integritas & karantina bit-rot
│   ├── scanner.py              # Pemindai volume /volume1/nautilus_missions/
│   └── quarantine.py           # Isolasi file corrupt ke /quarantine/ & guardrail ERR_INSUFFICIENT_SHARDS
├── swarm_simulator/            # [SIMULATOR] Simulator telemetri drone laut & kegagalan
│   ├── generate_mission.py     # Generator misi otomatis (drone tenggelam & bit-rot)
│   └── sample_telemetry/
│       └── mock_sensors.py     # Sintesis IMU, log akustik, dan frame sonar SAS
├── ai_indexer/                 # [AI ULIYA] Integrasi UGREEN AI Knowledge Hub
│   ├── anomaly_tagger.py       # Deteksi anomali: retakan pipa, korosi galvanik, kebocoran gas
│   └── report_builder.py       # Generator otomatis MISSION_RECOVERY_REPORT.md
├── api_server.py               # [API BRIDGE] FastAPI REST API + WebSocket live logs + Static server
├── web3d/                      # [3D WORLD] Visualisasi WebGL / Three.js 3D Virtual Ocean Command Center
│   ├── index.html              # HUD Glassmorphism, Camera Presets, Modal Inspeksi Drone
│   ├── style.css               # Tema Cyber-Marine Dark Mode, animasi pulse & neon glow
│   └── nautilus_3d.js          # Scene 3D lautan, 10 drone AUV, kapal riset + UGREEN NAS, pipa retak
├── skill-package/              # [ULIYA SKILL] Paket submisi Uliya AI Agent (UGOS Pro)
│   ├── SKILL.md                # Spesifikasi deklaratif skill resmi
│   └── nautilus-dnas-sync.zip  # Berkas ZIP siap unggah ke Devpost
├── tests/                      # [TEST SUITE] 32 unit & integration tests (100% lulus)
├── Dockerfile                  # Kontainer Debian Linux untuk UGOS Pro
├── docker-compose.yml          # Setup deployment lokal / remote NAS
├── requirements.txt            # Dependensi Python
└── README.md                   # Dokumentasi resmi proyek
```

---

## 📐 3. Fondasi Matematika & Kontrak Teknis (Wajib Dipahami)

### A. Reed-Solomon Erasure Coding over $GF(2^8)$
- **Polinomial Primitif:** $P(x) = x^8 + x^4 + x^3 + x^2 + 1 = \text{0x11D}$ (285 desimal).
- **Elemen Generator:** $\alpha = 0x02$ dengan tabel prekomputasi $\text{EXP}[512]$ dan $\text{LOG}[256]$.
- **Konfigurasi Default:** $k = 6$ (*data shards*), $m = 4$ (*parity shards*), total $n = k + m = 10$ *shards/drones*.
- **Matriks Generator Sistematik:**
  $$G = \begin{bmatrix} I_{k \times k} \\ P_{m \times k} \end{bmatrix} \in GF(2^8)^{n \times k}$$
  - $k$ baris pertama adalah matriks identitas $I_k$ (jika semua data drone selamat, waktu dekoding adalah $O(1)$ tanpa inversi).
  - $m$ baris berikutnya adalah koefisien paritas Vandermonde / Cauchy.
- **Inversi Sub-Matriks:**
  Jika ada subset drone yang tenggelam (maksimal $m=4$ drone hilang), sistem mengambil $k$ baris selamat $G_{\text{sub}}$ dan melakukan inversi Gauss-Jordan di atas $GF(2^8)$:
  $$D = G_{\text{sub}}^{-1} \cdot S_{\text{sub}}$$
  *(Catatan: seluruh 210 kemungkinan kombinasi sub-matriks $\binom{10}{6}$ telah diuji dan terbukti tidak singular).*

### B. Swarm Reliability Formula ($R_{\text{swarm}}$)
Probabilitas kelangsungan data misi 100% dengan tingkat kegagalan drone individu $p = 0.30$:
$$R_{\text{swarm}} = \sum_{i=0}^{m} \binom{n}{i} p^i (1 - p)^{n - i}$$
Untuk $n=10, m=4, p=0.30$, nilai teoritis adalah **84.97%** (~85.0%), dan melonjak hingga **95%–100%** saat dikombinasikan dengan *dynamic acoustic re-sharding*.

### C. Kontrak Format `manifest.json`
Setiap misi tersimpan di `/volume1/nautilus_missions/incoming/{{mission_id}}/manifest.json`:
```json
{
  "mission_id": "SUBSEA-2026-ALPHA",
  "timestamp": "2026-10-27T19:00:00Z",
  "matrix_type": "vandermonde",
  "reed_solomon": {
    "data_shards_k": 6,
    "parity_shards_m": 4,
    "total_shards_n": 10,
    "shard_size_bytes": 1048576
  },
  "master_payload": {
    "filename": "subsea_inspection_bundle.tar",
    "size_bytes": 6291456,
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  "shards": [
    {
      "index": 0,
      "filename": "shard_0.bin",
      "drone_id": "AUV-01",
      "type": "data",
      "size_bytes": 1048576,
      "sha256": "a1b2c3..."
    }
  ]
}
```

---

## 🔌 4. Kontrak REST API & WebSocket (Siap Dipakai Frontend)

Backend FastAPI melayani *endpoints* berikut di `http://localhost:8000`:

| Method | Endpoint | Fungsi | Payload / Parameter |
|---|---|---|---|
| `GET` | `/` atau `/3d/` | Membuka 3D Virtual Ocean Visualizer | Browser view |
| `GET` | `/api/health` | Healthcheck & info status platform | - |
| `GET` | `/api/analytics/r-swarm` | Kalkulator probabilitas binomial $R_{\text{swarm}}$ | `?n=10&m=4&p=0.30` |
| `GET` | `/api/missions` | Daftar seluruh folder misi incoming & recovered | - |
| `POST` | `/api/simulator/generate` | Memicu generator simulasi misi & kegagalan drone | `{"mission_id": "...", "k": 6, "m": 4, "sunken_drones": 2, "corrupt_drones": 1}` |
| `POST` | `/api/audit` | Step 1: Audit SHA-256 & karantina bit-rot | `{"mission_id": "...", "ingest_dir": "./incoming", "auto_quarantine": true}` |
| `POST` | `/api/reconstruct` | Step 2: Rekonstruksi RS $G_{\text{sub}}^{-1} \cdot S_{\text{sub}}$ | `{"mission_id": "...", "output_dir": "./reconstructed"}` |
| `POST` | `/api/ai-index` | Step 3: Multimodal anomaly tagger & generate MD | `{"mission_id": "...", "output_dir": "./reconstructed"}` |
| `POST` | `/api/pipeline/run-all` | Eksekusi otomatis Step 1 $\rightarrow$ Step 2 $\rightarrow$ Step 3 | `{"mission_id": "...", "enable_ai_index": true}` |
| `GET` | `/api/missions/{id}/report`| Mengambil teks isi `MISSION_RECOVERY_REPORT.md` | `?output_dir=...` |
| `WS` | `/ws/logs` | Streaming log eksekusi terminal secara *real-time* | WebSocket connection |

---

## 🎯 5. Ruang Lingkup Tugas & Rekomendasi Pengerjaan Diky

Sebagai arsitek sistem dan penanggung jawab antarmuka rekonstruksi, berikut area yang dapat dikembangkan oleh Diky:

### Prioritas 1: Penyempurnaan & Ekstensi Visualisasi 3D (`web3d/`)
Visualisasi 3D saat ini sudah berfungsi penuh di [`web3d/`](file:///d:/ITB2/Lomba/Hackaton/UGREEN_hackaton/web3d/) dengan Three.js. Diky dapat meningkatkannya:
1. **Model 3D Fotorealistik (GLTF/GLB):**
   - Menambahkan file model 3D kapal riset atau kapal selam AUV (format `.glb` / `.gltf`) menggunakan `THREE.GLTFLoader` untuk menggantikan bentuk torpedo geometris prosedural saat ini.
2. **Visualisasi Sebaran Titik Sonar (Bathymetric Point Cloud):**
   - Menampilkan visual titik-titik kedalaman laut 3D berwarna pelangi (*color map depth*) di atas pipa saat proses pemindaian sonar berlangsung.
3. **Efek Suara Laut & Sonar (Web Audio API):**
   - Menambahkan suara sonar ping (*ping ping*), desau bawah air (*abyssal hum*), dan suara alarm darurat saat drone mati/tenggelam.

### Prioritas 2: Dashboard Frontend Tambahan (React / Next.js — Opsional)
Jika ingin membuat dashboard halaman kontrol 2D berbasis React/Next.js di folder `frontend/`:
- Telah disediakan panduan struktur di [`frontend/README.md`](file:///d:/ITB2/Lomba/Hackaton/UGREEN_hackaton/frontend/README.md).
- Dapat menggunakan Tailwind CSS + Shadcn UI untuk menampilkan:
  - Tabel matriks paritas interaktif ($G$ dan $G_{\text{sub}}^{-1}$).
  - Komparator *hash* SHA-256 sebelum dan sesudah rekonstruksi.
  - Penampil berkas laporan Markdown [`MISSION_RECOVERY_REPORT.md`](file:///d:/ITB2/Lomba/Hackaton/UGREEN_hackaton/ai_indexer/report_builder.py).

### Prioritas 3: Pengambilan Aset Galeri Devpost (Rasio 3:2)
Untuk submisi Devpost Round 1:
- Buka `http://localhost:8000/3d/`.
- Klik tombol **"💥 Sink Max Safe Drones (4/10 Lost)"** dan amati 4 drone tenggelam.
- Klik **"🚀 RUN NAUTILUS D-NAS RECOVERY"** dan ambil *screenshot* saat kubus matriks holografik 3D berputar di atas kapal UGREEN AI NAS.
- Simpan tangkapan layar beresolusi tinggi dengan rasio **3:2** untuk diunggah ke *Image Gallery* Devpost.

### Prioritas 4: Persiapan Benchmarking Hardware Round 2 (UGOS Pro iDX6011 Pro)
Jika lolos ke Round 2 (30 Finalis), tim akan meminjam hardware fisik UGREEN AI NAS iDX6011 Pro secara remote:
- Menjalankan perintah benchmark bawaan:
  ```bash
  python -m nautilus_rs_codec benchmark --size-kb 10240 -k 6 -m 4
  ```
- Mengukur *throughput* rekontruksi paralel pada RAM 64GB dan NVMe SSD RAID volume.

---

## 🛠️ 6. Cara Menjalankan & Perintah Operasional

### Menjalankan Backend & 3D Command Center:
```powershell
# Di folder root nautilus-d-nas
uvicorn api_server:app --reload --port 8000
```
- Buka visualisasi 3D: `http://localhost:8000/3d/` atau `http://localhost:8000/`
- Dokumentasi Swagger API: `http://localhost:8000/docs`

### Menjalankan Seluruh Test Suite:
```powershell
pytest -v
```

### Menjalankan CLI Reed-Solomon Secara Mandiri:
```powershell
# Benchmark kecepatan
python -m nautilus_rs_codec benchmark --size-kb 1024 -k 6 -m 4

# Encode file
python -m nautilus_rs_codec encode --input my_video.tar --out ./incoming/MISSION-01 -k 6 -m 4

# Decode / Pulihkan file
python -m nautilus_rs_codec decode --manifest ./incoming/MISSION-01/manifest.json --shards ./incoming/MISSION-01 --out ./reconstructed/MISSION-01
```

### Menjalankan Kontainer Docker:
```powershell
docker compose up -d --build
```

---

## 🔒 7. Guardrails & Aturan untuk AI Agent Diky

1. **Pertahankan Integritas Matematika GF(2^8):** Jangan mengganti logika perkalian log/anti-log dan inversi Gauss-Jordan di `nautilus_rs_codec` tanpa menjalankan `pytest -v` untuk memastikan ke-32 tes tetap lulus 100%.
2. **Kepatuhan Submisi Devpost Round 1:** Jangan memasukkan file biner executable (`.exe`, `.dll`) ke dalam root ataupun `skill-package/` agar arsip `nautilus-dnas-sync.zip` tetap bersih dan lolos kurasi otomatis tim juri UGREEN.
3. **Idempotensi & Keamanan NAS:** Setiap proses penulisan file ke volume NAS harus bersifat *idempotent* dan tidak memerlukan eskalasi *root / sudo*.

---

*Selamat berkolaborasi! Nautilus D-NAS kini memiliki pondasi backend dan visualisasi 3D yang sangat kuat untuk memenangkan UGREEN AI NAS Hackathon.*
