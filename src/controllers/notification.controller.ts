import { messaging } from "../services/firebase.js";
import { User } from "../models/user.models.js";
import mongoose from "mongoose";



export const sendNotification = async({userId,token, title, body, link}: {
    token : string,
    title : string,
    body : Object,
    link : string,
    userId : string
}) => {
    try {
        
    if(!token || !title || !body || !link){
        console.log("All fields are required")
        return
    }
    const payload = {
        token,
        notification : {
            title,
            body
        },
        webpush : link &&  {
            fcmOptions : {
                link
            }
        }
    }

    // Send the push notification to the user whom this token belongs to or has been assigned to by FCM
    await messaging.send(payload)
    } catch (error: any) {
        if(error.code === "messaging/registration-token-not-registered"){
            await User.updateOne(
                {
                    _id : new mongoose.Types.ObjectId(userId)
                }, 
                { $pull : { fcmTokens : token } }
            )
      
            console.log("Invalid token error",token)

        }
        else{
            console.log(error)
        }
    }
}