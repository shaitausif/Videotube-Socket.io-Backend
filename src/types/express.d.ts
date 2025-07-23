// Here, in this file I am extending the express request interface using module augmentation

import { UserInterface } from "../../models/user.models";

declare global {
  namespace Express {
    interface Request {
      user?: UserInterface;
       files?: {
      [fieldname: string]: Express.Multer.File[];
    } | Express.Multer.File[];
    }
  }
}
