import cookieParser from "cookie-parser";
import cors from 'cors'
import express from 'express'

// Creates an HTTP server instance. Required to plug Socket.IO into your Express server.
import { createServer } from "http";

import { Server } from "socket.io";
import morganMiddleware from "./logger/morgan.logger.js";
import { createClient } from "redis";



const app = express()
const redisClient = createClient()

redisClient.on('error', err => console.log('Redis Client Error', err));

// This function will execute immediately because it's an IIFE
(async function connectRedis() {
    try {
        await redisClient.connect();
        console.log('Connected to Redis');
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
})();


const httpServer = createServer(app)

const io = new Server(httpServer, {
    // how many ms without a pong packet to consider the connection closed default 20000
    pingTimeout : 60000,
    cors : {
        origin : process.env.CORS_ORIGIN,
        credentials : true
    }
})  


app.set("io", io); // using set method to mount the `io` instance on the app to avoid usage of `global`

// global middlewares
app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN === "*"
        ? "*" // This might give CORS error for some origins due to credentials set to true
        : process.env.CORS_ORIGIN?.split(","), // For multiple cors origin for production. Refer https://github.com/hiteshchoudhary/apihub/blob/a846abd7a0795054f48c7eb3e71f3af36478fa96/.env.sample#L12C1-L12C12
    credentials: true,
  })
);


app.use(express.json({limit : "16kb"}))
app.use(cookieParser())
app.use(express.urlencoded({ extended: true, limit: "16kb" }));


app.use(morganMiddleware)


import chatRouter from './routes/chat.routes.js'
import messageRouter from './routes/message.routes.js'
import { initializeSocketIO } from "./socket/index.js";
import { errorHandler } from "./middlewares/error.middlewares.js";




app.use("/api/v1/chat-app/chats", chatRouter);
app.use("/api/v1/chat-app/messages", messageRouter);
  

initializeSocketIO(io); 

app.use(errorHandler);

export {httpServer, redisClient}

