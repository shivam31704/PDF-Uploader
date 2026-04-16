const pdfDocument = require("../models/pdfdocument.js");
const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const upload = require("./middleware/upload");
const Tesseract = require("tesseract.js");
const { fromPath } = require("pdf2pic");
const sharp = require("sharp");
const PdfChunk = require("../models/pdfChunks");
const splitText = require("../services/chunkService");
const createEmbedding = require("../services/embeddingService");
const searchSimilarChunks = require("../services/vectorSearchService");
const pdfParse = require("pdf-parse");

// ─────────────────────────────────────────────
//  UPLOAD FILE
// ─────────────────────────────────────────────
async function uploadFile(req, res) {
  try {
    if (!req.file) return res.send("No file attached");

    const filePath = req.file.path;
    const dataBuffer = fs.readFileSync(filePath);
    let extractedText = "";

    try {
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
      console.log("Normal pdf parsing success");
    } catch (err) {
      console.log("Normal parse failed:", err.message);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      console.log("No text found. Running OCR...");
      const rawText = await extractTextFromScannedPDF(filePath);
      extractedText = cleanText(rawText);
    }

    const preview = extractedText.split("\n").slice(0, 6).join("\n");

    const savedPdf = await pdfDocument.create({
      fileName: req.file.originalname,
      content: extractedText,
      filePath: filePath,
    });

    const chunks = splitText(extractedText);
    for (const chunk of chunks) {
      const vector = await createEmbedding(chunk);
      await PdfChunk.create({
        fileId: savedPdf._id,
        text: chunk,
        embedding: vector,
      });
    }

    return res.render("uploadSuccess", {
      filename: req.file.originalname,
      preview: preview,
    });
  } catch (err) {
    console.log("UPLOAD ERROR:", err);
    res.send("Error uploading PDF: " + err.message);
  }
}

// ─────────────────────────────────────────────
//  FILE LIST (paginated)
// ─────────────────────────────────────────────
async function fRoute(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    let query = {};
    if (search) query.fileName = { $regex: search, $options: "i" };

    const dbFiles = await pdfDocument
      .find(query, { _id: 1, fileName: 1, uploadedAt: 1 })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalFiles = await pdfDocument.countDocuments(query);
    const totalPages = Math.ceil(totalFiles / limit);

    res.render("files", {
      files: dbFiles,
      currentPage: page,
      totalPages,
      search,
      totalFiles,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
}

// ─────────────────────────────────────────────
//  FILE DETAIL (no search)
// ─────────────────────────────────────────────
async function fIdRoute(req, res) {
  try {
    const file = await pdfDocument.findById(req.params.id);
    if (!file) return res.send("File not found");

    res.render("fileDetail", {
      file,
      query: "",
      matches: [],
      searchMode: "none",
    });
  } catch (err) {
    console.log(err);
    res.send("File not found");
  }
}

// ─────────────────────────────────────────────
//  SEARCH ROUTE  — vector (semantic) + keyword
//  GET /f/:id/search?q=your+query&mode=vector|keyword
// ─────────────────────────────────────────────
async function fIdSearchRoute(req, res) {
  const id = req.params.id;
  const query = (req.query.q || "").trim();
  const mode = req.query.mode || "vector"; // "vector" | "keyword"

  if (!query) {
    const file = await pdfDocument.findById(id);
    return res.render("fileDetail", {
      file,
      query: "",
      matches: [],
      searchMode: "none",
    });
  }

  try {
    const file = await pdfDocument.findById(id);
    if (!file) return res.send("File not found");

    let matches = [];

    // ── VECTOR / SEMANTIC SEARCH ──────────────────
    if (mode === "vector") {
      // 1. Embed the query
      const queryEmbedding = await createEmbedding(query);

      // 2. MongoDB Atlas $vectorSearch against this file's chunks
      const chunks = await searchSimilarChunks(queryEmbedding, id);

      // 3. Map chunks into match objects (score comes from $meta if projected)
      matches = chunks.map((chunk, i) => ({
        lineNumber: i + 1,
        text: chunk.text,
        score: chunk.score ?? null, // Atlas returns score via $meta
        type: "semantic",
      }));
    }

    // ── KEYWORD / REGEX SEARCH ────────────────────
    if (mode === "keyword") {
      const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safeQuery, "gi");
      const lines = file.content.split("\n");

      lines.forEach((line, index) => {
        if (regex.test(line)) {
          matches.push({
            lineNumber: index + 1,
            text: line,
            type: "keyword",
          });
        }
      });
    }

    // ── BUILD HIGHLIGHTED CONTENT (keyword mode) ──
    let highlightedContent = null;
    if (mode === "keyword") {
      const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safeQuery, "gi");

      highlightedContent = file.content
        .split("\n")
        .map(
          (line, i) =>
            `<div id="line-${i + 1}">${line.replace(
              regex,
              (m) =>
                `<mark style="background:yellow;padding:2px 4px;">${m}</mark>`
            )}</div>`
        )
        .join("\n");
    }

    return res.render("fileDetail", {
      file,
      query,
      matches,
      highlightedContent,
      searchMode: mode,
      noResults: matches.length === 0,
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).send("Error searching file: " + err.message);
  }
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function cleanText(text) {
  if (!text) return "";
  let cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/[^\x00-\x7F]/g, "")
    .trim();

  return cleaned
    .split("\n")
    .map((line) => {
      const cols = line.trim().split(/\s{2,}/);
      return cols.length > 1
        ? cols.map((c) => c.padEnd(20, " ")).join("")
        : line;
    })
    .join("\n");
}

async function preprocessImage(inputPath) {
  const outputPath = inputPath.replace(".png", "_clean.png");
  await sharp(inputPath)
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(150)
    .toFile(outputPath);
  return outputPath;
}

async function extractTextFromScannedPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  const totalPages = pdfData.numpages;
  console.log("Total pages:", totalPages);

  const convert = fromPath(filePath, {
    density: 300,
    saveFilename: "temp",
    savePath: "./uploads",
    format: "png",
    width: 1654,
    height: 2339,
    quality: 100,
  });

  let fullText = "";
  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await convert(i);
      if (!page || !page.path || !fs.existsSync(page.path)) break;

      const result = await Tesseract.recognize(page.path, "eng", {
        logger: (m) => console.log(m.status),
      });
      fullText += result.data.text + "\n";
      fs.unlinkSync(page.path);
    } catch (err) {
      console.log("OCR stopped at page", i);
      break;
    }
  }
  return fullText.trim();
}

async function extractTextFromImage(imagePath) {
  const cleanedImage = await preprocessImage(imagePath);
  const result = await Tesseract.recognize(cleanedImage, "eng+hin", {
    tessedit_pageseg_mode: 6,
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/()- ",
  });
  return result.data.text;
}

module.exports = {
  uploadFile,
  cleanText,
  preprocessImage,
  extractTextFromScannedPDF,
  extractTextFromImage,
  fRoute,
  fIdRoute,
  fIdSearchRoute,
};