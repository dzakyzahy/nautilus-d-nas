---
name: nautilus-dnas-sync
version: 1.0.0
description: Reconstructs and indexes Reed-Solomon erasure-coded telemetry shards from returning marine drone swarms onto a shipboard UGREEN AI NAS (UGOS Pro) local knowledge hub offline.
author: Diky Dwi Anggara Permadi, Dzaky Zahy Rabbani
category: Open Innovation / Automate Your Workflow
target_platform: UGREEN AI NAS (UGOS Pro / iDX6011 Pro)
license: MIT
---

# Nautilus D-NAS (`nautilus-dnas-sync`): Uliya Skill Specification

## 1. Skill Overview & User Goal
User Goal: Recover deep-sea marine drone survey data (sonar, bathymetry, 4K video, sensor telemetry) onto a shipboard UGREEN AI NAS even when up to 40% of the underwater drone swarm fails during a mission, and index recovered files into the local UGREEN AI Knowledge Hub without internet access.

---

## 2. Required & Optional Inputs

| Parameter | Type | Required | Default | Description |
|:---|:---:|:---:|:---|:---|
| `mission_id` | string | Yes | — | Mission identifier (e.g., `SUBSEA-2026-ALPHA`). |
| `ingest_dir` | path | Yes | `/volume1/nautilus_missions/incoming/` | NAS directory where returning drones offload raw shards. |
| `output_dir` | path | Yes | `/volume1/nautilus_missions/reconstructed/` | Target directory for recovered payloads and inspection reports. |
| `data_shards_k` | integer | No | `6` | Number of original data shards in the Reed-Solomon scheme. |
| `parity_shards_m` | integer | No | `4` | Number of parity shards distributed across the swarm. |
| `enable_ai_index` | boolean | No | `true` | Runs local anomaly tagging and Knowledge Hub indexing. |

---

## 3. Supported UGREEN NAS CLI Capabilities & Permissions
- Filesystem scope: read and write access restricted to `/volume1/nautilus_missions/`. No root escalation or external network calls required.
- Supported CLI tools:
  - `find`, `stat`, `ls`: locate incoming `.shard` files and manifest metadata from docked drones.
  - `sha256sum`: verify cryptographic checksums of individual shards against `manifest.json`.
  - `python3 -m nautilus_rs_codec`: run Vandermonde matrix inversion over Galois Field $GF(2^8)$ when at least $k$ valid shards are present.
  - `ugos-ai-indexer` / Uliya Local Knowledge Base API: register reconstructed video, sonar plots, and telemetry into the local semantic index.

---

## 4. Agent Workflow Orchestration

### Step 1: Swarm Manifest & Shard Inventory Audit
1. Scan `{{ingest_dir}}/{{mission_id}}/` for `manifest.json` and all uploaded `shard_<index>.bin` files from docked drones.
2. Compute SHA-256 digests for each discovered shard and compare against `manifest.json`.
3. Move any corrupted shard into `{{ingest_dir}}/{{mission_id}}/quarantine/`.
4. Count valid surviving shards $S_{\text{valid}}$.
   - If $S_{\text{valid}} \ge k$: proceed to Step 2.
   - If $S_{\text{valid}} < k$: stop reconstruction and return structured error `ERR_INSUFFICIENT_SHARDS` with the list of missing shard indices.

### Step 2: Reed-Solomon (n, k) Erasure Reconstruction
1. Select the first $k$ verified shards and build the corresponding $k \times k$ sub-matrix $G_{\text{sub}}$ from the Vandermonde generator matrix in $GF(2^8)$.
2. Calculate the matrix inverse $G_{\text{sub}}^{-1}$ and multiply by the surviving shard vector $S_{\text{sub}}$ to recover original data blocks:
   $$D = G_{\text{sub}}^{-1} \cdot S_{\text{sub}}$$
3. Assemble reconstructed blocks into the original mission payload in `{{output_dir}}/{{mission_id}}/` and verify the master payload SHA-256 checksum.

### Step 3: Local Multimodal Tagging & Knowledge Hub Indexing
If `enable_ai_index == true`, pass reconstructed media and logs to the local UGOS Pro AI pipeline:
1. Scan subsea video frames and sonar imagery for structural anomalies such as pipeline micro-fractures, corrosion, cable wear, or hydrothermal plumes.
2. Parse acoustic modem and IMU logs into structured summaries.
3. Save the final report to `{{output_dir}}/{{mission_id}}/MISSION_RECOVERY_REPORT.md` and register the folder into the UGREEN AI Knowledge Hub for local search.

---

## 5. Error Handling, Safety & Guardrails
- Operates offline on the shipboard LAN without sending telemetry to external endpoints.
- Detects corrupt shards via pre-decode SHA-256 verification before matrix inversion, preventing silent data corruption.
- Idempotent execution: re-running `nautilus-dnas-sync` on an existing `mission_id` checks existing checksums without overwriting valid data.

---

## 6. Example Invocation Prompt
> "Run nautilus-dnas-sync for mission SUBSEA-2026-ALPHA in /volume1/nautilus_missions/incoming/ using Reed-Solomon (k=6, m=4), reconstruct missing shards from sunken drones, and index detected pipeline anomalies into my UGREEN Knowledge Hub."
