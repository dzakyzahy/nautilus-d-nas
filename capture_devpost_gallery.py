import os
import sys
import time
import threading
import urllib.request
from playwright.sync_api import sync_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

repo_root = r"d:\AI Project\Nautilus\nautilus-d-nas"
sys.path.insert(0, repo_root)
os.chdir(repo_root)

output_dir = r"d:\AI Project\Nautilus\assets\devpost"
os.makedirs(output_dir, exist_ok=True)

PORT = 8888
import uvicorn
from api_server import app

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()

print(f"[1/6] Waiting for FastAPI server on http://127.0.0.1:{PORT}/ ...", flush=True)
ready = False
for _ in range(30):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/health", timeout=1) as resp:
            if resp.status == 200:
                ready = True
                break
    except Exception:
        time.sleep(0.5)

if not ready:
    print("ERROR: FastAPI server failed to start within timeout.")
    sys.exit(1)

print(f"[2/6] Server ONLINE on port {PORT}! Launching Playwright browser (1500x1000 3:2 ratio)...", flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1500, "height": 1000},
        device_scale_factor=2
    )
    page = context.new_page()

    print("[*] Navigating to /3d/ ...", flush=True)
    page.goto(f"http://127.0.0.1:{PORT}/3d/", wait_until="domcontentloaded")
    page.wait_for_selector("#canvas-container", timeout=15000)
    time.sleep(3.5)

    # Shot 1: Wide Patrol with AUV Fleet & Bathymetric Sonar
    shot1_path = os.path.join(output_dir, "01_nautilus_fleet_patrol_3d.png")
    page.screenshot(path=shot1_path)
    print(f"[3/6] Saved Shot 1: {shot1_path}", flush=True)

    # Shot 2: Subsea Pipeline Crack & Anomaly View
    page.click('button.cam-btn[data-view="pipeline"]')
    time.sleep(2.5)
    shot2_path = os.path.join(output_dir, "02_pipeline_crack_anomaly_view.png")
    page.screenshot(path=shot2_path)
    print(f"[4/6] Saved Shot 2: {shot2_path}", flush=True)

    # Shot 3: Return to Orbit & Simulate Shard Loss
    page.click('button.cam-btn[data-view="orbit"]')
    time.sleep(1.0)
    page.click("#btn-sink-max")
    time.sleep(2.5)
    shot3_path = os.path.join(output_dir, "03_shard_audit_hull_breach_alert.png")
    page.screenshot(path=shot3_path)
    print(f"[5/6] Saved Shot 3: {shot3_path}", flush=True)

    # Shot 4: Trigger Reed-Solomon Recovery Pipeline (3D Hologram Rotation)
    page.click("#btn-run-pipeline")
    time.sleep(4.0)
    shot4_path = os.path.join(output_dir, "04_reed_solomon_matrix_recovery.png")
    page.screenshot(path=shot4_path)
    print(f"[*] Saved Shot 4: {shot4_path}", flush=True)

    # Shot 5: Wait for 100% Recovery & AI Indexing completion
    time.sleep(5.0)
    shot5_path = os.path.join(output_dir, "05_ai_knowledge_hub_indexed_100pct.png")
    page.screenshot(path=shot5_path)
    print(f"[*] Saved Shot 5: {shot5_path}", flush=True)

    # Shot 6: Open Mission Anomaly Report Modal
    page.click("#btn-toggle-report")
    time.sleep(2.0)
    shot6_path = os.path.join(output_dir, "06_mission_recovery_report_modal.png")
    page.screenshot(path=shot6_path)
    print(f"[6/6] Saved Shot 6: {shot6_path}", flush=True)

    browser.close()

print("\nSUCCESS: All 6 Devpost Gallery Screenshots generated at 1500x1000 (3:2 ratio)!")
