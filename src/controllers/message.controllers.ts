import mongoose from "mongoose";
import { Chat } from "../models/chat.models.js";
import { ChatMessage, ChatMessageInterface } from "../models/message.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { emitSocketEvent } from "../socket/index.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { ChatEventEnum } from "../constants.js";
import { Request, Response } from "express";
import { AIResponse } from "../gemini/index.js";
import logger from "../logger/winston.logger.js";

// Utility function which returns the pipeline stages to structure the chat message schema with common lookups
// returns {mongoose.PipelineStage[]}

const chatMessageCommonAggregation = () => {
  return [
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "sender",
        as: "sender",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
              email: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        sender: { $first: "$sender" },
      },
    },
  ];
};

const getAllMessages = asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;

  const selectedChat = await Chat.findById(chatId);
  if (!selectedChat) throw new ApiError(404, "Chat doesn't exist");

  if (!selectedChat.participants?.includes(req.user?._id.toString())) {
    throw new ApiError(400, "You are not part of this chat");
  }

  const messages = await ChatMessage.aggregate([
    {
      $match: {
        chat: new mongoose.Types.ObjectId(chatId),
      },
    },
    ...chatMessageCommonAggregation(),
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, messages || [], "Messages fetched successfully")
    );
});

// So, basically for attachments I will upload them on cloudinary and after getting the url for the file I will delete them from my server
const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const { content } = req.body;

  const files = req.files as { attachments?: Express.Multer.File[] };

  if (!content && (!files || !files.attachments?.length)) {
    throw new ApiError(400, "Message content or attachment is required");
  }

  const selectedChat = await Chat.findById(chatId);

  if (!selectedChat) throw new ApiError(404, "Chat doesn't exist");

  let messageFiles;
  if (req.files) {
    messageFiles = await Promise.all(
      files?.attachments?.map(async (attachment: Express.Multer.File) => {
        const res = await uploadOnCloudinary(attachment.path);
        const url = res?.secure_url;
        return { url };
      }) || [] // fallback in case `attachments` is undefined
    );
  }

  //   Create a new Message instance with appropriat metadata
  const message = await ChatMessage.create({
    sender: new mongoose.Types.ObjectId(req.user?._id),
    content: content || "",
    chat: new mongoose.Types.ObjectId(chatId),
    attachments: messageFiles,
  });

  // update the chat's last message which could be utilized to show last message in the list item
  const chat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $set: {
        lastMessage: message._id,
      },
    },
    { new: true }
  );

  // Structure the message and fill all the sender user's document
  const messages = await ChatMessage.aggregate([
    {
      $match: {
        chat: new mongoose.Types.ObjectId(chatId),
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    ...chatMessageCommonAggregation(),
  ]);

  // Store all the messages and the aggregation result
  const receivedMessage = messages[0];

  if (!receivedMessage) throw new ApiError(500, "Internal server error");

  // logic to emit socket event about the new message created to the other participants
  chat?.participants?.forEach(
    (participantObjectId: mongoose.Types.ObjectId) => {
      // here the chat is the raw instance of the chat in which participants is the array of object ids of users
      // avoid emitting event to the user who is sending the message
      if (participantObjectId.toString() === req.user?._id.toString()) return;

      // emit the receive message event to the other participants with received message as the payload
      emitSocketEvent(
        req,
        participantObjectId,
        ChatEventEnum.MESSAGE_RECEIVED_EVENT,
        receivedMessage
      );
    }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, receivedMessage, "Message Saved successfully"));
});

const AI_CHATBOT_USER_ID = process.env.AI_ID; // The _id of your dedicated AI User in DB

