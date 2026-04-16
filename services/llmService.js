const OpenAI = require("openai");

// Groq exposes an OpenAI-compatible API — we just swap the baseURL
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// ─────────────────────────────────────────────────────────────────
//  generateAnswer
//
//  question    : string          — user's current question
//  context     : string          — retrieved chunks joined together
//  history     : Message[]       — optional prior turns
//                [{ role: "user"|"assistant", content: string }]
// ─────────────────────────────────────────────────────────────────
async function generateAnswer(question, context, history = []) {
  const systemPrompt = `You are an AI assistant answering questions from a PDF document.

Rules:
1. Answer ONLY using the provided context.
2. If the answer is not in the context, say "Not found in document".
3. Detect the language of the user's question and reply in the SAME language.
4. The user may write in English, Hindi, or Hinglish (Hindi written in English letters).
5. The user may make spelling mistakes or typos — intelligently interpret what they meant.
6. Correct the meaning internally but DO NOT mention the correction in your answer.
7. Never guess information that is not present in the context.
8. If the question is ambiguous, ask for clarification instead of guessing.
9. Always be concise and to the point in your answers.
10. If the question is vague, provide a general answer based on the context.
11. Always maintain a helpful and informative tone.
12. If the user asks for a summary, provide a concise summary based on the context.
13. If the user asks to continue or expand, continue based on the previous answer.
14. If the answer cannot be found in the context, say "Not found in document — do you want me to search the web?"

Context:
${context}`;

  // Build message array: system + history + current question
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: question },
  ];

  const response = await client.chat.completions.create({
    model: "llama-3.1-8b-instant",   // fast Groq-hosted Llama 3.1
    messages,
    temperature: 0.3,
    max_tokens: 1024,
  });

  return response.choices[0].message.content;
}

module.exports = generateAnswer;
