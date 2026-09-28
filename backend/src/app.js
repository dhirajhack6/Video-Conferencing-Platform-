import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import dotenv from "dotenv";
dotenv.config();


import express from "express";
import { createServer } from "node:http";

import mongoose from "mongoose";
import cors from "cors";
import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js"

const app = express();

const server = createServer(app);

const io = connectToSocket(server);

app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.set("port", process.env.PORT || 8000);
app.use("api/v1/users", userRoutes);


app.get("/home", (req, res) => {
  return res.json({ hello: "worlds"  });
});

const start = async () => {
  try {
    const connectionDb = await mongoose.connect(process.env.MONGO_URL);

    console.log("MongoDB connected:", connectionDb.connection.host);

    server.listen(app.get("port"), () => {
      console.log(`LISTENING on Port ${app.get("port")}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error);
  }
};

start();
