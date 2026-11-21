import React, { useContext, useEffect, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../style/home.css";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Snackbar,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import { AuthContext } from "../contexts/AuthContext";

function HistoryComponent() {
  const navigate = useNavigate();
  const { getHistoryOfUser } = useContext(AuthContext);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const historyData = await getHistoryOfUser();
        setMeetings(Array.isArray(historyData) ? historyData : []);
      } catch (err) {
        console.error("Failed to fetch meeting history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const copyToClipboard = (code) => {
    const url = `${window.location.origin}/${code}`;
    navigator.clipboard.writeText(url);
    setSnackMsg("Meeting link copied to clipboard!");
    setSnackOpen(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="historyContainer">
      <div className="historyHeader">
        <IconButton onClick={() => navigate("/home")} color="primary">
          <HomeIcon sx={{ fontSize: 32 }} />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Meeting History
        </Typography>
      </div>

      {loading ? (
        <Typography variant="body1" sx={{ textAlign: "center", mt: 4 }}>
          Loading your history...
        </Typography>
      ) : meetings.length === 0 ? (
        <Card sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
          <Typography variant="h6" color="text.secondary">
            No meeting history found.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Meetings you create or join will show up here.
          </Typography>
          <Button
            variant="contained"
            sx={{ mt: 3 }}
            onClick={() => navigate("/home")}
            startIcon={<VideoCallIcon />}
          >
            Start a Meeting
          </Button>
        </Card>
      ) : (
        <div className="historyGrid">
          {meetings.map((item, index) => (
            <Card key={item._id || index} className="historyCard" variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary">
                  Meeting Code
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
                  {item.meetingCode}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Date & Time
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {formatDate(item.date)}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: "space-between", px: 2, pb: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => navigate(`/${item.meetingCode}`)}
                >
                  Join Again
                </Button>
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(item.meetingCode)}
                  title="Copy Link"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          ))}
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

export default withAuth(HistoryComponent);
