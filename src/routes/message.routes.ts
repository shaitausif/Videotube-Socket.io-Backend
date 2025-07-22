import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares";
import { mongoIdPathVariableValidator } from "../validators/mongodb.validator";
import { validate } from "../validators/validate";
import { deleteMessage, getAllMessages, sendMessage } from "../controllers/message.controllers";
import { sendMessageValidator } from "../validators/message.validator";


const router = Router()


router.use(verifyJWT)

router.route("/:chatId")
    .get(mongoIdPathVariableValidator("chatId"), validate, getAllMessages)
    .post(
        mongoIdPathVariableValidator("chatId"),
        sendMessageValidator(),
        validate,
        sendMessage
    )


router.route("/:chatId/:messageId").
    delete(
        mongoIdPathVariableValidator("chatId"),
        mongoIdPathVariableValidator("messageId"),
        validate,
        deleteMessage
    )




export default router;