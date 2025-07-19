import mongoose, { Schema , Document, mongo } from "mongoose";


export interface ChatMessage extends Document{
    sender : mongoose.Types.ObjectId
    content : string
    attachments : {
        url? : string,
        localPath? : string
    }[]
    chat : mongoose.Types.ObjectId
    createdAt : Date
    updatedAt : Date
}


const chatMessageSchema = new Schema<ChatMessage>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    content: {
      type: String,
    },
    attachments: {
      type: [
        {
          url: String,
          localPath: String,
        },
      ],
      default: [],
    },
    // This field will tell us about from which chat this message exactly belongs to
    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
    },
  },
  { timestamps: true }
);

export const ChatMessage = mongoose.model<ChatMessage>("ChatMessage", chatMessageSchema);
