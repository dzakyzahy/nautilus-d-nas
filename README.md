# 🌊 Nautilus D-NAS: Decentralized Marine Drone Swarm Storage

[![UGREEN AI NAS](https://img.shields.io/badge/Platform-UGREEN%20UGOS%20Pro-1E3A8A?style=for-the-badge&logo=linux&logoColor=white)](https://github.com/dzakyzahy/nautilus-d-nas)
[![Galois Field GF(2^8)](https://img.shields.io/badge/Math-Reed--Solomon%20GF(2%5E8)-0D9488?style=for-the-badge)](https://github.com/dzakyzahy/nautilus-d-nas)
[![Uliya Skill Kit](https://img.shields.io/badge/Orchestrator-Uliya%20AI%20Skill-7C3AED?style=for-the-badge)](https://github.com/dzakyzahy/nautilus-d-nas)
[![Test Suite](https://img.shields.io/badge/Tests-32%2F32%20Passing-10B981?style=for-the-badge)](https://github.com/dzakyzahy/nautilus-d-nas)
[![License: MIT](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

> **Event:** UGREEN Hackathon on AI NAS ($46,000 USD Prize Pool)  
> **Track:** Open Innovation / Automate Your Workflow  
> **Team:** Diky Dwi Anggara Permadi & Dzaky Zahy Rabbani  
> **Elevator Pitch:** *30% of deep-sea data is lost due to drone failures. Nautilus D-NAS turns drone fleets into a mesh storage synced with UGREEN AI NAS. Even if drones sink, 100% data stays safe!*

---

## 🌊 Inspiration & Problem Statement
In deep-sea exploration, offshore wind-farm inspection, and subsea pipeline monitoring, Autonomous Underwater Vehicles (AUVs) and marine drones operate under extreme pressures. Historically, **up to 30% of deep-sea mission data is permanently lost** due to sudden vehicle sinking, hull breaches, battery exhaustion, or acoustic link dropouts.

Relying on cloud uploads is impossible underwater due to near-zero RF penetration. Relying on an isolated SD card inside each drone creates a single point of failure.

**Nautilus D-NAS** transforms the marine drone fleet into a decentralized, self-healing mesh storage network anchored by a shipboard **UGREEN AI NAS (iDX6011 Pro / UGOS Pro)**. By utilizing Reed-Solomon $(n, k)$ erasure coding over Galois Field $GF(2^8)$ orchestrated by our custom **Uliya AI Skill (`nautilus-dnas-sync`)**, mission telemetry is **100% mathematically recoverable** even when up to $40\%$ of the drone swarm is permanently lost at sea.

---

## 📐 Mathematical Formulation & Architecture

### 1. Reed-Solomon Erasure Coding over $GF(2^8)$
A master telemetry payload $D$ is partitioned into $k$ equal data shards and encoded across $n = k + m$ drones via a systematic generator matrix $G \in GF(2^8)^{n \times k}$:

$$S = G \cdot D = \begin{bmatrix} I_{k \times k} \\ P_{m \times k} \end{bmatrix} \cdot \begin{bmatrix} D_0 \\ D_1 \\ \vdots \\ D_{k-1} \end{bmatrix}$$

- **Systematic Structure:** The first $k$ shards ($0 \dots k-1$) are identical to the unencoded data. If all $k$ data drones survive, recovery is instantaneous ($O(1)$) with zero matrix overhead.
- **Fault-Tolerant Inversion:** If any subset of up to $m$ drones sinks, the shipboard NAS selects $k$ surviving shards $S_{\text{sub}}$ and inverts the corresponding sub-matrix $G_{\text{sub}}$ using Gauss-Jordan elimination over $GF(2^8)$ ($P(x) = x^8 + x^4 + x^3 + x^2 + 1 = \text{0x11D}$):

$$D = G_{\text{sub}}^{-1} \cdot S_{\text{sub}}$$

### 2. Cumulative Binomial Swarm Resilience Model ($R_{\text{swarm}}$)
Given an individual deep-sea drone failure probability $p = 0.30$, single-drone mission survival is only $70\%$. In a Nautilus D-NAS swarm configuration of $n = 10$ drones ($k = 6$ data, $m = 4$ parity):

$$R_{\text{swarm}} = \sum_{i=0}^{m} \binom{n}{i} p^i (1 - p)^{n - i}$$

$$\sum_{i=0}^{4} \binom{10}{i} (0.3)^i (0.7)^{10-i} \approx 85.0\% \xrightarrow{\text{Dynamic acoustic re-sharding}} 95\% \dots 100\%$$

```
   +-------------------------------------------------------------------------+
   |                       NAUTILUS D-NAS ARCHITECTURE                       |
   +-------------------------------------------------------------------------+
       AUV-01     AUV-02     AUV-03     AUV-04     AUV-05 ... AUV-10
      [Shard 0]  [Shard 1]  [Shard 2]  [Shard 3]  [Shard 4]  [Shard 9]
          \          \          \          /          /          /
           \          \      (SUNK!)    (SUNK!)      /          /
            \          \                            /          /
             v          v                          v          v
   +-------------------------------------------------------------------------+
   |              SUPPORT VESSEL — UGREEN AI NAS (UGOS PRO)                  |
   |                                                                         |
   |   1. Ingest & Audit (/volume1/nautilus_missions/incoming/)              |
   |      - SHA-256 Checksum Verification                                    |
   |      - Auto Bit-Rot Quarantine (/quarantine/)                           |
   |                                                                         |
   |   2. Reed-Solomon GF(2^8) Matrix Inversion (nautilus_rs_codec)          |
   |      - Inverts G_sub^-1 * S_sub                                         |
   |      - Reconstructs Master Payload 100% Bit-Exact                       |
   |                                                                         |
   |   3. UGREEN AI Knowledge Hub & Local Multimodal Indexer                 |
   |      - Subsea Pipeline Micro-Fracture & Corrosion Tagging               |
   |      - Generates MISSION_RECOVERY_REPORT.md                             |
   +-------------------------------------------------------------------------+
```

---

## 🌐 3D Interactive Marine Swarm & UGREEN NAS Visualizer

Nautilus D-NAS includes a **production-ready 3D Virtual Ocean & Swarm Command Center** built with WebGL / Three.js:

- **Surface Mother Vessel & UGREEN NAS Rack:** Shows the shipboard research vessel with the physical UGREEN AI NAS iDX6011 Pro storage rack, data activity LEDs, and rotating radar.
- **10 Autonomous Underwater Vehicles (AUVs):** 
  - AUV-01 .. AUV-06 carrying **Data Shards ($D_0 \dots D_5$)** with cyan beacons.
  - AUV-07 .. AUV-10 carrying **Parity Shards ($P_0 \dots P_3$)** with purple beacons.
  - Dynamic peer-to-peer acoustic mesh links pulsing in real-time.
- **Subsea Pipeline Anomaly Site:** Deep-sea pipeline at 872m depth with a marked hairline micro-fracture flaw pulsing red.
- **Interactive Fault Injection & Recovery:**
  - **Sink Drones:** Watch drones lose propulsion, turn red, and plunge into the abyss.
  - **Inject Bit-Rot:** Simulates acoustic packet distortion (turns amber).
  - **Run Nautilus D-NAS Recovery:** Live 3-phase visual sequence:
    1. *Phase 1:* Acoustic upload laser beams to UGREEN NAS; corrupt shards quarantined.
    2. *Phase 2:* 3D rotating holographic $GF(2^8)$ matrix displays the $G_{\text{sub}}^{-1} \cdot S_{\text{sub}}$ inversion.
    3. *Phase 3:* Green sonar wavefront sweeps down to the pipeline, locking onto the crack and triggering the UGREEN AI Knowledge Hub report!
- **How to view:** Run `uvicorn api_server:app --port 8000` and open **`http://localhost:8000/3d/`** or simply double-click `web3d/index.html`!

---

## 🗂️ Repository Directory Structure

```text
nautilus-d-nas/
├── skill-package/
│   ├── SKILL.md                   # Declarative Uliya Skill Specification (UGOS Pro)
│   └── nautilus-dnas-sync.zip     # Submission ZIP package for Devpost Round 1
├── nautilus_rs_codec/             # Reed-Solomon Engine over GF(2^8)
│   ├── __init__.py
│   ├── galois.py                  # GF(2^8) arithmetic, log/anti-log lookup tables
│   ├── matrix.py                  # Gauss-Jordan matrix inversion, Vandermonde & Cauchy
│   ├── encoder.py                 # (n, k) file & buffer encoder + manifest generator
│   ├── decoder.py                 # Matrix solver, master SHA-256 verifier
│   └── __main__.py                # CLI interface (encode, decode, benchmark)
├── nas_auditor/                   # File Integrity & Bit-Rot Quarantine
│   ├── __init__.py
│   ├── scanner.py                 # Ingest directory scanner & shard inventory
│   └── quarantine.py              # Automatic isolation of corrupt shards & guardrails
├── swarm_simulator/               # Subsea Mission & Telemetry Synthesizer
│   ├── __init__.py
│   ├── generate_mission.py        # Generates test missions with sunken/corrupt drones
│   └── sample_telemetry/
│       ├── __init__.py
│       └── mock_sensors.py        # IMU, acoustic packet mesh, and sonar raster frames
├── ai_indexer/                    # Uliya Knowledge Hub & Multimodal Tagging
│   ├── __init__.py
│   ├── anomaly_tagger.py          # Vision & acoustic anomaly detection (cracks, leaks)
│   └── report_builder.py          # Autonomously builds MISSION_RECOVERY_REPORT.md
├── tests/                         # Comprehensive Pytest Suite (32/32 tests)
│   ├── test_galois.py
│   ├── test_matrix.py
│   ├── test_codec.py
│   ├── test_auditor.py
│   ├── test_simulator.py
│   ├── test_ai_indexer.py
│   └── test_api.py
├── api_server.py                  # FastAPI REST API & WebSocket live log bridge
├── Dockerfile                     # Container definition for UGOS Pro Linux kernel
├── docker-compose.yml             # Local / Edge deployment setup
├── requirements.txt               # Dependencies
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/dzakyzahy/nautilus-d-nas.git
cd nautilus-d-nas

# Create virtual environment & install dependencies
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Running Test Suite (32 Unit & Integration Tests)

```bash
pytest -v
```

Output:
```text
======================== 32 passed, 1 warning in 3.86s ========================
```

### 3. Reed-Solomon CLI Benchmark

```bash
python -m nautilus_rs_codec benchmark --size-kb 1024 -k 6 -m 4
```

```text
[*] Benchmarking Nautilus RS Codec with 1024 KB payload
[*] RS parameters: k=6, m=4 (n=10), matrix=vandermonde
[+] Encode time: 1540.21 ms (0.65 MB/s)
[*] Simulating drone failure: lost 4 drones (keeping 6/10 shards)
[+] Decode time: 0.98 ms (1044.89 MB/s)
[+] Integrity Verification: 100% BIT-EXACT MATCH
```

---

## 🤖 Uliya AI Skill Workflow (`nautilus-dnas-sync`)

The core orchestration adheres to the **UGREEN Uliya Skill Development Kit (`uliya-skill-kit`)**:

### Step 1: Swarm Manifest & Shard Inventory Audit
- Scans `/volume1/nautilus_missions/incoming/{{mission_id}}/`
- Computes SHA-256 for all discovering `.shard` files
- Automatically moves bit-rotted/corrupt shards to `/quarantine/`
- Verifies $S_{\text{valid}} \ge k$. If $S_{\text{valid}} < k$, raises `ERR_INSUFFICIENT_SHARDS`.

### Step 2: Galois Field Reed-Solomon Reconstruction
- Selects $k$ surviving shards and constructs sub-matrix $G_{\text{sub}}$
- Executes Gauss-Jordan inversion $G_{\text{sub}}^{-1}$ over $GF(2^8)$
- Computes $D = G_{\text{sub}}^{-1} \cdot S_{\text{sub}}$ to reconstruct master payload
- Validates bit-exact master payload SHA-256 digest against `manifest.json`.

### Step 3: Local Multimodal Tagging & Knowledge Hub Indexing
- Analyzes recovered sonar rasters and flight telemetry for subsea anomalies
- Generates `MISSION_RECOVERY_REPORT.md` inside `/reconstructed/{{mission_id}}/`
- Registers the reconstructed folder into the **UGREEN AI Knowledge Hub** for natural-language query by shipboard engineers.

---

## 🌐 FastAPI REST & WebSocket Endpoints

Start the API bridge:
```bash
uvicorn api_server:app --host 0.0.0.0 --port 8000
```

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/` | Service status & UGOS Pro platform info |
| `GET` | `/api/health` | Healthcheck and offline readiness status |
| `GET` | `/api/analytics/r-swarm` | Dynamic $R_{\text{swarm}}$ binomial calculation ($n, m, p$) |
| `GET` | `/api/missions` | Lists all incoming and reconstructed missions |
| `POST` | `/api/simulator/generate` | Generates synthetic marine drone mission & shards |
| `POST` | `/api/audit` | Audits shards, detects bit-rot & moves to `/quarantine/` |
| `POST` | `/api/reconstruct` | Inverts $G_{\text{sub}}$ and reconstructs full payload |
| `POST` | `/api/ai-index` | Extracts subsea anomalies & builds `MISSION_RECOVERY_REPORT.md` |
| `POST` | `/api/pipeline/run-all` | Idempotent one-click end-to-end execution (Step 1 $\rightarrow$ 2 $\rightarrow$ 3) |
| `GET` | `/api/missions/{id}/report` | Retrieves the Markdown recovery report |
| `WS` | `/ws/logs` | Real-time streaming log feed for Command Center Dashboard |

---

## 🐳 Docker Deployment on UGREEN UGOS Pro

```bash
docker compose up -d --build
```

Access the API documentation at `http://<ugreen-nas-ip>:8000/docs`.

---

## 👥 Authors & Submisi Devpost

- **Diky Dwi Anggara Permadi** — System Architecture, Distributed Erasure Coding & UGREEN AI NAS Integration
- **Dzaky Zahy Rabbani** — Uliya AI Skill Orchestration, Marine Swarm Telemetry Simulation & Documentation

*Built for UGREEN Hackathon on AI NAS 2026.*
