---
name: nautilus-dnas-sync
version: 1.0.0
description: Reconstructs, verifies, and semantically indexes Reed-Solomon erasure-coded telemetry shards from surviving marine drone swarms onto a shipboard UGREEN AI NAS (UGOS Pro) local knowledge hub with 100% offline fault tolerance.
author: Diky Dwi Anggara Permadi, Dzaky Zahy Rabbani
category: Open Innovation / Automate Your Workflow
target_platform: UGREEN AI NAS (UGOS Pro / iDX6011 Pro)
license: MIT
---

# Nautilus D-NAS (`nautilus-dnas-sync`) — Uliya Skill Specification

## 1. Skill Overview & User Goal
**User Goal:** Recover 100% of deep-sea marine drone mission data (sonar, bathymetry, 4K inspection video, and sensor telemetry) onto a shipboard **UGREEN AI NAS** even when up to 40% of the underwater drone swarm sinks or fails during the mission, and automatically index recovered files into the local **UGREEN AI Knowledge Hub** without internet connectivity.

---

## 2. Required & Optional Inputs

| Parameter | Type | Required | Default | Description |
|:---|:---:|:---:|:---|:---|
| `mission_id` | string | **Yes** | — | Unique mission identifier (e.g., `SUBSEA-2026-ALPHA`). |
| `ingest_dir` | path | **Yes** | `/volume1/nautilus_missions/incoming/` | Local UGREEN NAS volume path where surviving drones offload raw shards. |
| `output_dir` | path | **Yes** | `/volume1/nautilus_missions/reconstructed/` | Target NAS directory for reconstructed mission payloads and AI reports. |
| `data_shards_k` | integer | No | `6` | Number of original data shards ($k$) in the Reed-Solomon ($n, k$) scheme. |
| `parity_shards_m` | integer | No | `4` | Number of parity shards ($m$) distributed across the swarm ($n = k + m$). |
| `enable_ai_index` | boolean | No | `true` | Trigger UGREEN AI NAS local multimodal anomaly tagging and Knowledge Hub indexing. |

---

## 3. Supported UGREEN NAS CLI Capabilities & Permissions
- **Filesystem & Volume Scope:** Read/Write restricted strictly to `/volume1/nautilus_missions/`. No root escalation or external network calls required.
- **Supported CLI Utilities:**
  - `find`, `stat`, `ls`: Enumerate incoming `.shard` files and manifest metadata from docked drones.
  - `sha256sum`: Validate cryptographic integrity of individual surviving shards against the swarm manifest.
  - `python3 -m nautilus_rs_codec`: Perform deterministic Vandermonde matrix inversion over Galois Field $GF(2^8)$ when at least $k$ valid shards are present.
  - `ugos-ai-indexer` / **Uliya Local Knowledge Base API**: Register reconstructed video, sonar waterfall plots, and telemetry logs into the local UGREEN AI NAS semantic index.

---

## 4. Agent Workflow Orchestration (Step-by-Step)

### Step 1: Swarm Manifest & Shard Inventory Audit
1. Scan `{{ingest_dir}}/{{mission_id}}/` for `manifest.json` and all uploaded `shard_<index>.bin` files from returning drones.
2. Compute SHA-256 digests for every discovered shard and compare against `manifest.json`.
3. Quarantine any corrupted shard (bit-rot or incomplete acoustic/optical transfer) into `{{ingest_dir}}/{{mission_id}}/quarantine/`.
4. Count valid surviving shards $S_{\text{valid}}$.
   - If $S_{\text{valid}} \ge k$: Proceed to **Step 2**.
   - If $S_{\text{valid}} < k$: Halt reconstruction safely and emit structured alert `ERR_INSUFFICIENT_SHARDS` detailing exact missing shard indices.

### Step 2: Reed-Solomon (n, k) Erasure Reconstruction
1. Select the first $k$ verified shards and construct the corresponding $k \times k$ sub-matrix $G_{\text{sub}}$ from the Vandermonde generator matrix in $GF(2^8)$.
2. Compute matrix inverse $G_{\text{sub}}^{-1}$ and multiply by the surviving shard vector $S_{\text{sub}}$ to recover the original data blocks:
   $$D = G_{\text{sub}}^{-1} \cdot S_{\text{sub}}$$
3. Concatenate reconstructed data blocks into the original mission payload inside `{{output_dir}}/{{mission_id}}/` and verify the master payload SHA-256 checksum.

### Step 3: UGREEN AI NAS Local Multimodal Tagging & Knowledge Hub Indexing
If `enable_ai_index == true`, pass reconstructed inspection media and sensor logs to the UGREEN AI NAS local multimodal pipeline:
1. **Vision Embedding & Anomaly Detection:** Scan subsea video frames and sonar imagery for structural anomalies (pipeline micro-fractures, corrosion, cable abrasion, hydrothermal plumes).
2. **Log Transcription & Summarization:** Parse acoustic modem and IMU anomaly logs into structured Markdown summaries.
3. Write the final mission report to `{{output_dir}}/{{mission_id}}/MISSION_RECOVERY_REPORT.md` and register the folder into the UGREEN AI Knowledge Hub for instant natural-language query by shipboard engineers.

---

## 5. Error Handling, Safety & Guardrails
- **Zero External Dependency:** Operates 100% offline on shipboard LAN; never transmits proprietary subsea telemetry to external cloud endpoints.
- **Bit-Rot Protection:** Corrupted shards are detected via pre-decode SHA-256 verification before matrix inversion, preventing silent corruption of reconstructed video or bathymetric maps.
- **Idempotent Execution:** Re-running `nautilus-dnas-sync` on an already reconstructed `mission_id` verifies existing checksums without overwriting validated archives.

---

## 6. Example Invocation Prompt (Uliya Agent)
> *"Run nautilus-dnas-sync for mission SUBSEA-2026-ALPHA in /volume1/nautilus_missions/incoming/ using Reed-Solomon (k=6, m=4), reconstruct any missing shards from sunken drones, and index detected pipeline anomalies into my UGREEN Knowledge Hub."*
