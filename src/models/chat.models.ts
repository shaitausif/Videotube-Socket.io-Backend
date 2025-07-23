import mongoose, { Schema } from "mongoose";


export interface ChatInterface {
  name? : string;
  isGroupChat? : boolean;
  lastMessage? : mongoose.Types.ObjectId;
  participants? : mongoose.Types.ObjectId[];
  admin? : mongoose.Types.ObjectId
}



const chatSchema = new Schema<ChatInterface>(
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

export const Chat = mongoose.models.Chat || mongoose.model("Chat", chatSchema);
