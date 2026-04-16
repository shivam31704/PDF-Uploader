const createEmbedding = require("../services/embeddingService");
const searchSimilarChunks = require("../services/vectorSearchService");
const generateAnswer = require("../services/llmService");

// ─────────────────────────────────────────────────────────────────
//  POST /api/chat
//
//  Body:
//    question  : string          — user message
//    fileId    : string          — MongoDB ObjectId of the active PDF
//    history   : Message[]       — optional prior conversation turns
//                [{ role: "user"|"assistant", content: string }]
// ─────────────────────────────────────────────────────────────────
async function chatWithPdf(req, res) {
  try {
    const { question, fileId, history = [] } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Question is required" });
    }

    if (!fileId) {
      return res.status(400).json({ error: "fileId is required" });
    }

    // 1️⃣  Embed the question
    const queryEmbedding = await createEmbedding(question);

    // 2️⃣  Vector search — retrieve top matching chunks from this PDF
    const chunks = await searchSimilarChunks(queryEmbedding, fileId, 5);
    console.log(`Retrieved ${chunks.length} chunks for fileId: ${fileId}`);

    if (chunks.length === 0) {
      return res.json({
        answer: "I could not find any relevant content in this document for your question.",
        sources: [],
      });
    }

    // 3️⃣  Build context string from chunks
    const context = chunks
      .map((c, i) => `[Chunk ${i + 1}]:\n${c.text}`)
      .join("\n\n");

    console.log("Context sent to LLM (first 300 chars):", context.slice(0, 300));

    // 4️⃣  Generate answer via Groq LLM, passing conversation history
    const answer = await generateAnswer(question, context, history);

    // 5️⃣  Return answer + source chunks for optional citation UI
    return res.json({
      answer,
      sources: chunks.map((c) => ({
        text: c.text.slice(0, 200),   // trimmed preview
        score: c.score ?? null,
        page: c.page ?? null,
      })),
    });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: "Chat failed: " + err.message });
  }
}

module.exports = { chatWithPdf };
