const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");
const send = document.getElementById("send");
const resetBtn = document.getElementById("reset");
const empty = document.getElementById("empty");

let history = [];
let busy = false;

function addBubble(role, text = "") {
  empty.hidden = true;
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function autosize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 180) + "px";
}

async function sendMessage(text) {
  busy = true;
  send.disabled = true;
  history.push({ role: "user", content: text });
  addBubble("user", text);
  const bubble = addBubble("assistant");
  bubble.classList.add("pending");

  let reply = "";
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      reply += decoder.decode(value, { stream: true });
      bubble.textContent = reply;
      chat.scrollTop = chat.scrollHeight;
    }
    if (!res.ok && !reply) reply = "⚠️ Error del servidor.";
  } catch {
    reply += "\n\n⚠️ Se perdió la conexión con el servidor.";
  }
  bubble.textContent = reply;
  bubble.classList.remove("pending");
  if (reply.trim()) history.push({ role: "assistant", content: reply });
  else history.pop();
  busy = false;
  send.disabled = false;
  input.focus();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || busy) return;
  input.value = "";
  autosize();
  sendMessage(text);
});

input.addEventListener("input", autosize);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

resetBtn.addEventListener("click", () => {
  if (busy) return;
  history = [];
  chat.querySelectorAll(".msg").forEach((m) => m.remove());
  empty.hidden = false;
  input.focus();
});
