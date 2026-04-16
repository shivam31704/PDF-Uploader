require("dotenv").config();
// console.log("Mongo URI:", process.env.MONGO_URI);
const express = require("express");
const app = express();
const path = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mongoose = require("mongoose");
const fs = require("fs");
const router = express.Router();
const {
  uploadFile,
  cleanText,
  preprocessImage,
  extractTextFromScannedPDF,
  extractTextFromImage,
  fRoute,
  fIdRoute,
  fIdSearchRoute
} = require("./controllers/fileController");
const Tesseract = require("tesseract.js");
const { fromPath } = require("pdf2pic");
const sharp = require("sharp");
const PdfDocument = require("./models/pdfdocument");
const upload = require("./controllers/middleware/upload");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const chatRoutes = require("./routes/chatRoutes");
app.use(express.static("public"));

app.use(chatRoutes);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.listen(8080, () => {
  console.log("Server is running on port 8080");
});


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.render("upload.ejs");
});

app.post("/upload", upload.single("file"), uploadFile);

app.get("/f", fRoute);

app.get("/f/:id", fIdRoute);

app.get("/f/:id/search", fIdSearchRoute);
