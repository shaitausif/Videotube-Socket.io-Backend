import cookieParser from "cookie-parser";
import cors from 'cors'
import express from 'express'
import fs from 'fs'
// Creates an HTTP server instance. Required to plug Socket.IO into your Express server.
import { createServer } from "http";
import path from "path";
import { Server } from "socket.io";
import YAML from 'yaml'
import morganMiddleware from "./logger/morgan.logger.js";
import { fileURLToPath } from "url";




// These two lines are used to get the current file’s absolute path (__filename) and its directory (__dirname) in ES Modules (type: "module" in package.json), because __dirname and __filename are not available by default.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = fs.readFileSync(path.resolve(__dirname, "./swagger.yaml"), "utf8");
const swaggerDocument = YAML.parse(
  file?.replace(
    "- url: ${{server}}",
    `- url: ${process.env.FREEAPI_HOST_URL || "http://localhost:8080"}/api/v1`
  )
);


const app = express()

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


app.use(morganMiddleware())


import chatRouter from './routes/chat.routes.js'
import messageRouter from './routes/message.routes.js'
import { initializeSocketIO } from "./socket/index.js";
import { errorHandler } from "./middlewares/error.middlewares.js";




app.use("/api/v1/chat-app/chats", chatRouter);
app.use("/api/v1/chat-app/messages", messageRouter);


initializeSocketIO(io); 

app.use(errorHandler);

export {httpServer}