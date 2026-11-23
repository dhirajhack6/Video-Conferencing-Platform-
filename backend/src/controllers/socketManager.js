import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        socket.on("join-call", (path) => {
            if (!path) return;

            if (connections[path] === undefined) {
                connections[path] = [];
            }
            if (!connections[path].includes(socket.id)) {
                connections[path].push(socket.id);
            }
            timeOnline[socket.id] = new Date();

            console.log(`Socket ${socket.id} joined room [${path}]. Participants in room:`, connections[path]);

            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a]).emit("user-joined", socket.id, connections[path]);
            }

            if (messages[path] !== undefined) {
                for (let a = 0; a < messages[path].length; a++) {
                    io.to(socket.id).emit(
                        "chat-message",
                        messages[path][a]["data"],
                        messages[path][a]["sender"],
                        messages[path][a]["socket-id-sender"]
                    );
                }
            }
        });

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        socket.on("chat-message", (data, sender) => {
            const [matchingRoom, found] = Object.entries(connections).reduce(
                ([room, isFound], [roomKey, roomValue]) => {
                    if (!isFound && roomValue.includes(socket.id)) {
                        return [roomKey, true];
                    }
                    return [room, isFound];
                },
                ["", false]
            );

            if (found === true) {
                if (messages[matchingRoom] === undefined) {
                    messages[matchingRoom] = [];
                }
                messages[matchingRoom].push({
                    sender: sender,
                    data: data,
                    "socket-id-sender": socket.id
                });
                console.log("message in room [", matchingRoom, "] from", sender, ":", data);

                connections[matchingRoom].forEach((elem) => {
                    io.to(elem).emit("chat-message", data, sender, socket.id);
                });
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
            for (const [k, v] of Object.entries(connections)) {
                if (v.includes(socket.id)) {
                    for (let b = 0; b < connections[k].length; b++) {
                        io.to(connections[k][b]).emit("user-left", socket.id);
                    }

                    const index = connections[k].indexOf(socket.id);
                    if (index !== -1) {
                        connections[k].splice(index, 1);
                    }

                    if (connections[k].length === 0) {
                        delete connections[k];
                    }
                    break;
                }
            }
            delete timeOnline[socket.id];
        });
    });

    return io;
};
