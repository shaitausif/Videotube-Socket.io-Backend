import { UserInterface } from "../models/user.models";

declare module 'socket.io' {
  interface Socket {
    user?: UserInterface
}
}