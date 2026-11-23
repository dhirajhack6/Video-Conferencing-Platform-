import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Snackbar from "@mui/material/Snackbar";
import { io } from "socket.io-client";
import styles from "../style/videoComponent.module.css";

import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import CallEndIcon from "@mui/icons-material/CallEnd";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import servers from "../environment";

const server_url = servers;

const peerConfigConnections = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function RemoteVideo({ stream, socketId }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.log("Remote video autoplay blocked:", err);
      });
    }
  }, [stream]);

  return (
    <div className={styles.videoCard}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={styles.userVideo}
      />
      <div className={styles.videoLabel}>
        Participant ({socketId.substring(0, 5)})
      </div>
    </div>
  );
}

export default function VideoMeetComponent() {
  const navigate = useNavigate();
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const connectionsRef = useRef({});
  const iceCandidateQueue = useRef({});

  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);
  const [showModal, setModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [videos, setVideos] = useState([]);
  const [connected, setConnected] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");

  const { url } = useParams();

  const silence = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      oscillator.connect(dst);
      oscillator.start();
      ctx.resume();
      return dst.stream.getAudioTracks()[0];
    } catch (e) {
      return null;
    }
  };

  const black = ({ width = 640, height = 480 } = {}) => {
    try {
      const canvas = Object.assign(document.createElement("canvas"), { width, height });
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, width, height);

      let animId;
      const draw = () => {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);
        animId = requestAnimationFrame(draw);
      };
      animId = requestAnimationFrame(draw);

      const stream = canvas.captureStream(25);
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.onended = () => cancelAnimationFrame(animId);
      }
      return track;
    } catch (e) {
      return null;
    }
  };

  const blackSilence = () => {
    const b = black();
    const s = silence();
    const tracks = [];
    if (b) tracks.push(b);
    if (s) tracks.push(s);
    return new MediaStream(tracks);
  };

  const getPermissions = async () => {
    let hasVideo = false;
    let hasAudio = false;

    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      hasVideo = true;
    } catch (error) {
      console.log("Camera access not available:", error);
    }

    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      hasAudio = true;
    } catch (error) {
      console.log("Audio access not available:", error);
    }

    setVideoAvailable(hasVideo);
    setAudioAvailable(hasAudio);
    setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);

    if (hasVideo || hasAudio) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: hasVideo,
          audio: hasAudio,
        });
        window.localStream = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Media stream error:", error);
        window.localStream = blackSilence();
      }
    } else {
      window.localStream = blackSilence();
    }
  };

  useEffect(() => {
    getPermissions();
    return () => {
      window.localStream?.getTracks().forEach((t) => t.stop());
      Object.values(connectionsRef.current).forEach((pc) => pc.close());
      connectionsRef.current = {};
    };
  }, []);

  const createPeerConnection = (socketListId) => {
    if (socketListId === socketIdRef.current) {
      return null;
    }

    if (connectionsRef.current[socketListId]) {
      return connectionsRef.current[socketListId];
    }

    console.log("[WebRTC] Creating peer connection for:", socketListId);
    const pc = new RTCPeerConnection(peerConfigConnections);

    pc.onicecandidate = (event) => {
      if (event.candidate != null) {
        socketRef.current?.emit(
          "signal",
          socketListId,
          JSON.stringify({ ice: event.candidate })
        );
      }
    };

    pc.ontrack = (event) => {
      console.log("[WebRTC] Received remote track from:", socketListId, event.track.kind);
      const incomingStream =
        event.streams && event.streams[0]
          ? event.streams[0]
          : new MediaStream([event.track]);

      setVideos((prevVideos) => {
        const index = prevVideos.findIndex((v) => v.socketId === socketListId);
        if (index !== -1) {
          const existingStream = prevVideos[index].stream;
          if (existingStream && !existingStream.getTracks().some((t) => t.id === event.track.id)) {
            existingStream.addTrack(event.track);
          }
          return [...prevVideos];
        } else {
          return [...prevVideos, { socketId: socketListId, stream: incomingStream }];
        }
      });
    };

    if (window.localStream) {
      window.localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, window.localStream);
        } catch (e) {
          console.error("Error adding track to peer:", e);
        }
      });
    }

    connectionsRef.current[socketListId] = pc;
    return pc;
  };

  const gotMessageFromServer = (fromId, msg) => {
    const signal = JSON.parse(msg);

    if (fromId === socketIdRef.current) return;

    let pc = connectionsRef.current[fromId];
    if (!pc) {
      pc = createPeerConnection(fromId);
    }
    if (!pc) return;

    if (signal.sdp) {
      console.log("[WebRTC] Received SDP:", signal.sdp.type, "from:", fromId);
      pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => {
          // Flush any buffered ICE candidates
          if (iceCandidateQueue.current[fromId]) {
            iceCandidateQueue.current[fromId].forEach((cand) => {
              pc.addIceCandidate(cand).catch((e) =>
                console.error("Error adding queued candidate:", e)
              );
            });
            delete iceCandidateQueue.current[fromId];
          }

          if (signal.sdp.type === "offer") {
            return pc.createAnswer().then((description) => {
              return pc.setLocalDescription(description).then(() => {
                socketRef.current?.emit(
                  "signal",
                  fromId,
                  JSON.stringify({ sdp: pc.localDescription })
                );
              });
            });
          }
        })
        .catch((e) => console.error("Error handling SDP signal:", e));
    }

    if (signal.ice) {
      const candidate = new RTCIceCandidate(signal.ice);
      if (pc.remoteDescription && pc.remoteDescription.type) {
        pc.addIceCandidate(candidate).catch((e) =>
          console.error("Error adding ICE candidate directly:", e)
        );
      } else {
        if (!iceCandidateQueue.current[fromId]) {
          iceCandidateQueue.current[fromId] = [];
        }
        iceCandidateQueue.current[fromId].push(candidate);
      }
    }
  };

  const connectToSocketServer = () => {
    console.log("[Socket] Connecting to:", server_url);
    socketRef.current = io.connect(server_url, { secure: false });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      console.log("[Socket] Connected with ID:", socketRef.current.id);
      setConnected(true);
      socketIdRef.current = socketRef.current.id;

      // Join the clean URL/meeting code
      socketRef.current.emit("join-call", url);

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", (id) => {
        console.log("[Socket] User left:", id);
        if (connectionsRef.current[id]) {
          try {
            connectionsRef.current[id].close();
          } catch (e) {}
          delete connectionsRef.current[id];
        }
        delete iceCandidateQueue.current[id];
        setVideos((prevVideos) => prevVideos.filter((v) => v.socketId !== id));
      });

      socketRef.current.on("user-joined", (id, clients) => {
        console.log("[Socket] user-joined event. New user:", id, "All clients in room:", clients);

        clients.forEach((socketListId) => {
          if (socketListId !== socketIdRef.current) {
            createPeerConnection(socketListId);
          }
        });

        // The newly joined participant initiates offers to existing participants
        if (id === socketIdRef.current) {
          for (let id2 in connectionsRef.current) {
            if (id2 === socketIdRef.current) continue;
            const pc = connectionsRef.current[id2];
            if (pc) {
              console.log("[WebRTC] Creating offer to:", id2);
              pc.createOffer()
                .then((description) => pc.setLocalDescription(description))
                .then(() => {
                  socketRef.current?.emit(
                    "signal",
                    id2,
                    JSON.stringify({ sdp: pc.localDescription })
                  );
                })
                .catch((e) => console.error("Error creating offer:", e));
            }
          }
        }
      });
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("[Socket] Connection failed:", error.message);
      setConnected(false);
    });
  };

  const getUserMediaSuccess = (stream) => {
    try {
      window.localStream?.getTracks().forEach((track) => track.stop());
    } catch (e) {}

    window.localStream = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    // Replace tracks in existing peer connections
    for (let id in connectionsRef.current) {
      const pc = connectionsRef.current[id];
      if (!pc) continue;

      const senders = pc.getSenders ? pc.getSenders() : [];
      stream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          try {
            pc.addTrack(track, stream);
          } catch (e) {
            console.error(e);
          }
        }
      });
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false);
        setAudio(false);
        const blackSilenceStream = blackSilence();
        window.localStream = blackSilenceStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = window.localStream;
        }
      };
    });
  };

  const getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .catch((e) => console.log(e));
    }
  };

  useEffect(() => {
    if (!askForUsername && video !== undefined && audio !== undefined) {
      getUserMedia();
    }
  }, [audio, video]);

  const handleAudio = () => {
    setAudio(!audio);
    if (window.localStream) {
      window.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !audio;
      });
    }
  };

  const handleVideo = () => {
    setVideo(!video);
    if (window.localStream) {
      window.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !video;
      });
    }
  };

  const getDisplayMediaSuccess = (stream) => {
    window.localStream = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const screenVideoTrack = stream.getVideoTracks()[0];
    for (let id in connectionsRef.current) {
      const pc = connectionsRef.current[id];
      if (!pc) continue;

      const senders = pc.getSenders ? pc.getSenders() : [];
      const videoSender = senders.find((s) => s.track && s.track.kind === "video");
      if (videoSender && screenVideoTrack) {
        videoSender.replaceTrack(screenVideoTrack);
      }
    }

    if (screenVideoTrack) {
      screenVideoTrack.onended = () => {
        setScreen(false);
        getUserMedia();
      };
    }
  };

  const getDisplayMedia = () => {
    if (screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(getDisplayMediaSuccess)
          .catch((e) => {
            console.log(e);
            setScreen(false);
          });
      }
    }
  };

  useEffect(() => {
    if (screen !== undefined) {
      getDisplayMedia();
    }
  }, [screen]);

  const handleScreen = () => {
    setScreen(!screen);
  };

  const handleEndCall = () => {
    try {
      window.localStream?.getTracks().forEach((track) => track.stop());
    } catch (e) {}

    for (let id in connectionsRef.current) {
      try {
        connectionsRef.current[id].close();
      } catch (e) {}
    }
    connectionsRef.current = {};

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    navigate("/home");
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: sender, data: data },
    ]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages((prevNew) => prevNew + 1);
    }
  };

  const sendMessage = () => {
    if (message.trim()) {
      socketRef.current?.emit("chat-message", message.trim(), username || "User");
      setMessage("");
    }
  };

  const connect = () => {
    setAskForUsername(false);
    if (!window.localStream) {
      window.localStream = blackSilence();
    }
    connectToSocketServer();
  };

  const copyMeetingUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setSnackMsg("Meeting link copied to clipboard!");
    setSnackOpen(true);
  };

  return (
    <div>
      {askForUsername ? (
        <div className={styles.lobbyContainer}>
          <div className={styles.lobbyCard}>
            <h2 style={{ margin: 0, color: "#1a73e8", fontWeight: 600 }}>Enter Lobby</h2>
            <p style={{ color: "#5f6368", margin: "4px 0 16px 0" }}>
              Meeting ID: <strong>{url}</strong>
            </p>

            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={styles.lobbyVideoPreview}
            />

            <TextField
              id="outlined-basic"
              label="Your Name / Username"
              value={username}
              fullWidth
              variant="outlined"
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") connect();
              }}
            />

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={connect}
              sx={{ py: 1.5, fontSize: "1rem" }}
            >
              Join Meeting
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          <header className={styles.meetingHeader}>
            <div className={styles.meetingInfo}>
              <span>Meeting: {url}</span>
              <IconButton size="small" onClick={copyMeetingUrl} sx={{ color: "white" }} title="Copy Meeting Link">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </div>
            <div style={{ fontSize: "0.9rem", color: "#dadce0" }}>
              Participants: {videos.length + 1}
            </div>
          </header>

          <main className={styles.videoGrid}>
            <div className={styles.videoCard}>
              <video
                ref={(el) => {
                  if (el && window.localStream && el.srcObject !== window.localStream) {
                    el.srcObject = window.localStream;
                  }
                }}
                autoPlay
                muted
                playsInline
                className={styles.userVideo}
              />
              <div className={styles.videoLabel}>You ({username || "Me"})</div>
            </div>

            {videos.map((item) => (
              <RemoteVideo
                key={item.socketId}
                socketId={item.socketId}
                stream={item.stream}
              />
            ))}
          </main>

          <footer className={styles.controlsBar}>
            <IconButton
              onClick={handleAudio}
              className={audio ? styles.controlBtn : styles.controlBtnDanger}
              title={audio ? "Mute Microphone" : "Unmute Microphone"}
            >
              {audio ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            <IconButton
              onClick={handleVideo}
              className={video ? styles.controlBtn : styles.controlBtnDanger}
              title={video ? "Turn Camera Off" : "Turn Camera On"}
            >
              {video ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>

            {screenAvailable && (
              <IconButton
                onClick={handleScreen}
                className={screen ? styles.controlBtnDanger : styles.controlBtn}
                title={screen ? "Stop Presenting" : "Share Screen"}
              >
                {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </IconButton>
            )}

            <IconButton
              onClick={() => {
                setModal(!showModal);
                setNewMessages(0);
              }}
              className={styles.controlBtn}
              title="Chat"
            >
              <Badge badgeContent={newMessages} color="primary">
                <ChatIcon />
              </Badge>
            </IconButton>

            <IconButton
              onClick={handleEndCall}
              className={styles.controlBtnDanger}
              title="Leave Call"
            >
              <CallEndIcon />
            </IconButton>
          </footer>

          {showModal && (
            <div className={styles.chatDrawer}>
              <div className={styles.chatHeader}>
                <span>In-call Messages</span>
                <IconButton size="small" onClick={() => setModal(false)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </div>

              <div className={styles.chatMessages}>
                {messages.length === 0 ? (
                  <p style={{ color: "#70757a", textAlign: "center", marginTop: 20 }}>
                    No messages yet. Send a message to start chatting!
                  </p>
                ) : (
                  messages.map((item, index) => {
                    const isSelf = item.sender === (username || "User");
                    return (
                      <div
                        key={index}
                        className={isSelf ? styles.chatBubbleSelf : styles.chatBubble}
                      >
                        <div className={styles.chatSender}>{item.sender}</div>
                        <div className={styles.chatText}>{item.data}</div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className={styles.chatInputArea}>
                <TextField
                  placeholder="Send a message to everyone"
                  size="small"
                  fullWidth
                  variant="outlined"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendMessage();
                  }}
                />
                <IconButton color="primary" onClick={sendMessage}>
                  <SendIcon />
                </IconButton>
              </div>
            </div>
          )}
        </div>
      )}

      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        message={snackMsg}
      />
    </div>
  );
}
