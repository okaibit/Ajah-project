// This file goes in a folder called "api" at the root of your project.
// Vercel automatically turns any file in /api into a live backend endpoint.
// So this file, once deployed, becomes: https://yoursite.vercel.app/api/chat
//
// This version uses Groq instead of Anthropic. Groq's API is "OpenAI-compatible",
// meaning the request/response shape follows OpenAI's format, not Anthropic's —
// that's why this looks a little different from the earlier version.

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

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid 'messages' array" });
    }

    // The API key lives ONLY here, on the server, read from an environment
    // variable — it is never sent to the browser or visible in your site's code.
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Server is missing GROQ_API_KEY" });
    }

    // Groq/OpenAI-style requests put the system prompt as the first message
    // in the array, with role "system" — unlike Anthropic which uses a
    // separate top-level "system" field.
    const groqMessages = [
      { role: "system", content: PROPERTY_CONTEXT },
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        // llama-3.3-70b-versatile is a strong, well-rounded free-tier-friendly model on Groq.
        // Swap to "llama-3.1-8b-instant" if you want faster/cheaper at slightly lower quality.
        model: "llama-3.3-70b-versatile",
        max_tokens: 500,
        messages: groqMessages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);
      return res.status(response.status).json({ error: "Failed to get a response from the assistant" });
    }

    const reply = data?.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
