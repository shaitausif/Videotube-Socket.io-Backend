import mongoose from "mongoose";
import { User, UserInterface } from "../models/user.models.js";
import { Chat } from "../models/chat.models.js";
import { ChatMessage } from "../models/message.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { emitSocketEvent } from "../socket/index.js";
import { ChatEventEnum } from "../constants.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";

import { Request, Response } from "express";

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
            // get details of the sender who sent the lastMessage
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
            // Get the first object of the sender array
            $addFields: {
              sender: { $first: "$sender" },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        // Get the first object of lastMessage array
        lastMessage: { $first: "$lastMessage" },
      },
    },
  ];
};




// It's a utility function responsible for removing all the messages and file attachments attached to the deleted chat
const deleteCascadeChatMessages = async(chatId: any) => {

  // fetch all the messages associated with the chat to remove
  const messages = await ChatMessage.find({
    chat: new mongoose.Types.ObjectId(chatId)
  })

  
  // concatenate all attachments into a single array
  const attachments: any = messages.flatMap((message) => message.attachments || []);



  attachments.forEach(async(attachment: any) => {
    // Remove attachments files from cloudinary
    await deleteFromCloudinary(attachment.url)    
  })

  // Delete all the messages
  await ChatMessage.deleteMany({
    chat : new mongoose.Types.ObjectId(chatId)
  })

}



const searchAvailableUsers = asyncHandler(async(req: any, res: any) => {
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
        return res.status(200).json(new ApiResponse(200, users, "Users fetched successfully"))
        // {success : true, data: users, message: "Users fetched successfully"}
})


const createOrGetAOneOnOneChat = asyncHandler(async(req: Request, res: Response) => {
    const {receiverId} = req.params
    
    // Check if it's a valid user
    const receiver = await User.findById(receiverId)

    if(!receiver){
        throw new ApiError(404, "Receiver doesn't exist")
    }

    // Check if the receiver is not the user who is requesting a chat
    if(receiver._id === req.user?._id){
        throw new ApiError(400, "You can't chat with yourself")
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
        // This function helps to join or populate the fields in the Chat schema which only contains the mongoose object Id's into real document
        ...chatCommonAggregation()
    ])
    
    // Now, if the chat exists then return 200 response 
    if(chat.length){
        return res.status(200).json(new ApiResponse(200, chat[0], "Chat retrieved successfully"))
        // {success : true , data: chat[0], message: "Chat retrieved successfully"}
    }

    // If there's no chat found then create one
    const newChatInstance = await Chat.create({
        name : "One on One chat",
        participants : [req.user?._id,new mongoose.Types.ObjectId(receiverId)],
        admin : req.user?._id
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
    throw new ApiError(500 , "Internal server error")
  }

  // logic to emit socket event about the new chat added to the participants
  payload?.participants?.forEach((participant: any) => {
    if (participant._id.toString() === req.user?._id.toString()) return; // don't emit the event for the logged in user as he is the one who is initiating the chat

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
    .json(new ApiResponse(201, payload, "Chat retrieved successfully"));
    // {success : true, data: payload, message : "Chat retrieved successfully"}

})



const createAGroupChat = asyncHandler(async(req: Request, res: Response) => {
  const {name, participants} = req.body

  if(participants.includes(req.user?._id.toString())){
    throw new ApiError(400, "Participants array can't contain the group creator")
  }


  // This line is creating an array of unique user IDs, making sure that the current logged-in user (req.user._id) is also included — without any duplicates.
  const members = [...new Set([...participants, req.user?._id.toString()])]; // Check for duplicates

  if(members.length < 3){
    // If the group length is less than 3 after removing duplicates then we won't allow the user to create a group chat
    throw new ApiError(400, "Seems like you have passed duplicate participants")
  }

  // Create a group chat with provided members
  const groupChat = await Chat.create({
    name,
    isGroupChat : true,
    participants : members,
    admin : req.user?._id
  })

  // Structure the chat
  const chat = await Chat.aggregate([
    { 
      $match : {
        _id : groupChat._id
      }
    },
    ...chatCommonAggregation()
  ])

  const payload = chat[0]

  if(!payload) throw new ApiError(500, "Internal server error")

  // logic to emit socket event about the new group chat added to the participants
  payload.participants?.forEach((participant: any) => {
    if(participant._id.toString() === req.user?._id.toString()) return 
      //  don't emit the event for the logged in use as he is the one who is initiating the chat
      // emit event to other participants with new chat as a payload
    
  emitSocketEvent(
    req,
    participant._id?.toString(),
    ChatEventEnum.NEW_CHAT_EVENT,
    payload
  )


  })

  return res.status(201).json(new ApiResponse(200, payload, "Group chat created successfully"))
  // {success : true, data : payload , message : "Group chat created successfully"}

})


const getGroupChatDetails = asyncHandler(async(req: Request, res: Response) => {
  const {chatId} = req.params
  const groupChat = await Chat.aggregate([
    {
      $match : {
        _id : new mongoose.Types.ObjectId(chatId),
        isGroupChat : true
      }
    },
    ...chatCommonAggregation()
  ])

  const chat = groupChat[0]

  if(!chat) throw new ApiError(404, "Chat doesn't exist")

  return res.status(200).json(new ApiResponse(200, chat, "Group chat fetched successfully"))  
  // {success : true, data: chat, message : "Group Chat fetched successfully"}

})


const renameGroupChat = asyncHandler(async(req: Request, res: Response) => {
  const {chatId} = req.params
  const {name} = req.body

  // Check if the group chat of this ID exists or not
  const groupChat = await Chat.findOne({
    _id : new mongoose.Types.ObjectId(chatId),
    isGroupChat : true
  })

  if(!groupChat){
    throw new ApiError(404 , "Group chat doesn't exist")
  }

  // Now writing the logic so that only admin can change the name
  if(groupChat.admin?.toString() !== req.user?._id.toString()){
    throw new ApiError(400, "You are not an Admin")
  }

  const updatedGroupChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $set : {
        name
      }
    },
    { new : true }
  )

  const chat = await Chat.aggregate([
    {
      $match : {
        _id : updatedGroupChat?._id
      }
    },
    ...chatCommonAggregation()
  ])

  const payload = chat[0]

  if(!payload) throw new ApiError(500, "Internal server error")

  // logic to emit socket event about the updated chat name to the participants
  payload.participants?.forEach((participant: UserInterface) => {
    emitSocketEvent(
      req,
      participant._id?.toString(),
      ChatEventEnum.UPDATE_GROUP_NAME_EVENT,
      payload
    )
  })

  return res.status(200).json(new ApiResponse(200, payload, "Group name updated successfully"))
  // {success : true, data : payload, message : "Group name updated successfully"}

})


