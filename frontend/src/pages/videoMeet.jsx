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

const connections = {};
const peerConfigConnections = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function VideoMeetComponent() {
  const navigate = useNavigate();
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoRef = useRef();

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

  const getPermissions = async () => {
    let hasVideo = false;
    let hasAudio = false;

    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      hasVideo = true;
    } catch (error) {
      console.log("camera access failed", error);
    }

    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      hasAudio = true;
    } catch (error) {
      console.log("audio access failed", error);
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
        console.error("Media Stream error:", error);
      }
    }
  };

  useEffect(() => {
    getPermissions();
    return () => {
      window.localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!askForUsername && localVideoRef.current && window.localStream) {
      localVideoRef.current.srcObject = window.localStream;
    }
  }, [askForUsername]);

  const silence = () => {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      oscillator.connect(dst);
      oscillator.start();
      ctx.resume();
      return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
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
      const stream = canvas.captureStream();
      return Object.assign(stream.getVideoTracks()[0], { enabled: false });
    } catch (e) {
      return null;
    }
  };

  const blackSilence = (...args) => {
    const b = black(...args);
    const s = silence();
    const tracks = [];
    if (b) tracks.push(b);
    if (s) tracks.push(s);
    return new MediaStream(tracks);
  };

  const getUserMediaSuccess = (stream) => {
    try {
      window.localStream?.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      const pc = connections[id];
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
        try {
          const tracks = localVideoRef.current?.srcObject?.getTracks();
          tracks?.forEach((t) => t.stop());
        } catch (e) {
          console.log(e);
        }

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
    } else {
      try {
        const tracks = localVideoRef.current?.srcObject?.getTracks();
        tracks?.forEach((track) => track.stop());
      } catch (e) {
        console.log(e);
      }
    }
  };

  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
    }
  }, [audio, video]);

  const getDisplayMediaSuccess = (stream) => {
    window.localStream = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const screenVideoTrack = stream.getVideoTracks()[0];
    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      const pc = connections[id];
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

  const handleAudio = () => {
    setAudio(!audio);
  };

  const handleVideo = () => {
    setVideo(!video);
  };

  const handleScreen = () => {
    setScreen(!screen);
  };

  const handleEndCall = () => {
    try {
      localVideoRef.current?.srcObject?.getTracks().forEach((track) => track.stop());
    } catch (e) {}

    try {
      window.localStream?.getTracks().forEach((track) => track.stop());
    } catch (e) {}

    for (let id in connections) {
      try {
        connections[id].close();
      } catch (e) {}
      delete connections[id];
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    navigate("/home");
  };

  const createPeerConnection = (socketListId) => {
    if (connections[socketListId] || socketListId === socketIdRef.current) {
      return connections[socketListId];
    }

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
      const stream =
        event.streams && event.streams[0]
          ? event.streams[0]
          : new MediaStream([event.track]);

      setVideos((prevVideos) => {
        const exists = prevVideos.find((v) => v.socketId === socketListId);
        if (exists) {
          return prevVideos.map((v) =>
            v.socketId === socketListId ? { ...v, stream } : v
          );
        }
        return [...prevVideos, { socketId: socketListId, stream }];
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

    connections[socketListId] = pc;
    return pc;
  };

  const gotMessageFromServer = (fromId, msg) => {
    const signal = JSON.parse(msg);

    if (fromId === socketIdRef.current) return;

    const pc = connections[fromId] || createPeerConnection(fromId);
    if (!pc) return;

    if (signal.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => {
          if (signal.sdp.type === "offer") {
            pc.createAnswer()
              .then((description) => pc.setLocalDescription(description))
              .then(() => {
                socketRef.current?.emit(
                  "signal",
                  fromId,
                  JSON.stringify({ sdp: pc.localDescription })
                );
              })
              .catch((e) => console.error("Error answering offer:", e));
          }
        })
        .catch((e) => console.error("Error setting remote description:", e));
    }

    if (signal.ice) {
      pc.addIceCandidate(new RTCIceCandidate(signal.ice)).catch((e) =>
        console.error("Error adding ICE candidate:", e)
      );
    }
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

  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      setConnected(true);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.emit("join-call", url);

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", (id) => {
        if (connections[id]) {
          try {
            connections[id].close();
          } catch (e) {}
          delete connections[id];
        }
        setVideos((prevVideos) => prevVideos.filter((v) => v.socketId !== id));
      });

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          createPeerConnection(socketListId);
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;
            const pc = connections[id2];
            if (pc) {
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
      console.log("Connection failed", error.message);
      setConnected(false);
    });
  };

  const getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  const connect = () => {
    setAskForUsername(false);
    getMedia();
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
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={styles.userVideo}
              />
              <div className={styles.videoLabel}>You ({username || "Me"})</div>
            </div>

            {videos.map((item) => (
              <div key={item.socketId} className={styles.videoCard}>
                <video
                  ref={(ref) => {
                    if (ref && item.stream && ref.srcObject !== item.stream) {
                      ref.srcObject = item.stream;
                      ref.play().catch((err) => console.log("Autoplay caught:", err));
                    }
                  }}
                  autoPlay
                  playsInline
                  className={styles.userVideo}
                />
                <div className={styles.videoLabel}>
                  Participant ({item.socketId.substring(0, 5)})
                </div>
              </div>
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
