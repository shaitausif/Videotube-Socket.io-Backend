import { NextFunction, Request, Response } from "express";
import { User } from "../models/user.models.js";
import jwt from 'jsonwebtoken'
import { ApiError } from "../utils/ApiError.js";




export const verifyJWT = async (req: Request, res: Response, next: NextFunction) => {
  const token =
    req.cookies?.accessToken

  if (!token) {
    throw new ApiError(401, "Unauthorized")
  }

  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!);
  
    if(typeof decodedToken === "string"){
      throw new ApiError(400,"Invalid token format")
    }

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );
    if (!user) {
      // Client should make a request to /api/v1/users/refresh-token if they have refreshToken present in their cookie
      // Then they will get a new access token which will allow them to refresh the access token without logging out the user
      return res.status(401)
      .json({success : false, message : "Invalid Access Token"})
    }
    req.user = user;
    next();
  } catch (error) {
    // Client should make a request to /api/v1/users/refresh-token if they have refreshToken present in their cookie
    // Then they will get a new access token which will allow them to refresh the access token without logging out the user
    return res.status(401)
    .json({success : false, message : error || "Invalid access Token"})
  }
};