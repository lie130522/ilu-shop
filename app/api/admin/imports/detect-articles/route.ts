// ─── ILU SHOP — Gemini Article Detection ──────────────────────────────────────
// POST /api/admin/imports/detect-articles
// Mode 'detect' : liste tous les articles visibles dans une image (avec positions).
// Mode 'describe' : génère la fiche complète d'un article sélectionné.

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
const GEMINI_MODEL = 'gemini-3.5-flash';

function extractJSON(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* continue */ } }
  throw new Error(`Non parseable : ${raw.slice(0, 150)}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      mode: 'detect' | 'describe';
      imageBase64: string;
      mimeType: string;
      instructions?: string;
      selectedArticle?: { name: string; category: string; position: string };
    };

    const { mode, imageBase64, mimeType, instructions, selectedArticle } = body;
    if (!imageBase64) return NextResponse.json({ error: 'imageBase64 requis' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY manquante' }, { status: 500 });

    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const prompt = mode === 'detect'
      ? `Tu es un expert en e-commerce mode et lifestyle pour ILU SHOP (Kinshasa, RDC).
Analyse cette image et liste TOUS les articles/produits visibles (vêtements, chaussures, accessoires, tech…).

Pour chaque article, fournis :
- name : nom commercial accrocheur en français
- category : "mode", "technologie", "hybrides", ou "services"
- subcategory : sous-catégorie (Vêtements, Chaussures, Bijoux & accessoires classiques, Maroquinerie, Parfums & beauté, Téléphonie, Informatique, Accessoires tech, Wearables / accessoires connectés)
- position : description visuelle précise de l'emplacement dans l'image (ex: "au centre porté par le mannequin", "en bas à gauche sur fond blanc", "au premier plan à droite")
- priceEstimate : prix de vente estimé en USD (entier)

${instructions ? `Instructions de l'admin : ${instructions}` : ''}

Réponds UNIQUEMENT en JSON brut :
{"articles":[{"name":"string","category":"string","subcategory":"string","position":"string","priceEstimate":0}]}

Règles : maximum 8 articles, positions très précises pour que l'admin identifie chaque article visuellement.`

      : (() => {
          const a = selectedArticle!;
          return `Tu es un expert en e-commerce mode et lifestyle pour ILU SHOP (Kinshasa, RDC).
Dans cette image, concentre-toi UNIQUEMENT sur cet article :
Nom : "${a.name}" · Position : ${a.position} · Catégorie : ${a.category}

${instructions ? `Instructions de l'admin : ${instructions}` : ''}

Génère une fiche produit complète. Réponds UNIQUEMENT en JSON brut :
{
  "name": "Nom commercial accrocheur en français",
  "category": "mode",
  "subcategory": "Vêtements",
  "shortDescription": "1 phrase max 80 caractères",
  "description": "2-3 phrases éditoriales élégantes",
  "priceUSD": 0,
  "tags": ["tag1","tag2","tag3"],
  "genre": "homme|femme|mixte|enfant",
  "material": "matière principale ou vide si non identifiable",
  "brand": "marque visible ou vide",
  "sizes": ["XS","S","M","L","XL"],
  "colors": [{"name":"Couleur principale","hex":"#xxxxxx"}]
}

Règles : stock par défaut = 10, brand vide si non visible, sizes selon la catégorie.`;
        })();

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64Data } },
          ]}],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: 'application/json' },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    };
    if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new Error('Réponse tronquée. Réessaie.');
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('Réponse Gemini vide');

    const parsed = extractJSON(text);

    if (mode === 'detect') {
      const articles = Array.isArray(parsed.articles) ? parsed.articles : [];
      if (articles.length === 0) {
        return NextResponse.json({ error: 'Aucun article détecté dans cette image.' }, { status: 422 });
      }
      return NextResponse.json({ articles });
    } else {
      const validCats = ['mode', 'technologie', 'hybrides', 'services'];
      if (!validCats.includes(parsed.category as string)) parsed.category = 'mode';
      if (typeof parsed.priceUSD !== 'number') parsed.priceUSD = 30;
      if (!Array.isArray(parsed.tags)) parsed.tags = [];
      if (!Array.isArray(parsed.sizes)) parsed.sizes = [];
      if (!Array.isArray(parsed.colors)) parsed.colors = [];
      return NextResponse.json(parsed);
    }
  } catch (err) {
    console.error('[detect-articles]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur' }, { status: 500 });
  }
}
