import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import "../style/videoComponent.css";

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
  const [video, setVideo] = useState(false);
  const [audio, setAudio] = useState(false);
  const [screen, setScreen] = useState(false);
  const [showModal, setModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [videos, setVideos] = useState([]);

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

  let getUserMediaSuccess = (stream) => {
    
  }

  let getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)  //Todo: getUserMediaSuceess
        .then((stream) => { })
        .catch((e) => console.log(e))
    } else {
      try {
      
        let tracks = localVideoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop())

      } catch(e) {
        
      }
    }
  }

  useEffect(() => {
    if (video === !undefined && audio === !undefined) {
      getUserMedia();
    }
  }, [audio, video])

  let getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);

    // connectToSocketServer();
  }

  const connect = () => {
  console.log("Connect button clicked");
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

      
          <Button
            variant="contained"
            onClick={connect}
          >
            Connect
          </Button>
          <p>Meeting Id : {url}</p>
          

          <div>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              
            />
          </div>
        </div>
      ) : (
        <></>
      )}
    </div>
  );
}