const deleteGroupChat = asyncHandler(async(req: Request, res: Response) => {
  const {chatId} = req.params

  const groupChat = await Chat.aggregate([
    {
      $match : {
        _id : new mongoose.Types.ObjectId(chatId),
        isGroupChat: true
      }
    },
    ...chatCommonAggregation()
  ])

  const chat = groupChat[0]

  if(!chat){
    throw new ApiError(404, "Group Chat doesn't exist")
  }

  // check if the user who is deleting is the group admin
  if (chat.admin?.toString() !== req.user?._id?.toString()) {
    throw new ApiError(400, "Only admin can delete the group");
  }

  await Chat.findByIdAndDelete(chatId); // delete the chat
  await deleteCascadeChatMessages(chatId); // remove all messages and attachments associated with the chat

  // logic to emit socket event about the group chat deleted to the participants
  chat.participants?.forEach((participant: UserInterface) => {
    emitSocketEvent(
      req,
      participant._id,
      ChatEventEnum.LEAVE_CHAT_EVENT,
      chat
    )
  })

  return res.status(200).json(new ApiResponse(200,{},"Group deleted successfully"))

})


const deleteOneOnOneChat = asyncHandler(async(req: Request, res: Response) => {
  const {chatId} = req.params

  // Check for chat existence
  const chat: any = await Chat.aggregate([
    {
      $match : {
        _id : new mongoose.Types.ObjectId(chatId)
      }
    },
    ...chatCommonAggregation()
  ])

  const payload = chat[0]
  if(!payload) throw new ApiError(404, "Chat doesn't exist")

  // delete the chat even if user is not admin because it's a personal chat
  await Chat.findByIdAndDelete(chatId)

  // delete all the messages and attachments associated with the chat
  await deleteCascadeChatMessages(chatId)

  // Get the Other participant to send him the socket event
  const otherParticipant = payload?.participants?.find((participant: UserInterface) => participant?._id.toString() !== req.user?._id)

  emitSocketEvent(
    req,
    otherParticipant._id.toString(),
    ChatEventEnum.LEAVE_CHAT_EVENT,
    payload
  )

  return res.status(200).json(new ApiResponse(200,"Chat deleted successfully"))

})


