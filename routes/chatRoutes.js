const express = require("express");
const router = express.Router();

const { chatWithPdf } = require("../controllers/chatController");

router.post("/api/chat", chatWithPdf);

module.exports = router;
