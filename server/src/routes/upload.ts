import {Router} from "express"
import { localUpload } from "../controllers/video.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router()

router.route('/local-upload').post(upload.single('asset'), localUpload);

export default router;
