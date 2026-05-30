// ─── ILU SHOP — Gemini Text Description ───────────────────────────────────────
// POST /api/admin/imports/describe-item
// Génère une fiche produit complète depuis un nom/catégorie/prix (sans image).
// Utilisé quand un article de l'outfit n'existe pas encore dans le catalogue.

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

const GEMINI_MODEL = 'gemini-3.5-flash';

function extractJSON(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  try { return JSON.parse(cleaned); } catch (_) { /* continue */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (_) { /* continue */ } }
  throw new Error(`Non parseable. Reçu : ${raw.slice(0, 150)}`);
}

export async function POST(req: NextRequest) {
  try {
    const { name, category, priceUSD } = (await req.json()) as {
      name: string;
      category: string;
      priceUSD: number;
    };

    if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY manquante' }, { status: 500 });

    const subcategoryHint: Record<string, string> = {
      Mode: 'Vêtements', Chaussures: 'Chaussures', Bijou: 'Bijoux & accessoires classiques',
      Accessoire: 'Bijoux & accessoires classiques', Maroquinerie: 'Maroquinerie',
      Parfum: 'Parfums & beauté', Tech: 'Téléphonie', Wearable: 'Wearables / accessoires connectés',
      Service: 'Abonnements plateformes',
    };
    const suggestedSub = subcategoryHint[category] ?? 'Vêtements';

    const prompt = `Tu es un expert en e-commerce mode et lifestyle pour ILU SHOP (Kinshasa, RDC).
Génère une fiche produit complète pour cet article :

Nom détecté : "${name}"
Catégorie : ${category} (sous-catégorie suggérée : ${suggestedSub})
Prix estimé : $${priceUSD ?? 0}

Réponds UNIQUEMENT en JSON brut sans markdown :
{
  "name": "Nom commercial accrocheur en français",
  "category": "mode",
  "subcategory": "${suggestedSub}",
  "shortDescription": "1 phrase max 80 caractères",
  "description": "2-3 phrases éditoriales élégantes en français",
  "tags": ["tag1","tag2","tag3"],
  "genre": "homme ou femme ou mixte ou enfant",
  "material": "matière principale (coton, cuir, denim…) ou vide si non applicable",
  "priceUSD": ${priceUSD ?? 0}
}

Règles :
- Nom commercial accrocheur, style ILU SHOP
- Description éditoriale, jamais générique
- Tags utiles pour la recherche (3-5 tags)
- category toujours en minuscule parmi : mode, technologie, hybrides, services`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 512, responseMimeType: 'application/json' },
        }),
      },
    );

    if (!res.ok) throw new Error(`Gemini ${res.status}`);

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('Réponse Gemini vide');

    const parsed = extractJSON(text);

    // Normaliser la catégorie
    const validCats = ['mode', 'technologie', 'hybrides', 'services'];
    if (!validCats.includes(parsed.category as string)) parsed.category = 'mode';
    if (typeof parsed.priceUSD !== 'number') parsed.priceUSD = priceUSD ?? 0;
    if (!Array.isArray(parsed.tags)) parsed.tags = [];

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[describe-item] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 },
    );
  }
}
