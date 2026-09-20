// Fonction serverless Vercel — POST /api/analyze
// Reçoit { image: <base64 sans préfixe>, mediaType: "image/jpeg" }
// Appelle l'API Gemini de Google (niveau gratuit, vision) et renvoie un verdict JSON.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

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

  const apiKey = process.env.GEMINI_API_KEY;
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
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: mediaType || "image/jpeg", data: image } },
              { text: PROMPT }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        res.status(429).json({ error: "rate_limited" });
        return;
      }
      res.status(502).json({ error: "upstream_error" });
      return;
    }

    const data = await response.json();
    const text = (data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts.map((p) => p.text || "").join("")) || "";

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

