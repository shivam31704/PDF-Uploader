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

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


app.get("/", (req, res) => {
  res.render("upload.ejs");
});

app.post("/upload", upload.single("file"), uploadFile);

app.get("/f", fRoute);

app.get("/f/:id", fIdRoute);

app.get("/f/:id/search", fIdSearchRoute);
