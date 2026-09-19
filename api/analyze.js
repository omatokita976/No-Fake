// Fonction serverless Vercel — POST /api/analyze
// Reçoit { image: <base64 sans préfixe>, mediaType: "image/jpeg" }
// Appelle l'API Anthropic (Claude) avec vision et renvoie un verdict JSON.

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

const PROMPT = `Tu es un expert en analyse forensique d'images, spécialisé dans la détection de montages photo et d'images générées par intelligence artificielle.

On te soumet une image (éventuellement une image extraite d'une vidéo). Examine-la attentivement à la recherche de signes révélateurs :
- incohérences de lumière, d'ombres ou de reflets
- textures de peau trop lisses ou trop régulières
- déformations autour des mains, doigts, dents, oreilles ou yeux
- arrière-plans déformés, flous incohérents, motifs qui se répètent anormalement
- texte illisible, déformé ou incohérent dans l'image
- bords ou transitions suspectes évoquant un montage/collage
- symétrie ou perfection excessive
- grain, compression ou netteté incohérents entre les zones de l'image

Réponds UNIQUEMENT avec un objet JSON strict, sans texte autour, au format exact suivant :
{"verdict": "authentique" | "montage" | "ia", "confiance": <entier 0-100>, "resume": "<une phrase de conclusion en français>", "indices": ["<indice observé 1>", "<indice observé 2>", "<indice observé 3 optionnel>"]}

"authentique" = aucun signe notable de montage ou de génération IA.
"montage" = photo réelle mais manifestement retouchée / composée à partir de plusieurs éléments.
"ia" = image très probablement générée ou fortement modifiée par une IA générative.

Sois honnête sur l'incertitude : si les indices sont faibles, ambigus ou peu nombreux, choisis une confiance modérée (40-65) plutôt qu'extrême. Ne mets jamais 100.`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "missing_key" });
    return;
  }

  const { image, mediaType } = req.body || {};
  if (!image || typeof image !== "string") {
    res.status(400).json({ error: "missing_image" });
    return;
  }
  // ~4MB base64 safety cap (Vercel serverless function body limit).
  if (image.length > 5_500_000) {
    res.status(413).json({ error: "too_large" });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: image
                }
              },
              { type: "text", text: PROMPT }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      res.status(502).json({ error: "upstream_error" });
      return;
    }

    const data = await response.json();
    const text = (data.content || [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      res.status(502).json({ error: "invalid_response" });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      res.status(502).json({ error: "invalid_response" });
      return;
    }

    res.status(200).json(parsed);
  } catch (e) {
    res.status(502).json({ error: "upstream_error" });
  }
};
