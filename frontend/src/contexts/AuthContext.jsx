import { createContext, useContext, useState } from "react";
import axios from "axios";
import httpStatus from "http-status";
import { useNavigate } from "react-router-dom";
import servers from "../environment"
export const AuthContext = createContext({});

const server = "http://localhost:8000";

const client = axios.create({
  baseURL: `${server.prod}/api/v1/users`,
});

export const AuthProvider = ({ children }) => {
  const authContext = useContext(AuthContext);
  const [userData, setUserData] = useState(authContext);
  const router = useNavigate();

  const handleRegister = async (name, username, password) => {
    try {
      let request = await client.post("/register", {
        name,
        username,
        password,
      });
      if (request.status === httpStatus.CREATED) {
        return request.data.message;
      }
    } catch (err) {
      throw err;
    }
  };

  const handleLogin = async (username, password) => {
    try {
      const response = await client.post("/login", {
        username,
        password,
      });

      if (response.status === httpStatus.OK || response.status === 200) {
        localStorage.setItem("token", response.data.token);
        setUserData({ username });
        router("/home");
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const getHistoryOfUser = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await client.get("/get_all_activity", {
        params: { token },
      });
      return response.data;
    } catch (err) {
      console.error("Error getting history:", err);
      throw err;
    }
  };

  const addToUserHistory = async (meetingCode) => {
    try {
      const token = localStorage.getItem("token");
      const response = await client.post("/add_to_activity", {
        token,
        meeting_code: meetingCode,
      });
      return response.data;
    } catch (err) {
      console.error("Error adding to history:", err);
      throw err;
    }
  };

  const data = {
    userData,
    setUserData,
    handleRegister,
    handleLogin,
    getHistoryOfUser,
    addToUserHistory,
  };

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};
