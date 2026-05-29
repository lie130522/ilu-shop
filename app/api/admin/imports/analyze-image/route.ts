// ─── ILU SHOP — Gemini Image Analysis for Bulk Import ────────────────────────
// POST /api/admin/imports/analyze-image
// Appel direct à l'API REST Gemini (v1alpha) pour contourner les limitations
// du SDK @google/generative-ai v0.24 qui ne supporte pas les modèles 2.5

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_MODEL  = 'gemini-2.5-flash-preview-05-20';
const GEMINI_API_VERSION = 'v1alpha';

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

    // Retirer le préfixe data URL si présent
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const prompt = `Tu es un expert en e-commerce mode et lifestyle. Analyse cette image de produit vendu en Afrique centrale (Kinshasa, RDC).
Réponds UNIQUEMENT avec du JSON valide brut (pas de \`\`\`json, pas de markdown, juste le JSON).

{
  "name": "Nom commercial du produit en français, accrocheur (ex: Polo Sable Premium, Timberland Jaune Moutarde, Parfum Khamrah)",
  "category": "Exactement une valeur parmi: mode, technologie, hybrides, services",
  "subcategory": "Exactement une valeur parmi selon la catégorie — mode: [Vêtements, Chaussures, Bijoux & accessoires classiques, Maroquinerie, Parfums & beauté] — technologie: [Téléphonie, Informatique, Accessoires tech] — hybrides: [Wearables / accessoires connectés] — services: [Abonnements plateformes, Forfaits data]",
  "shortDescription": "Une phrase de 80 caractères max, accrocheur",
  "description": "Description de 2-3 phrases pour la fiche produit, ton éditorial, en français",
  "priceUSD": 45,
  "tags": ["tag1", "tag2", "tag3"],
  "genre": "homme ou femme ou mixte ou enfant"
}

Nom du fichier source: "${filename}"

Règles:
- priceUSD = nombre entier en USD (vêtements: 15-80, chaussures: 40-150, parfums: 30-120, tech: 50-500)
- La subcategory DOIT correspondre exactement à la catégorie choisie`;

    // Appel direct à l'API REST Gemini en v1alpha
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64Data } },
            ],
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('[analyze-image] Gemini HTTP error:', geminiRes.status, errBody);
      throw new Error(`Gemini API ${geminiRes.status}: ${errBody.slice(0, 200)}`);
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('Réponse Gemini vide');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[analyze-image] Non-JSON:', text.slice(0, 300));
        throw new Error('Réponse Gemini non parseable');
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Validation
    const validCategories = ['mode', 'technologie', 'hybrides', 'services'];
    if (!validCategories.includes(parsed.category as string)) parsed.category = 'mode';
    if (typeof parsed.priceUSD !== 'number' || parsed.priceUSD <= 0) parsed.priceUSD = 30;

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[analyze-image] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analyse échouée' },
      { status: 500 },
    );
  }
}
