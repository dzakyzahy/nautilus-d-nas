/**
 * Nautilus D-NAS — P2P Multi-Client Swarm Synchronization Engine
 * Combines BroadcastChannel (sub-millisecond local multi-tab) and
 * WebRTC / Trystero (decentralized multi-device mesh without broker backend).
 */

(function () {
  const PEER_ID = "NODE-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const CHANNEL_NAME = "nautilus_dnas_p2p_mesh";
  let peerCount = 1;
  const activePeers = new Map();

  // Local zero-latency channel for multi-tab sync
  const localChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

  // WebRTC / Trystero room initialization (lazy / resilient fallback)
  let trysteroRoom = null;
  let sendWebRTCAction = null;

  async function initTrystero() {
    try {
      if (window.trystero && window.trystero.nostr) {
        const config = { appId: "nautilus-dnas-ocean", relayUrls: ["wss://relay.damus.io", "wss://nos.lol"] };
        trysteroRoom = window.trystero.nostr.joinRoom(config, "nautilus-mission-bravo");
        const [sendAction, getAction] = trysteroRoom.makeAction("swarm_action");
        sendWebRTCAction = sendAction;

        getAction((data, peerId) => {
          handleIncomingMessage(data, peerId);
        });

        trysteroRoom.onPeerJoin((peerId) => {
          activePeers.set(peerId, Date.now());
          updatePeerBadge();
          if (window.logTerminal) {
            window.logTerminal(`[P2P] Remote research peer connected: ${peerId.substring(0, 8)}`, "info");
          }
        });

        trysteroRoom.onPeerLeave((peerId) => {
          activePeers.delete(peerId);
          updatePeerBadge();
        });
      }
    } catch (e) {
      console.warn("Trystero WebRTC remote mesh initializing in local broadcast fallback mode:", e);
    }
  }

  // Update Topbar Status Pill
  function updatePeerBadge() {
    const total = 1 + activePeers.size;
    const el = document.getElementById("hud-p2p-status");
    if (el) {
      if (total === 1) {
        el.innerHTML = `<span style="color:#10b981;">●</span> 1 PEER (LOCAL)`;
      } else {
        el.innerHTML = `<span style="color:#10b981;">●</span> ${total} PEERS (MESH)`;
      }
    }
  }

  // Handle incoming broadcast message from peers
  function handleIncomingMessage(msg, remotePeerId) {
    if (!msg || msg.sender === PEER_ID) return;

    // Track active peer heartbeat
    const sender = remotePeerId || msg.sender;
    activePeers.set(sender, Date.now());
    updatePeerBadge();

    switch (msg.type) {
      case "HEARTBEAT":
        break;

      case "FAULT_SINK":
        if (typeof window.sinkDrone === "function") {
          window.sinkDrone(msg.droneIndex, true /* isRemote */);
        }
        break;

      case "FAULT_CORRUPT":
        if (typeof window.corruptDroneShard === "function") {
          window.corruptDroneShard(msg.droneIndex, true /* isRemote */);
        }
        break;

      case "SWARM_RESET":
        if (typeof window.resetSwarm === "function") {
          window.resetSwarm(true /* isRemote */);
        }
        break;

      case "TRIGGER_PIPELINE":
        if (typeof window.executeNautilusPipeline === "function") {
          window.executeNautilusPipeline(true /* isRemote */);
        }
        break;

      default:
        break;
    }
  }

  // Broadcast out to local tabs and remote peers
  function broadcastMessage(type, payload = {}) {
    const message = {
      type,
      sender: PEER_ID,
      timestamp: Date.now(),
      ...payload
    };

    // 1. BroadcastChannel (local tabs)
    if (localChannel) {
      localChannel.postMessage(message);
    }

    // 2. WebRTC data channel
    if (sendWebRTCAction) {
      try {
        sendWebRTCAction(message);
      } catch (err) {
        console.warn("P2P send error:", err);
      }
    }
  }

  // Listen to local BroadcastChannel
  if (localChannel) {
    localChannel.onmessage = (event) => {
      handleIncomingMessage(event.data);
    };
  }

  // Heartbeat periodic broadcast (every 4 seconds)
  setInterval(() => {
    broadcastMessage("HEARTBEAT");
    // Prune stale peers (> 10s silent)
    const now = Date.now();
    for (const [peer, lastSeen] of activePeers.entries()) {
      if (now - lastSeen > 10000) {
        activePeers.delete(peer);
      }
    }
    updatePeerBadge();
  }, 4000);

  // Exported P2P API
  window.NautilusP2P = {
    peerId: PEER_ID,
    broadcastSink: (droneIndex) => broadcastMessage("FAULT_SINK", { droneIndex }),
    broadcastCorrupt: (droneIndex) => broadcastMessage("FAULT_CORRUPT", { droneIndex }),
    broadcastReset: () => broadcastMessage("SWARM_RESET"),
    broadcastPipeline: () => broadcastMessage("TRIGGER_PIPELINE"),
    getPeerCount: () => 1 + activePeers.size
  };

  // Initialize once DOM is ready
  window.addEventListener("DOMContentLoaded", () => {
    updatePeerBadge();
    initTrystero();
    if (window.logTerminal) {
      window.logTerminal(`[P2P] Multi-Client Swarm Mesh initialized (${PEER_ID}). Listening for peers.`, "info");
    }
  });
})();
