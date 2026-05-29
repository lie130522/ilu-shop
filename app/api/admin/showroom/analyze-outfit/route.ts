// ─── ILU SHOP — Gemini Outfit Analysis ────────────────────────────────────────
// POST /api/admin/showroom/analyze-outfit
// Analyse une photo d'outfit et détecte automatiquement les articles visibles.

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const GEMINI_MODEL = 'gemini-3.5-flash';

const VALID_CATEGORIES = [
  'Mode', 'Chaussures', 'Bijou', 'Accessoire',
  'Tech', 'Wearable', 'Parfum', 'Maroquinerie', 'Service',
];

function extractJSON(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();
  try { return JSON.parse(cleaned); } catch (_) { /* continue */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) { /* continue */ }
  }
  throw new Error(`Non parseable. Reçu : ${raw.slice(0, 150)}`);
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = (await req.json()) as {
      imageBase64: string;
      mimeType: string;
    };

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 requis' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY manquante' }, { status: 500 });
    }

    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const prompt = `Tu es un expert en mode et lifestyle pour ILU SHOP (Kinshasa, RDC).
Analyse cette photo d'outfit et identifie TOUS les articles vestimentaires, chaussures et accessoires visibles portés par la/les personne(s).

Pour chaque article identifié, fournis :
- name : nom commercial accrocheur en français (ex: "Veste Cargo Kaki", "Sneakers Air Force Blanc", "Montre Dorée Élégante")
- category : une valeur parmi ${VALID_CATEGORIES.join(', ')}
- estimatedPriceUSD : prix de vente estimé en USD (entier) — mode:15-80, chaussures:40-150, bijoux:10-60, maroquinerie:30-120, parfums:30-100

Réponds UNIQUEMENT en JSON brut sans markdown :
{"items":[{"name":"string","category":"string","estimatedPriceUSD":0}]}

Règles :
- Identifie tous les articles visibles, même partiellement
- Donne des noms commerciaux accrocheurs en français
- Maximum 8 articles
- Si aucun article n'est visible, retourne {"items":[]}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64Data } },
          ]}],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('[analyze-outfit] HTTP error:', geminiRes.status, errBody.slice(0, 200));
      throw new Error(`Gemini API ${geminiRes.status}: ${errBody.slice(0, 200)}`);
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };

    const candidate = geminiData.candidates?.[0];
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new Error('Réponse tronquée. Réessaie.');
    }

    const text = candidate?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('Réponse Gemini vide');

    const parsed = extractJSON(text);

    const items = Array.isArray(parsed.items)
      ? (parsed.items as Array<Record<string, unknown>>)
          .slice(0, 8)
          .map((item) => ({
            name: typeof item.name === 'string' && item.name ? item.name : 'Article',
            category: VALID_CATEGORIES.includes(item.category as string)
              ? (item.category as string)
              : 'Mode',
            estimatedPriceUSD:
              typeof item.estimatedPriceUSD === 'number' && item.estimatedPriceUSD > 0
                ? Math.round(item.estimatedPriceUSD as number)
                : 30,
          }))
      : [];

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Aucun article détecté dans cette photo. Essayez avec une photo plus claire.' },
        { status: 422 },
      );
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error('[analyze-outfit] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analyse échouée' },
      { status: 500 },
    );
  }
}
