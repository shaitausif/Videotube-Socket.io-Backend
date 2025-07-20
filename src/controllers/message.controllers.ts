import mongoose from "mongoose";
import { Chat } from "../models/chat.models";
import { ChatMessage } from "../models/message.models";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { emitSocketEvent } from "../socket";
import {
  getLocalPath,
  getStaticFilePath,
  removeLocalFile,
} from "../utils/helpers";
import { uploadOnCloudinary } from "../utils/cloudinary";
import { ChatEventEnum } from "../../constants";

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

const getAllMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  const selectedChat = await Chat.findById(chatId);
  if (!selectedChat) throw new ApiError(404, "Chat doesn't exist");

  if (!selectedChat.participants?.includes(req.user._id.toString())) {
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
const sendMessage = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { content } = req.body;

  if (!content || !req.files?.attachments?.length) {
    throw new ApiError(400, "Message content or attachment is required");
  }

  const selectedChat = await Chat.findById(chatId);

  if (!selectedChat) throw new ApiError(404, "Chat doesn't exist");


  let messageFiles
  if (req.files && req.files?.attachments.length > 0) {

    messageFiles = await Promise.all(
  req.files?.attachments?.map(async (attachment) => {
    const url = await uploadOnCloudinary(attachment.path);
    return { url };
  }) || []  // fallback in case `attachments` is undefined
);

  }

//   Create a new Message instance with appropriat metadata
  const message = await ChatMessage.create({
    sender : new mongoose.Types.ObjectId(req.user._id),
    content : content || "",
    chat : new mongoose.Types.ObjectId(chatId),
    attachments : messageFiles
  })

    // update the chat's last message which could be utilized to show last message in the list item
    const chat = await Chat.findByIdAndUpdate(
        chatId,
        {
            $set : {
                lastMessage : message._id
            }
        },
        { new : true }
    )

    // Structure the message and fill all the sender user's document
    const messages = await ChatMessage.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(chatId)
            }
        },
        ...chatMessageCommonAggregation()
    ])

    // Store all the messages and the aggregation result
    const receivedMessage = messages[0]

    if(!receivedMessage) throw new ApiError(500, "Internal server error")

    // logic to emit socket event about the new message created to the other participants
    chat?.participants?.forEach((participantObjectId) => {
        // here the chat is the raw instance of the chat in which participants is the array of object ids of users
    // avoid emitting event to the user who is sending the message
    if(participantObjectId.toString() === req.user._id.toString()) return 

    // emit the receive message event to the other participants with received message as the payload
    emitSocketEvent(
        req,
        participantObjectId,
        ChatEventEnum.MESSAGE_RECEIVED_EVENT,
        receivedMessage
    )
    })

    return res.status(200).json(new ApiResponse(200,receivedMessage, "Message Saved successfully"))

});
