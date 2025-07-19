import mongoose from "mongoose";
import { User } from "../models/user.models";
import { Chat } from "../models/chat.models";
import { ChatMessage } from "../models/message.models";
import { removeLocalFile } from "../utils/helpers";
import { asyncHandler } from "../utils/asyncHandler";
import { emitSocketEvent } from "../socket";
import { ChatEventEnum } from "../../constants";

//  Utility function which returns the pipeline stages to structure the chat schema with common lookups

const chatCommonAggregation = () => {
  return [
    {
      // Lookup for participants present
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "participants",
        as: "participants",
        pipeline: [
          {
            $project: {
              password: 0,
              refreshToken: 0,
              watchHistory: 0,
              verifyCode: 0,
              VerifyCodeExpiry: 0,
            },
          },
        ],
      },
    },
    {
      // Lookup for the group chats
      $lookup: {
        from: "chatmessages",
        foreignField: "_id",
        localField: "lastMessage",
        as: "lastMessage",
        pipeline: [
          {
            // get details of the sender
            $lookup: {
              from: "users",
              foreignField: "_id",
              localField: "sender",
              as: "sender",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    email: 1,
                    avatar: 1,
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
        ],
      },
    },
    {
      $addFields: {
        lastMessage: { $first: "$lastMessage" },
      },
    },
  ];
};



const searchAvailableUsers = asyncHandler(async(req, res) => {
        const users = await User.aggregate([
            {
                $match : {
                    _id : { $ne : req.user._id  }
                }
            },
            {
                $project : {
                    avatar : 1,
                    username : 1,
                    email : 1
                }
            }
        ])
        return res.status(200).json({success : true, data: users, message: "Users fetched successfully"})
})


const createOrGetOneOnOneChat = asyncHandler(async(req, res) => {
    const {receiverId} = req.params
    
    // Check if it's a valid user
    const receiver = await User.findById(receiverId)

    if(!receiver){
        return res.status(404).json({success : false , message : "Receiver does not exist"})
    }

    // Check if the receiver is not the user who is requesting a chat
    if(receiver._id === req.user._id){
        return res.status(400).json({success : false, message : "You can't Chat with yourself"})
    }

    
    // Now, Search for this one on one chat
    const chat = await Chat.aggregate([
        {
            $match : {
                isGroupChat : false, // avoid group chats. This controller is responsible for one on one chats
        // Also, filter chats with participants having receiver and logged in user only
                $and : [
                    {
                        participants : { $elemMatch : { $eq : req.user?._id }}
                    },
                    {   
                        participants : { 
                            $elemMatch : { $eq : new mongoose.Types.ObjectId(receiverId)}
                        }
                    }
                ]
            }
        },
        ...chatCommonAggregation()
    ])
    
    // Now, if the chat exists then return 200 response 
    if(chat.length){
        return res.status(200).json({success : true , data: chat[0], message: "Chat retrieved successfully"})
    }

    // If there's no chat found then create one
    const newChatInstance = await Chat.create({
        name : "One on One chat",
        participants : [req.user?._id,new mongoose.Types.ObjectId(receiverId)],
        admin : req.user._id
    })

    // structure the chat as per the common aggregation to keep the consistency
  const createdChat = await Chat.aggregate([
    {
      $match: {
        _id: newChatInstance._id,
      },
    },
    ...chatCommonAggregation(),
  ]);

  const payload = createdChat[0]; // store the aggregation result

  if (!payload) {
    return res.status(500).json({success : false , message : "Internal server error"})
  }

  // logic to emit socket event about the new chat added to the participants
  payload?.participants?.forEach((participant) => {
    if (participant._id.toString() === req.user._id.toString()) return; // don't emit the event for the logged in user as he is the one who is initiating the chat

    // emit event to other participants with new chat as a payload
    emitSocketEvent(
      req,
      participant._id?.toString(),
      ChatEventEnum
      .NEW_CHAT_EVENT,
      payload
    );
  });

  return res
    .status(201)
    .json({success : true, data: payload, message : "Chat retrieved successfully"});

})






const getAllChats = asyncHandler(async (req, res) => {

    const chats = await Chat.aggregate([
      {
        $match: {
          $participants: { $elemMatch: { $eq: req.user._id! } },
        },
      },
      {
        $sort: {
          updatedAt: -1,
        },
      },
      ...chatCommonAggregation(),
    ]);

    return res.status(200).json({success : true, data : chats || [] , message : "User's chats fetched successfully"})
})

export { getAllChats };
