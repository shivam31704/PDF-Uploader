const mongoose = require("mongoose");
const PdfChunk = require("../models/pdfChunks");

// ─────────────────────────────────────────────────────────────────
//  searchSimilarChunks
//
//  queryEmbedding : number[]   — vector from embeddingService
//  fileId         : string     — MongoDB ObjectId of the PDF
//                               pass null to search across ALL PDFs
//  limit          : number     — how many top chunks to return (default 5)
// ─────────────────────────────────────────────────────────────────
async function searchSimilarChunks(queryEmbedding, fileId = null, limit = 5) {
  // Build the $vectorSearch stage
  const vectorSearchStage = {
    $vectorSearch: {
      index: "vector_index",          // name of your Atlas Vector Search index
      path: "embedding",              // field storing the vector in PdfChunk
      queryVector: queryEmbedding,
      numCandidates: 100,
      limit: limit,
    },
  };

  // Optionally filter to a single file
  if (fileId) {
    vectorSearchStage.$vectorSearch.filter = {
      fileId: new mongoose.Types.ObjectId(fileId),
    };
  }

  const results = await PdfChunk.aggregate([
    vectorSearchStage,

    // Project the fields we need + the Atlas similarity score
    {
      $project: {
        _id: 1,
        fileId: 1,
        text: 1,
        page: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  return results;
}

// ─────────────────────────────────────────────────────────────────
//  searchAcrossAllPdfs
//
//  Convenience wrapper — searches ALL documents without a fileId filter.
//  Returns chunks annotated with their parent fileId so the caller
//  can group or label results by document.
// ─────────────────────────────────────────────────────────────────
async function searchAcrossAllPdfs(queryEmbedding, limit = 10) {
  const results = await PdfChunk.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 200,
        limit: limit,
      },
    },
    {
      $project: {
        _id: 1,
        fileId: 1,
        text: 1,
        page: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
    // Lookup the parent document name so UI can show "from: filename.pdf"
    {
      $lookup: {
        from: "pdfdocuments",       // Mongoose pluralises "PdfDocument" → "pdfdocuments"
        localField: "fileId",
        foreignField: "_id",
        as: "document",
      },
    },
    {
      $unwind: {
        path: "$document",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        text: 1,
        page: 1,
        score: 1,
        fileId: 1,
        fileName: "$document.fileName",
      },
    },
  ]);

  return results;
}

module.exports = searchSimilarChunks;
module.exports.searchAcrossAllPdfs = searchAcrossAllPdfs;
