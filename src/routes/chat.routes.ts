import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares";
import { getAllChats } from "../controllers/chat.controllers";


const router = Router()

// This verifyJWT middleware will run before every controller of this chat route
router.use(verifyJWT);

router.route("/").get(getAllChats)



export default router;