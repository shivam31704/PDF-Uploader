const mongoose = require("mongoose");

const pdfChunkSchema = new mongoose.Schema({
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PdfDocument"
  },
  text: String,
  embedding: {
    type: [Number],
    index: "vector"
  },
  page: Number
});

module.exports = mongoose.model("PdfChunk", pdfChunkSchema);