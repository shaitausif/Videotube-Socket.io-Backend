import mongoose, { Schema, Document } from "mongoose";


interface Chat extends Document{
    name: string
    isGroupChat? : boolean
    lastMessage? : mongoose.Types.ObjectId
    participants? : mongoose.Types.ObjectId[]
    admin? : mongoose.Types.ObjectId
    createdAt : Date
    updatedAt : Date
}



const chatSchema = new Schema<Chat>(
  {
    name: {
      type: String,
      required: true,
    },
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    admin: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Chat = mongoose.model<Chat>("Chat", chatSchema);
