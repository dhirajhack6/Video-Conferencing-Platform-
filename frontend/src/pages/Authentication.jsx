import React from "react";
import "../App.css";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import { AuthContext } from "../contexts/AuthContext";

import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { createTheme, ThemeProvider } from "@mui/material/styles";

const defaultTheme = createTheme();
const currentYear = new Date().getFullYear();

function Copyright(props) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      align="center"
      {...props}
    >
      {"Copyright © "}
      <Link color="inherit" href="#">
        Apna Video Call
      </Link>{" "}
      {currentYear}
      {"."}
    </Typography>
  );
}

export default function Authentication() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [formState, setFormState] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  const { handleRegister, handleLogin } = React.useContext(AuthContext);

  const handleAuth = async () => {
    setError("");
    try {
      if (formState === 0) {
        await handleLogin(username, password);
      }
      if (formState === 1) {
        let result = await handleRegister(name, username, password);
        setMessage(result);
        setOpen(true);
        setError("");
        setFormState(0);
        setPassword("");
      }
    } catch (err) {
      let msg = err?.response?.data?.message || err?.message || "Something went wrong";
      setError(msg);
    }
  };

  return (
    <ThemeProvider theme={defaultTheme}>
      <CssBaseline />

      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
        }}
      >
        {/* LEFT SIDE */}
        <Box
          sx={{
            display: {
              xs: "none",
              sm: "block",
            },
            width: {
              sm: "40%",
              md: "58%",
            },
            backgroundImage:
              "url(https://images.unsplash.com/photo-1516321318423-f06f85e504b3)",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* RIGHT SIDE */}
        <Paper
          elevation={6}
          square
          sx={{
            width: {
              xs: "100%",
              sm: "60%",
              md: "42%",
            },
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: 450,
              px: {
                xs: 3,
                sm: 5,
              },
              py: 5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* ICON */}
            <Avatar
              sx={{
                m: 1,
                bgcolor: "secondary.main",
              }}
            >
              <LockOutlinedIcon />
            </Avatar>

            <Box sx={{ display: "flex", gap: 1, my: 1 }}>
              <Button
                variant={formState === 0 ? "contained" : "outlined"}
                onClick={() => {
                  setFormState(0);
                  setError("");
                }}
              >
                Sign In
              </Button>
              <Button
                variant={formState === 1 ? "contained" : "outlined"}
                onClick={() => {
                  setFormState(1);
                  setError("");
                }}
              >
                Sign Up
              </Button>
            </Box>

            {/* FORM */}
            <Box
              component="form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                handleAuth();
              }}
              sx={{
                mt: 1,
                width: "100%",
              }}
            >
              {error && (
                <Typography color="error" variant="body2" sx={{ mb: 1, textAlign: "center" }}>
                  {error}
                </Typography>
              )}

              {formState === 1 && (
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="name"
                  label="Full Name"
                  name="name"
                  value={name}
                  type="text"
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                />
              )}

              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                value={username}
                autoFocus={formState === 0}
                onChange={(e) => setUsername(e.target.value)}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    value="remember"
                    color="primary"
                  />
                }
                label="Remember me"
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{
                  mt: 3,
                  mb: 2,
                }}
              >
                {formState === 0 ? "login" : "Register"}
              </Button>

              <Copyright sx={{ mt: 3 }} />
            </Box>
          </Box>
        </Paper>
      </Box>

      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        message={message}
      />
    </ThemeProvider>
  );
}

