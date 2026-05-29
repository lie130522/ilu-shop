// ─── ILU SHOP — Gemini Image Analysis for Bulk Import ────────────────────────
// POST /api/admin/imports/analyze-image
// Appel direct REST Gemini v1beta — gemini-3.5-flash

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const GEMINI_MODEL = 'gemini-3.5-flash';

// ── Helper : extrait le JSON le plus robustement possible ─────────────────────

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
    const { imageBase64, filename, mimeType } = (await req.json()) as {
      imageBase64: string;
      filename:   string;
      mimeType:   string;
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

    const prompt = `Tu es un expert en e-commerce mode et lifestyle pour ILU SHOP (Kinshasa, RDC).
Analyse cette image et réponds en JSON brut uniquement (pas de markdown).

{"name":"Nom commercial accrocheur en français (ex: Polo Sable Premium)","category":"mode ou technologie ou hybrides ou services","subcategory":"Vêtements ou Chaussures ou Bijoux & accessoires classiques ou Maroquinerie ou Parfums & beauté ou Téléphonie ou Informatique ou Accessoires tech ou Wearables / accessoires connectés ou Abonnements plateformes ou Forfaits data","shortDescription":"Phrase max 80 caractères","description":"2-3 phrases éditoriales en français","priceUSD":45,"tags":["tag1","tag2","tag3"],"genre":"homme ou femme ou mixte ou enfant"}

Fichier source (indice): "${filename}"
Règles: priceUSD entier en USD (vêtements:15-80, chaussures:40-150, parfums:30-120, tech:50-500). La subcategory DOIT correspondre à la category.`;

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
            maxOutputTokens: 2048,  // Augmenté pour éviter le JSON tronqué
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('[analyze-image] HTTP error:', geminiRes.status, errBody.slice(0, 200));
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
      throw new Error('Réponse tronquée (MAX_TOKENS). Réessaie.');
    }

    const text = candidate?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('Réponse Gemini vide');

    const parsed = extractJSON(text);

    // Validation et valeurs par défaut
    const validCategories = ['mode', 'technologie', 'hybrides', 'services'];
    if (!validCategories.includes(parsed.category as string)) parsed.category = 'mode';
    if (typeof parsed.priceUSD !== 'number' || (parsed.priceUSD as number) <= 0) parsed.priceUSD = 30;
    if (!parsed.name) parsed.name = nameFromFilename(filename);
    if (!Array.isArray(parsed.tags)) parsed.tags = [];

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[analyze-image] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analyse échouée' },
      { status: 500 },
    );
  }
}

function nameFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/whatsapp image .+/i, 'Nouveau produit')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Nouveau produit';
}
