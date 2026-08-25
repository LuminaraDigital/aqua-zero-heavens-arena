// src/progress/p2p-webrtc.js
// WebRTC Peer-to-Peer 1v1 Duel networking module for Aqua Zero Heavens Arena
/* =====================================================================
   Aqua Zero Heavens Arena - P2P WebRTC Netcode & Matchmaking Engine
   Luminara Digital - Low-latency zero-dependency 1v1 combat sync
   ===================================================================== */

var P2PNetwork = (function() {
    var pc = null;
    var dataChannel = null;
    var isHost = false;
    var connectionState = "DISCONNECTED"; // DISCONNECTED, CONNECTING, CONNECTED, FAILED
    var matchSeed = null;
    var onMessageCallback = null;
    var onStateChangeCallback = null;

    function safeBtoa(str) {
        if (typeof btoa === "function") return btoa(str);
        if (typeof Buffer !== "undefined") return Buffer.from(str, "utf8").toString("base64");
        return str;
    }

    function safeAtob(b64) {
        if (typeof atob === "function") return atob(b64);
        if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf8");
        return b64;
    }

    var STUN_SERVERS = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" }
        ]
    };

    function setConnectionState(newState) {
        connectionState = newState;
        if (typeof onStateChangeCallback === "function") {
            onStateChangeCallback(connectionState);
        }
    }

    function initPeerConnection() {
        if (pc) {
            close();
        }
        if (typeof RTCPeerConnection === "undefined") {
            console.warn("WebRTC is not supported in this environment");
            return false;
        }

        try {
            pc = new RTCPeerConnection(STUN_SERVERS);
        } catch (e) {
            console.warn("Error creating RTCPeerConnection", e);
            return false;
        }

        pc.oniceconnectionstatechange = function() {
            if (!pc) return;
            if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                setConnectionState("CONNECTED");
            } else if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
                setConnectionState("FAILED");
            }
        };

        return true;
    }

    function setupDataChannel(channel) {
        dataChannel = channel;
        dataChannel.onopen = function() {
            setConnectionState("CONNECTED");
            if (isHost) {
                // Synchronize match RNG seed immediately upon connection
                matchSeed = Math.floor(Math.random() * 1000000);
                send({ type: "SYNC_SEED", seed: matchSeed });
            }
        };
        dataChannel.onclose = function() {
            setConnectionState("DISCONNECTED");
        };
        dataChannel.onmessage = function(event) {
            try {
                var msg = JSON.parse(event.data);
                if (msg && msg.type === "SYNC_SEED") {
                    matchSeed = msg.seed;
                }
                if (typeof onMessageCallback === "function") {
                    onMessageCallback(msg);
                }
            } catch (e) {
                console.error("Failed to parse P2P message", e);
            }
        };
    }

    function createRoom(callback) {
        if (!initPeerConnection()) {
            setConnectionState("FAILED");
            return;
        }
        isHost = true;
        setConnectionState("CONNECTING");

        try {
            dataChannel = pc.createDataChannel("azha_fight_channel");
            setupDataChannel(dataChannel);

            pc.createOffer().then(function(offer) {
                return pc.setLocalDescription(offer);
            }).then(function() {
                pc.onicecandidate = function(e) {
                    if (!e.candidate) {
                        var roomCode = safeBtoa(JSON.stringify(pc.localDescription));
                        if (typeof callback === "function") {
                            callback(roomCode);
                        }
                    }
                };
            }).catch(function(err) {
                console.error("P2P createRoom error", err);
                setConnectionState("FAILED");
            });
        } catch (e) {
            console.error("P2P createDataChannel error", e);
            setConnectionState("FAILED");
        }
    }

    function joinRoom(roomCode, callback) {
        if (!initPeerConnection()) {
            setConnectionState("FAILED");
            return;
        }
        isHost = false;
        setConnectionState("CONNECTING");

        pc.ondatachannel = function(event) {
            setupDataChannel(event.channel);
        };

        try {
            var offerDesc = JSON.parse(safeAtob(roomCode));
            pc.setRemoteDescription(new RTCSessionDescription(offerDesc)).then(function() {
                return pc.createAnswer();
            }).then(function(answer) {
                return pc.setLocalDescription(answer);
            }).then(function() {
                pc.onicecandidate = function(e) {
                    if (!e.candidate) {
                        var answerCode = safeBtoa(JSON.stringify(pc.localDescription));
                        if (typeof callback === "function") {
                            callback(answerCode);
                        }
                    }
                };
            }).catch(function(err) {
                console.error("P2P joinRoom error", err);
                setConnectionState("FAILED");
            });
        } catch (e) {
            console.error("Invalid room code", e);
            setConnectionState("FAILED");
        }
    }

    function acceptAnswer(answerCode) {
        if (!pc || !isHost) return;
        try {
            var answerDesc = JSON.parse(safeAtob(answerCode));
            pc.setRemoteDescription(new RTCSessionDescription(answerDesc));
        } catch (e) {
            console.error("Invalid answer code", e);
        }
    }

    function send(data) {
        if (dataChannel && dataChannel.readyState === "open") {
            dataChannel.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    function close() {
        if (dataChannel) {
            dataChannel.close();
            dataChannel = null;
        }
        if (pc) {
            pc.close();
            pc = null;
        }
        setConnectionState("DISCONNECTED");
    }

    return {
        createRoom: createRoom,
        joinRoom: joinRoom,
        acceptAnswer: acceptAnswer,
        send: send,
        close: close,
        getState: function() { return connectionState; },
        isHost: function() { return isHost; },
        getMatchSeed: function() { return matchSeed; },
        onMessage: function(fn) { onMessageCallback = fn; },
        onStateChange: function(fn) { onStateChangeCallback = fn; }
    };
})();

if (typeof window !== "undefined") {
    window.P2PNetwork = P2PNetwork;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = P2PNetwork;
}
