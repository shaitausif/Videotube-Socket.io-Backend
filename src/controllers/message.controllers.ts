import mongoose, { mongo } from "mongoose";
import { Chat } from "../models/chat.models.js";
import { ChatMessage, ChatMessageInterface } from "../models/message.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { emitSocketEvent } from "../socket/index.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import {ChatEventEnum} from '../constants.js'
import { Request, Response } from "express";

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
  chat?.participants?.forEach((participantObjectId: mongoose.Types.ObjectId) => {
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
  });

  return res
    .status(200)
    .json(new ApiResponse(200, receivedMessage, "Message Saved successfully"));
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
    if(participantObjectId.toString() ===  req.user._id.toString()) return;

    // Emit the delete message event to other participants to front-end with delete messageId as payload
    emitSocketEvent(
        req,
        participantObjectId,
        ChatEventEnum.MESSAGE_DELETE_EVENT,
        message
    )

  });

  return res.status(200).json(new ApiResponse(200, message, "Message deleted successfully"))
});


export {getAllMessages, sendMessage, deleteMessage}