/* ============================================================
   fileDetail.js
   Handles:
     - Chat drawer open / close
     - Sending messages to POST /api/chat
     - Maintaining conversation history
     - Scrolling doc panel to matched lines
   ============================================================ */

(function () {
  "use strict";

  /* ── DOM refs ── */
  const chatOpenBtn  = document.getElementById("chatOpenBtn");
  const chatCloseBtn = document.getElementById("chatCloseBtn");
  const chatDrawer   = document.getElementById("chatDrawer");
  const chatOverlay  = document.getElementById("chatOverlay");
  const chatMessages = document.getElementById("chatMessages");
  const chatInput    = document.getElementById("chatInput");
  const chatSendBtn  = document.getElementById("chatSendBtn");

  /* ── State ── */
  const fileId = window.FILE_ID;
  /** @type {{ role: "user" | "assistant", content: string }[]} */
  const history = [];

  /* ══════════════════════════════════════
     DRAWER OPEN / CLOSE
  ══════════════════════════════════════ */
  function openDrawer() {
    chatDrawer.classList.add("open");
    chatOverlay.classList.add("open");
    chatInput.focus();
  }

  function closeDrawer() {
    chatDrawer.classList.remove("open");
    chatOverlay.classList.remove("open");
  }

  chatOpenBtn.addEventListener("click", openDrawer);
  chatCloseBtn.addEventListener("click", closeDrawer);
  chatOverlay.addEventListener("click", closeDrawer);

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  /* ══════════════════════════════════════
     SEND MESSAGE
  ══════════════════════════════════════ */
  async function sendMessage() {
    const question = chatInput.value.trim();
    if (!question) return;

    // Render user bubble
    appendBubble("user", question);
    history.push({ role: "user", content: question });
    chatInput.value = "";
    chatSendBtn.disabled = true;

    // Typing indicator
    const typingId = appendTyping();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          fileId,
          history: history.slice(0, -1), // send history BEFORE current question
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      removeTyping(typingId);

      // Render assistant bubble
      appendBubble("assistant", data.answer);
      history.push({ role: "assistant", content: data.answer });

      // Optional: log sources to console for debugging
      if (data.sources && data.sources.length) {
        console.log("Source chunks used:", data.sources);
      }
    } catch (err) {
      removeTyping(typingId);
      appendBubble(
        "assistant",
        `⚠️ Error: ${err.message}. Please try again.`
      );
    } finally {
      chatSendBtn.disabled = false;
      chatInput.focus();
    }
  }

  chatSendBtn.addEventListener("click", sendMessage);

  // Send on Enter (Shift+Enter = newline)
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  /* ══════════════════════════════════════
     BUBBLE HELPERS
  ══════════════════════════════════════ */
  function appendBubble(role, text) {
    const msg = document.createElement("div");
    msg.classList.add("chat-msg", role);

    const bubble = document.createElement("div");
    bubble.classList.add("msg-bubble");
    bubble.textContent = text;

    msg.appendChild(bubble);
    chatMessages.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  let typingCounter = 0;

  function appendTyping() {
    const id = `typing-${++typingCounter}`;
    const msg = document.createElement("div");
    msg.classList.add("chat-msg", "assistant");
    msg.id = id;

    const bubble = document.createElement("div");
    bubble.classList.add("msg-bubble", "typing-indicator");
    bubble.innerHTML = "<span></span><span></span><span></span>";

    msg.appendChild(bubble);
    chatMessages.appendChild(msg);
    scrollToBottom();
    return id;
  }

  function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /* ══════════════════════════════════════
     SCROLL DOC TO MATCHED LINE
     (click a match card → jump to line)
  ══════════════════════════════════════ */
 document.querySelectorAll(".match-item").forEach((item) => {
  item.addEventListener("click", () => {
    const lineNum = item.dataset.line;
    const matchText = item.querySelector(".match-text")?.textContent?.trim().slice(0, 60);

    // For keyword mode — scroll to line number
    if (lineNum && lineNum !== "undefined") {
      const target = document.getElementById(`line-${lineNum}`);
      if (target) {
        document.querySelectorAll(".doc-line.highlight").forEach(el => el.classList.remove("highlight"));
        target.classList.add("highlight");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    // For semantic mode — find the text in the document and scroll to it
    if (matchText) {
      const allLines = document.querySelectorAll(".doc-line");
      for (const line of allLines) {
        if (line.textContent.includes(matchText.slice(0, 40))) {
          document.querySelectorAll(".doc-line.highlight").forEach(el => el.classList.remove("highlight"));
          line.classList.add("highlight");
          line.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
        }
      }
    }
  });
});
// On page load with results — auto-scroll doc to first match
const firstMatch = document.querySelector(".match-item");
if (firstMatch) {
  firstMatch.click(); // triggers the scroll logic above
}
})();