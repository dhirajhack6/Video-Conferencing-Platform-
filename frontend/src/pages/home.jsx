import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../style/home.css";
import { Button, IconButton, TextField } from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import LogoutIcon from "@mui/icons-material/Logout";
import { AuthContext } from "../contexts/AuthContext";

function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const { addToUserHistory } = useContext(AuthContext);

  const handleJoinVideoCall = async () => {
    if (!meetingCode.trim()) {
      alert("Please enter a valid meeting code");
      return;
    }
    try {
      await addToUserHistory(meetingCode.trim());
    } catch (err) {
      console.log("Could not save to history:", err);
    }
    navigate(`/${meetingCode.trim()}`);
  };

  const handleStartInstantMeeting = async () => {
    const randomCode = Math.random().toString(36).substring(2, 9);
    try {
      await addToUserHistory(randomCode);
    } catch (err) {
      console.log("Could not save to history:", err);
    }
    navigate(`/${randomCode}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/authentication");
  };

  return (
    <div>
      <nav className="homeNav">
        <div className="brand">
          <VideoCallIcon sx={{ fontSize: 32, color: "#1976d2" }} />
          <span>Apna Video Call</span>
        </div>
        <div className="navActions">
          <Button
            startIcon={<RestoreIcon />}
            variant="text"
            color="inherit"
            onClick={() => navigate("/history")}
          >
            History
          </Button>
          <Button
            startIcon={<LogoutIcon />}
            variant="outlined"
            color="error"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </nav>

      <main className="homeMain">
        <div className="leftPanel">
          <h2>Providing Quality Video Calls Securely</h2>
          <p>
            Connect, collaborate, and celebrate from anywhere with Apna Video Call.
          </p>

          <div className="joinForm">
            <TextField
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
              id="outlined-basic"
              label="Enter Meeting Code"
              variant="outlined"
              size="medium"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoinVideoCall();
              }}
            />
            <Button
              onClick={handleJoinVideoCall}
              variant="contained"
              size="large"
              sx={{ px: 3, py: 1.7 }}
            >
              Join
            </Button>
          </div>

          <div>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleStartInstantMeeting}
              startIcon={<VideoCallIcon />}
            >
              Start New Meeting
            </Button>
          </div>
        </div>

        <div className="rightPanel">
          <img src="/mobile.png" alt="Video Call Illustration" />
        </div>
      </main>
    </div>
  );
}

export default withAuth(HomeComponent);
