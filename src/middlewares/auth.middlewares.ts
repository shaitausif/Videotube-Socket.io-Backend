import { User } from "../models/user.models";
import jwt from 'jsonwebtoken'




export const verifyJWT = async (req, res, next) => {
  const token =
    req.cookies?.accessToken

  if (!token) {
    return res.status(401)
    .json({success :false, message : "Unauthorized request"})
  }

  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
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