// A minimal local server for testing — serves your static site AND runs
// the same chat logic as api/chat.js, without needing the Vercel CLI at all.
//
// Run it with:  node server.js
// Then visit:   http://localhost:3000
//
// This uses ONLY Node's built-in modules (no npm install needed), so there's
// nothing here that can hit the same esbuild/macOS compatibility issue.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;

// ---- Load GROQ_API_KEY from .env.local manually (no extra packages needed) ----
function loadEnvLocal() {
  const envPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }
  return env;
}

const env = loadEnvLocal();
const GROQ_API_KEY = env.GROQ_API_KEY;

const PROPERTY_CONTEXT = `You are the AI assistant for Aurevia, a residential development by smartrealty.ng in Ajah, Lagos State, Nigeria.

FACTS YOU KNOW (only use these — never invent details you don't have):
- Project name: Aurevia
- Developer / company: smartrealty.ng (RC 1942184)
- Location: Ajah, Lagos State (exact street not yet finalized)
- Unit A: 4 Bedroom Semi-Detached Duplex — ₦150,000,000
- Unit B: 4 Bedroom Semi-Detached Duplex with BQ (Boys' Quarters) — ₦170,000,000
- Both units: 4 bedrooms, same layout and finish, difference is the BQ
- Title type: not yet confirmed
- Delivery timeline: not yet confirmed
- Amenities: not yet finalized/published
- Contact: WhatsApp +234 810 527 6537, Instagram @smartrealty.ng

RULES:
- If asked something you don't have facts for (amenities, exact street, title type, delivery date), say it honestly isn't confirmed yet and offer to connect them with the team on WhatsApp.
- Keep answers short and conversational — 2-4 sentences, like a helpful real estate agent texting back, not a formal document.
- If someone seems ready to move forward (asking about booking, payment, inspection), encourage them to reach out via WhatsApp and offer to hand them off.
- Never make up a price, amenity, or fact not listed above.`;

const MIME_TYPES = {
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (req, res) => {
  // ---- Handle the chat API endpoint ----
  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        if (!GROQ_API_KEY) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing GROQ_API_KEY in .env.local" }));
          return;
        }

        const { messages } = JSON.parse(body);
        const groqMessages = [
          { role: "system", content: PROPERTY_CONTEXT },
          ...messages.map((m) => ({ role: m.role, content: m.content }))
        ];

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            max_tokens: 500,
            messages: groqMessages
          })
        });

        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        console.error(err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Something went wrong" }));
      }
    });
    return;
  }

  // ---- Otherwise, serve static files (index.html, images, etc.) ----
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, decodeURIComponent(filePath.split("?")[0]));

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Local test server running at http://localhost:${PORT}`);
  if (!GROQ_API_KEY) {
    console.log("WARNING: GROQ_API_KEY not found in .env.local — chat will not work until it's set.");
  }
});
