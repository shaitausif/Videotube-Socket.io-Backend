import cookie from 'cookie';
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'
import { ChatEventEnum } from '../constants.js';
import { User } from '../models/user.models.js';
import { Request } from 'express';
import { ApiError } from '../utils/ApiError.js';


/**
 * description This function is responsible to all our user to join the chat represented by chatId (chatId). event happens when user switches between the chats
 * param {Socket<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} socket
 */

const mountJoinChatEvent = (socket: Socket) => {
    socket.on(ChatEventEnum.JOIN_CHAT_EVENT, (chatId) => {
        console.log("User Joined the chat. UserId: ",chatId)
        // joining the room with the chatId will allow specific events to be fired where we don't bother about the users like typing events
      // E.g. When user types we don't want to emit that event to specific participant.
      // We want to just emit that to the chat where the typing is happening
    //   It tells the Socket.IO server to add this specific client's connection (represented by socket) to a "room" identified by chatId.
    // From now on, any events emitted to that room will be received by this client.
      socket.join(chatId)
    })
}

/**
 * description This function is responsible to emit the typing event to the other participants of the chat
 * param {Socket<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} socket
 */


const mountParticipantTypingEvent = (socket: Socket) => {
    
    socket.on(ChatEventEnum.TYPING_EVENT,(chatId) => {
        console.log("User is typing:",chatId)
        socket.to(chatId).emit(ChatEventEnum.TYPING_EVENT,(chatId))
    })
}


// * @description This function is responsible to emit the stopped typing event to the other participants of the chat


const mountParticipantStoppedTypingEvent = (socket: Socket) => {
    socket.on(ChatEventEnum.STOP_TYPING_EVENT, (chatId) => {
        console.log("User has stopped typing", chatId)
        // .emit(ChatEventEnum.STOP_TYPING_EVENT, chatId): This tells the server to send an event named STOP_TYPING_EVENT (along with the chatId as data) to all clients that are currently members of the chatId room except the sender
        socket.to(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, chatId)
    })
}




/**
 *
 * param {Server<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} io
 */

const initializeSocketIO = (io: Server) => {
    return io.on("connection", async(socket: Socket) => {
        try {
            // parse the cookies from the handshake headers (This is only possible if client has `withCredentials: true`)       
            const cookies = cookie.parse(socket.handshake?.headers?.cookie || "")

            let token = cookies?.accessToken;

            if(!token) {
                throw new ApiError(401, "Unauthorized")
            }

            const decodedToken = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) // decode the token

            if(typeof decodedToken === 'string'){
                throw new ApiError(400, "Invalid token format")
            }

            const user = await User.findById(decodedToken?._id).select("-password -refreshToken -verifyCode -verifyCodeExpiry -isPaid -isAI -isAcceptingMessages -verifyCodeExpiry")

            if(!user){
                throw new ApiError(401, "Unauthorized token")
            }

            socket.user = user; // mount the user object to the socket

            // We are creating a room with user id so that if user is joined but does not have any active chat going on.
            // still we want to emit some socket events to the user.
            // so that the client can catch the event and show the notifications.
            socket.join(user._id.toString())
            socket.emit(ChatEventEnum.CONNECTED_EVENT)  // emit the connected event so that client is aware
            console.log("User connected 🗼. userId: ", user._id.toString());

            // Common events that needs to be mounted on the initialization
      mountJoinChatEvent(socket);
      mountParticipantTypingEvent(socket);
      mountParticipantStoppedTypingEvent(socket);


      socket.on(ChatEventEnum.DISCONNECT_EVENT,() => {
        console.log("user has disconnected 🚫. userId: " + socket.user?._id);
        if (socket.user?._id) {
          socket.leave(socket.user._id);
        }

      })

        } catch (error) {
            socket.emit(
        ChatEventEnum.SOCKET_ERROR_EVENT,
        error || "Something went wrong while connecting to the socket."
      );
        }
    })
}


// /**
//  *
//  * @param {import("express").Request} req - Request object to access the `io` instance set at the entry point
//  * @param {string} roomId - Room where the event should be emitted
//  * @param {AvailableChatEvents[0]} event - Event that should be emitted
//  * @param {any} payload - Data that should be sent when emitting the event
//  * @description Utility function responsible to abstract the logic of socket emission via the io instance
//  */


const emitSocketEvent = (req: Request, roomId: any, event: any, payload: any) => {
    console.log("User Socket emitted",roomId)
    req.app.get("io").to(roomId).emit(event,payload)
}


export { initializeSocketIO , emitSocketEvent }; 