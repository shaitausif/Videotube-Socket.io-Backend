import mongoose, { Schema } from "mongoose";


export interface ChatMessageInterface extends Document{
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


const chatMessageSchema = new Schema<ChatMessageInterface>(
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

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
