import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { addNewParticipantInGroupChat, createAGroupChat, createOrGetAOneOnOneChat, deleteGroupChat, deleteOneOnOneChat, getAllChats, getGroupChatDetails, leaveGroupChat, removeParticipantFromGroupChat, renameGroupChat, searchAvailableUsers } from "../controllers/chat.controllers.js";
import { mongoIdPathVariableValidator } from "../validators/mongodb.validator.js";
import { validate } from "../validators/validate.js";
import { createAGroupChatValidator, updateGroupChatNameValidator } from "../validators/chat.validator.js";


const router = Router()

// This verifyJWT middleware will run before every controller of this chat route
router.use(verifyJWT);

router.route("/").get(getAllChats)

router.route("/users").get(searchAvailableUsers)

router
    .route("/c/:receiverId")
    .post(
        mongoIdPathVariableValidator,
        validate,
        createOrGetAOneOnOneChat
    )

router.route("/group")
        .post(
            createAGroupChatValidator(), validate, createAGroupChat
        )

router.route("/group/:chatId")
    .get(mongoIdPathVariableValidator("chatId"), validate, getGroupChatDetails)
    .patch(
        mongoIdPathVariableValidator("chatId"),
        updateGroupChatNameValidator(),
        validate,
        renameGroupChat
    )
    .delete(
        mongoIdPathVariableValidator("chatId"),
        validate,
        deleteGroupChat
    )


router.
    route("/group/:chatId/:participantId")
    .post(
        mongoIdPathVariableValidator("chatId"),
        mongoIdPathVariableValidator("participantId"),
        validate,
        addNewParticipantInGroupChat
    )
    .delete(
        mongoIdPathVariableValidator("chatId"),
        mongoIdPathVariableValidator("participantId"),
        validate,
        removeParticipantFromGroupChat
    )

router.
    route("/leave/group/:chatId")
    .delete(
        mongoIdPathVariableValidator("chatId"),
        validate,
        leaveGroupChat
    )

router.route("/remove/:chatId").delete(mongoIdPathVariableValidator("chatId"),validate, deleteOneOnOneChat)

export default router;