const leaveGroupChat = asyncHandler(async(req: Request, res: Response) => {
  const {chatId} = req.params

  const groupChat = await Chat.findOne({
    _id : new mongoose.Types.ObjectId(chatId),
    isGroupChat : true
  })
  if(!groupChat){
    throw new ApiError(404, "Group chat doesn't exist")
  }

  // Now, Check if the user is part of this group chat or not
  const existingParticipants = groupChat.participants
  if(!existingParticipants?.includes(req.user?._id.toString())){
    throw new ApiError(400, "You are not part of this group chat")
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull : {
        // leave the group
        participants : req.user?._id
      }
    },
    {new : true}
  )

  const chat = await Chat.aggregate([
    {
      $match : {
        _id : updatedChat?._id
      }
    },
    ...chatCommonAggregation()
  ])

  const payload = chat[0]

  if(!payload){
    throw new ApiError(500, "Internal server error")
  }

  return res.status(200).json(new ApiResponse(200,payload,"Left a group successfully"))

})

const addNewParticipantInGroupChat = asyncHandler(async(req: Request, res: Response) => {
  const {chatId, participantId} = req.params

  const groupChat = await Chat.findOne({
    _id : new mongoose.Types.ObjectId(chatId),
    isGroupChat : true
  })

  if(!groupChat)throw new ApiError(404, "Chat doesn't exist")

  if(groupChat.admin?.toString() !== req.user?._id.toString()){
    throw new ApiError(400, "You are not an Admin")
  }


  const existingParticipants = groupChat.participants
  if(existingParticipants?.includes(participantId)){
    throw new ApiError(400, "Participant already in the group chat")
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $set : {
        $push : {
          participants : participantId
        }
      }
    },
    {new : true}
  )

  const chat = await Chat.aggregate([
    {
      $match : {
        _id : updatedChat?._id
      }
    },
    ...chatCommonAggregation()
  ])

  const payload = chat[0]

  if(!payload) throw new ApiError(500, "Internal server error")

  // emit new chat event to the added participant
  emitSocketEvent(req,participantId,ChatEventEnum.NEW_CHAT_EVENT,payload)

  return res.status(200).json(new ApiResponse(200, payload, "Participant added successfully"))

})


const removeParticipantFromGroupChat = asyncHandler(async(req: Request, res: Response) => {
  const {chatId, participantId} = req.params

  const groupChat = await Chat.findOne({
    _id : new mongoose.Types.ObjectId(chatId),
    isGroupChat : true
  })

  if(!groupChat) throw new ApiError(404, "Group chat doesn't exist")

  const existingParticipants = groupChat.participants
  if(!existingParticipants?.includes(participantId)){
    throw new ApiError(400, "Participant doesn't exist in the group chat")
  }

  if(groupChat.admin?.toString() !== req.user?._id.toString()){
    throw new ApiError(400, "You are not an Admin")
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull : {
        participants : participantId
      }
    },
    {new : true}
  )

  const chat = await Chat.aggregate([
    {
      $match : {
        _id : updatedChat?._id
      }
    },
    ...chatCommonAggregation()
  ])

  const payload = chat[0]

  if(!payload)throw new ApiError(500, "Internal server error")

  emitSocketEvent(req , participantId , ChatEventEnum.LEAVE_CHAT_EVENT , payload)

  return res.status(200).json(new ApiResponse(200,payload, "Participant removed successfully"))

})


const getAllChats = asyncHandler(async (req: Request, res: Response) => {

    const chats = await Chat.aggregate([
      {
        $match: {
          $participants: { $elemMatch: { $eq: req.user?._id } },
        },
      },
      {
        $sort: {
          updatedAt: -1,
        },
      },
      ...chatCommonAggregation(),
    ]);

    return res.status(200).json(new ApiResponse(200, chats, "Users chats fetched successfully"))
})

export {
  addNewParticipantInGroupChat,
  createAGroupChat,
  createOrGetAOneOnOneChat,
  deleteGroupChat,
  deleteOneOnOneChat,
  getAllChats,
  getGroupChatDetails,
  leaveGroupChat,
  removeParticipantFromGroupChat,
  renameGroupChat,
  searchAvailableUsers,
};