// The front-end will hit this endpoint when user selects the AI chat and send messages in this chat
const sendAIMessage = asyncHandler(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const { content } = req.body;


  // Here, as the User Message got created in the DB I will send the socket event to the user with the message in the payload
  // So, basically I am sending my message response using socket and the AI response will going to go using express's response

  if (!content) throw new ApiError(400, "Content is required");

  const selectedChat = await Chat.findById(chatId);

  if (!selectedChat) throw new ApiError(404, "Chat doesn't exist");

  const userMessage = await ChatMessage.create({
    sender: new mongoose.Types.ObjectId(req.user._id),
    content,
    chat: new mongoose.Types.ObjectId(chatId),
  });

  await Chat.findByIdAndUpdate(chatId, {
    $set: { lastMessage: userMessage._id },
  });
  const messages = await ChatMessage.aggregate([
    {
      $match: {
        chat: new mongoose.Types.ObjectId(chatId),
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    ...chatMessageCommonAggregation(),
  ]);
  // Emit socket event for the human user's message (optional, but good for consistency)
  // If you're on a 1-on-1 AI chat, you only emit to the human user, not to AI.
  // The human user's client will usually optimistically update their UI,
  // but this ensures consistency if the message is saved successfully.
  emitSocketEvent(
    req,
    new mongoose.Types.ObjectId(req.user?._id),
    ChatEventEnum.MESSAGE_RECEIVED_EVENT,
    messages[0] // Emit the message just sent by the human
  );

  // Retrieving conversation history for context (CRITICAL for coherent AI conversations)
  // const chatHistory = await ChatMessage.aggregate([
  //   {
  //     $match: {
  //       chat: new mongoose.Types.ObjectId(chatId),
  //     },
  //   },
  //   {
  //     $sort: { createdAt: 1 }, // Ascending order to build conversation history
  //   },
  //   {
  //     // Populate sender to get `isAI` flag for correct role mapping
  //     $lookup: {
  //       from: "users", // Assuming your User model's collection name is 'users'
  //       localField: "sender",
  //       foreignField: "_id",
  //       as: "senderDetails",
  //     },
  //   },
  //   {
  //     $unwind: "$senderDetails", // Deconstructs the senderDetails array
  //   },
  //   {
  //     // Project to the format Gemini expects for `contents`
  //     $project: {
  //       role: {
  //         $cond: {
  //           if: "$senderDetails.isAI",
  //           then: "model", // Gemini expects 'model' for AI responses
  //           else: "user", // Gemini expects 'user' for human inputs
  //         },
  //       },
  //       parts: [{ text: "$content" }],
  //     },
  //   },
  //   // Optionally, limiting context window (e.g., last 20 turns)
  //   { $limit: 20 },
  // ]);

  let aiResponseContent: any =
    "Apologies, I'm currently unable to process your request. Please try again later.";
  aiResponseContent = await AIResponse(content);  // Temporarily i am not giving any context to the AI about the chat but I will work on it later on 


  if (aiResponseContent) {
    const AIMessage = await ChatMessage.create({
      sender: new mongoose.Types.ObjectId(AI_CHATBOT_USER_ID),
      chat: new mongoose.Types.ObjectId(chatId),
      content: aiResponseContent,
    });

    await Chat.findByIdAndUpdate(chatId, {
      $set: { lastMessage: AIMessage._id },
    });
    const messages = await ChatMessage.aggregate([
      {
        $match: {
          chat: new mongoose.Types.ObjectId(chatId),
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      ...chatMessageCommonAggregation(),
    ]);
    const receivedMessages = messages[0];

    // emitSocketEvent(
    //   req,
    //   new mongoose.Types.ObjectId(req.user._id), // Emitting ONLY to the human user in this 1-on-1 AI chat
    //   ChatEventEnum.MESSAGE_RECEIVED_EVENT,
    //   receivedMessages
    // );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          receivedMessages,
          "AI Message Fetched successfully"
        )
      );
  } else {
    throw new ApiError(500, "Unable to generate the AI response");
  }
});

const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const { chatId, messageId } = req.params;

  const chat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    participants: req.user?._id,
  });

  if (!chat) throw new ApiError(404, "Chat doesn't exist");

  // Find the message based on messageId
  const message = await ChatMessage.findOne({
    _id: new mongoose.Types.ObjectId(messageId),
    chat: new mongoose.Types.ObjectId(chatId),
  });

  if (!message) throw new ApiError(404, "Message doesn't exist");

  // Check if user is the sender of this message or not
  if (message.sender?.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      403,
      "You are not authorized to delete this message, You are not the sender"
    );
  }

  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    // If the message is an Attachment remove the message from the cloudinary
    await Promise.all(
      message.attachments.map(async (asset: any) => {
        await deleteFromCloudinary(asset.url);
      })
    );
  }

  // Deleting the message from cloudinary
  await ChatMessage.deleteOne({
    _id: new mongoose.Types.ObjectId(messageId),
  });

  //Updating the last message of the chat to the previous message after deletion if the message deleted was last message
  if (chat.lastMessage?.toString() === message._id!.toString()) {
    const lastMessage = await ChatMessage.findOne(
      { chat: chatId },
      // Return all the fields of the filtered document
      {},
      { sort: { createdAt: -1 } }
    );

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: lastMessage ? lastMessage._id : null,
    });
  }

  // logic to emit socket event about the message deleted  to the other participants
  chat.participants?.forEach((participantObjectId: mongoose.Types.ObjectId) => {
    // here the chat is the raw instance of the chat in which participants is the array of object ids of users
    // avoid emitting event to the user who is deleting the message
    if (participantObjectId.toString() === req.user._id.toString()) return;

    // Emit the delete message event to other participants to front-end with delete messageId as payload
    emitSocketEvent(
      req,
      participantObjectId,
      ChatEventEnum.MESSAGE_DELETE_EVENT,
      message
    );
  });

  return res
    .status(200)
    .json(new ApiResponse(200, message, "Message deleted successfully"));
});

export {
  getAllMessages,
  sendMessage,
  deleteMessage,
  chatMessageCommonAggregation,
  sendAIMessage,
};
