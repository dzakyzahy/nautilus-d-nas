# 🌐 Nautilus D-NAS 3D Web Visualizer & Frontend Command Center

> **Target Platform:** Web (WebGL / Three.js) & UGREEN UGOS Pro Dashboard  
> **Initial Architecture:** Dzaky Zahy Rabbani  
> **Core Developer & Extensibility:** Diky Dwi Anggara Permadi & Dzaky Zahy Rabbani  

---

## 🌊 Overview

Proyek ini telah dilengkapi dengan **3D Ocean & Swarm Mesh Visualizer** interaktif bergaya *dark-mode cyber-marine glassmorphism* yang memvisualisasikan bagaimana "otak" Nautilus D-NAS bekerja langsung di dunia virtual 3D bawah laut:

1. **Mother Vessel on Surface:** Kapal riset pendukung di permukaan air ($Y = +6.0$) yang menampung server rak fisik **UGREEN AI NAS iDX6011 Pro** dengan kubah data holografik dan indikator LED live.
2. **Marine Swarm Fleet (10 AUVs):**
   - **AUV-01 s/d AUV-06:** Membawa *Data Shards* ($D_0 \dots D_5$) dengan beacon cyan cerah.
   - **AUV-07 s/d AUV-10:** Membawa *Parity Shards* ($P_0 \dots P_3$) dengan beacon ungu/amber.
   - **Dynamic Acoustic Mesh:** Garis komunikasi akustik putus-putus holografik yang menghubungkan antar drone secara peer-to-peer.
3. **Subsea Pipeline & Anomaly Site:** Pipa bawah laut di dasar laut ($Y = -33.2$) dengan cincin hazard merah menyala di lokasi retakan pipa (*hairline micro-fracture*) di koordinat `-8.4521, 115.1245` (kedalaman 872.4m).
4. **Interactive Fault Simulation:**
   - Tombol **"Sink Drones (-2)"** atau **"Sink Max Safe Drones (4/10 Lost)"**: Drone yang terkena musibah mati baling-balingnya, lampu berubah merah, dan tenggelam ke dasar palung laut.
   - Tombol **"Inject Bit-Rot"**: Menyimulasikan kerusakan bit data pada transmisi akustik (lampu menjadi kuning).
5. **Reconstruction & Brain Visualization:**
   - Tombol **"RUN NAUTILUS D-NAS RECOVERY"**:
     - *Phase 1 (Audit)*: Laser akustik ditembakkan dari drone yang selamat ke UGREEN AI NAS. Shard korup diisolasi ke karantina.
     - *Phase 2 (GF($2^8$) Inversion)*: Matriks 3D holografik kubus berputar muncul di atas UGREEN NAS menampilkan proses inversi $D = G_{\text{sub}}^{-1} \cdot S_{\text{sub}}$.
     - *Phase 3 (AI Sonar Sweep)*: Gelombang sonar hijau memancar dari kapal ke dasar laut, mengunci anomali retakan pipa, dan mengaktifkan kartu diagnosa UGREEN AI Knowledge Hub!

---

## 🚀 Cara Menjalankan & Membuka Visualisasi 3D

### Opsi A: Melalui FastAPI Backend (Langsung Terhubung ke Engine Asli)
```bash
# Nyalakan server
uvicorn api_server:app --reload --port 8000
```
Buka browser di:
- **`http://localhost:8000/`** atau **`http://localhost:8000/3d/`**

### Opsi B: Standalone Web / Deploy Langsung (GitHub Pages, Vercel, Netlify)
Berkas di folder `web3d/` bersifat *self-contained*:
- Cukup buka file [`web3d/index.html`](file:///d:/ITB2/Lomba/Hackaton/UGREEN_hackaton/web3d/index.html) langsung dengan klik dua kali (atau gunakan *Live Server* di VS Code).
- Jika backend tidak aktif, visualizer memiliki *built-in client-side mathematical simulator* sehingga tetap dapat berputar, menenggelamkan drone, dan mendemonstrasikan pemulihan 100%!

---

## 🛠️ Panduan Pengembangan Lebih Lanjut untuk Diky

Berikut beberapa rekomendasi area yang dapat kamu kembangkan lebih lanjut:

1. **Model 3D Kustom (GLTF/GLB):**
   - Saat ini drone dan kapal dibuat menggunakan geometri prosedural Three.js berkinerja tinggi. Kamu bisa menggantinya dengan model GLTF/GLB detail (misalnya model AUV Hydroid REMUS atau kapal riset) menggunakan `THREE.GLTFLoader`.
2. **Point Cloud Sonar Bathymetry:**
   - Visualisasikan jutaan titik koordinat kedalaman laut (*multibeam bathymetric point cloud*) saat rekonstruksi selesai menggunakan `THREE.Points`.
3. **Efek Audio Bawah Laut (Web Audio API):**
   - Tambahkan efek suara *sonar ping* saat gelombang sonar memancar, desau air (*underwater ambience*), dan *alarm buzz* saat drone tenggelam.
4. **Migrasi ke React / Next.js (Opsional):**
   - Jika ingin memindahkan ke React / Next.js + Tailwind, seluruh logika state dan Three.js di `web3d/nautilus_3d.js` dapat dengan mudah dipindahkan ke `@react-three/fiber` dan `@react-three/drei`.
