const mongoose = require("mongoose");

const pdfSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  filePath :{
    type : String,
    required : true,
  }
});

module.exports = mongoose.model("PdfDocument", pdfSchema);
