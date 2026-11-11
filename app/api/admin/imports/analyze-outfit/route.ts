// ─── ILU SHOP — Gemini Outfit Analysis ──────────────────────────────────────
// POST /api/admin/imports/analyze-outfit
// Reçoit un flat lay → retourne les articles détectés

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const GEMINI_MODEL = 'gemini-2.0-flash';

function extractJSON(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  try { return JSON.parse(cleaned); } catch (_) { /* continue */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (_) { /* continue */ } }
  throw new Error(`Non parseable: ${raw.slice(0, 200)}`);
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, filename, mimeType } = await req.json() as {
      imageBase64: string; filename: string; mimeType: string;
    };

    if (!imageBase64) return NextResponse.json({ error: 'imageBase64 requis' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY manquante' }, { status: 500 });

    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const prompt = `Tu es un expert mode pour ILU SHOP (Kinshasa, RDC).
Analyse cette image de tenue (flat lay ou look porté) et identifie CHAQUE article vestimentaire visible.
Réponds en JSON brut uniquement (pas de markdown).

{
  "outfitName": "Nom accrocheur du look en français (ex: Look Casual Marine)",
  "outfitCategory": "casual ou business ou soiree ou streetwear ou tech",
  "season": "Toutes saisons ou Été ou Hiver ou Mi-saison",
  "items": [
    {
      "id": "item-1",
      "name": "Nom commercial précis de l'article en français (ex: T-shirt Oversized Blanc)",
      "category": "mode ou technologie ou hybrides ou services",
      "subcategory": "Vêtements ou Chaussures ou Bijoux & accessoires classiques ou Maroquinerie ou Parfums & beauté ou Téléphonie ou Accessoires tech",
      "priceUSD": 35,
      "description": "1 phrase de description",
      "brand": "Marque si visible sinon vide",
      "searchKeywords": ["mot1", "mot2"]
    }
  ]
}

Fichier source: "${filename}"
Règles:
- Identifie TOUS les articles visibles (vêtements, chaussures, accessoires, sac, ceinture, lunettes…)
- priceUSD = estimation juste en USD selon le marché africain (vêtements: 15-80, chaussures: 30-120, accessoires: 10-50)
- searchKeywords = 2-4 mots-clés courts pour chercher cet article dans un catalogue`;

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
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      throw new Error(`Gemini API ${geminiRes.status}: ${errBody.slice(0, 200)}`);
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    };

    if (geminiData.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      throw new Error('Réponse tronquée (MAX_TOKENS). Réessaie.');
    }

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('Réponse Gemini vide');

    const parsed = extractJSON(text);
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error('Aucun article détecté dans l\'image');
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[analyze-outfit] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analyse échouée' },
      { status: 500 },
    );
  }
}
