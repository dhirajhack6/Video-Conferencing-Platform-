import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import "../style/videoComponent.css";
import { io } from "socket.io-client";

const server_url = "http://localhost:8000";

const connections = {};
const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const videoRef = useRef([]);

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

  const { url } = useParams();

  const getPermissions = async () => {
    let hasVideo = false;
    let hasAudio = false;

    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop()); // release the probe stream
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
      // stop camera/mic when leaving the page
      window.localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!askForUsername && localVideoRef.current && window.localStream) {
      localVideoRef.current.srcObject = window.localStream;
    }
  }, [askForUsername]);

  let getUserMediaSuccess = (stream) => {
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

      try {
        connections[id].addStream(window.localStream);
      } catch (e) {
        console.log(e);
      }

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false);
        setAudio(false);
        try {
          let tracks = localVideoRef.current?.srcObject?.getTracks();
          tracks?.forEach((t) => t.stop());
        } catch (e) {
          console.log(e);
        }
      };
    });
  };

  let getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .catch((e) => console.log(e));
    } else {
      try {
        let tracks = localVideoRef.current?.srcObject?.getTracks();
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

  let gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);

    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socketRef.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({ sdp: connections[fromId].localDescription })
                      );
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  let addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: sender, data: data },
    ]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages((prevNew) => prevNew + 1);
    }
  };

  let connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      setConnected(true);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.emit("join-call", window.location.href);

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", (id) => {
        setVideos((prevVideos) => {
          const filtered = prevVideos.filter((v) => v.socketId !== id);
          videoRef.current = filtered;
          return filtered;
        });
      });

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
          connections[socketListId].onicecandidate = (event) => {
            if (event.candiate !== null) {
              socketRef.current.emit("signal", socketListId, JSON.stringify({ 'ice': event.candidate }))
            }
            
          }

          connections[socketListId].onaddstream = (event) => {

            let videoExists = videoRef.current.find((video) => video.socketId === socketListId);

            if (videoExists) {
              setVideo(videos => {
                const updatedVideos = videos.map(video =>
                  video.socketId === socketList ? { ...video, stream: event.stream } : video
                  
                )
                videoRef.current = updatedVideos;
                return updatedVideos;
              })
                   
            }
            else {
              let newVideo = {
                socketId: socketListId,
                stream: event.stream,
                autoplay: true,
                playsInline: true,

              }

              setVideos(videos => {
                const updatedVideos = [...videos, newVideo];
                videoRef.current = updatedVideos;
                return updatedVideos;
              });

            };
            if (window.localStream !== undefined && window.localStream !== null) {
              connections[socketListId].addStream(window.localStream);
            } else {
              // let blacksilence
            }
          }

          if (id === socketIdRef.current) {
           for (let id2 in connections) {
              if (id2 === socketIdRef.current) continue;

              try {
                 connections[id2].addStream(window.localStream);
                } catch (e) {
                    connections[id2]
                .createOffer()
                .then((description) => {
                    connections[id2].setLocalDescription(description)
                        .then(() => {
                            socketRef.current.emit(
                                "signal",
                                id2,
                                JSON.stringify({
                                    sdp: connections[id2].localDescription
                                })
                          .catch(e => console.log(e))      
                            );
                        });
                });
        }
    }
}

          // Wait for ice candidates
          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate != null) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          // Wait for remote video stream
          connections[socketListId].onaddstream = (event) => {
            let videoExists = videoRef.current.find(
              (v) => v.socketId === socketListId
            );

            if (videoExists) {
              setVideos((prevVideos) => {
                const updated = prevVideos.map((v) =>
                  v.socketId === socketListId ? { ...v, stream: event.stream } : v
                );
                videoRef.current = updated;
                return updated;
              });
            } else {
              let newVideo = {
                socketId: socketListId,
                stream: event.stream,
                autoplay: true,
                playsinline: true,
              };
              setVideos((prevVideos) => {
                const updated = [...prevVideos, newVideo];
                videoRef.current = updated;
                return updated;
              });
            }
          };

          // Add local video stream to peer connection
          if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream);
          }
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;

            try {
              connections[id2].addStream(window.localStream);
            } catch (e) {
              console.log(e);
            }

            connections[id2]
              .createOffer()
              .then((description) => {
                connections[id2]
                  .setLocalDescription(description)
                  .then(() => {
                    socketRef.current.emit(
                      "signal",
                      id2,
                      JSON.stringify({ sdp: connections[id2].localDescription })
                    );
                  })
                  .catch((e) => console.log(e));
              })
              .catch((e) => console.log(e));
          }
        }
      });
    });

    socketRef.current.on("connect_error", (error) => {
      console.log("Connection failed", error.message);
      setConnected(false);
    });
  };

  let getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  const connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  return (
    <div>
      {askForUsername ? (
        <div>
          <h2 className="heading">Enter into Lobby</h2>
          <TextField
            id="outlined-basic"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <Button variant="contained" onClick={connect}>
            Connect
          </Button>
          <p>Meeting Id : {url}</p>

          <div>
            <video ref={localVideoRef} autoPlay muted playsInline />
          </div>
        </div>
      ) : (
        <div className="meetVideoContainer">
          <h2>Meeting Room</h2>
          <div className="videoGrid">
            <div>
              <h3>You ({username || "Me"})</h3>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="meetUserVideo"
              />
            </div>
            {videos.map((item) => (
              <div key={item.socketId}>
                <h3>Participant</h3>
                <video
                  ref={(ref) => {
                    if (ref && item.stream) {
                      ref.srcObject = item.stream;
                    }
                  }}
                  autoPlay
                  playsInline
                  className="meetUserVideo"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
