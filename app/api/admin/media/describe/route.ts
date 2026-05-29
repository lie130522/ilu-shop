// POST /api/admin/media/describe
// Analyse une image produit avec Gemini Vision et génère automatiquement
// le nom, les descriptions et les tags.
// Body JSON : { imageBase64: string, category: string, tone?: string }
// Retourne  : { name, shortDescription, description, tags[] }

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// ── Helper : extrait le JSON le plus robustement possible ─────────────────────

function extractJSON(raw: string): Record<string, unknown> {
  // 1. Nettoyer les balises markdown
  const cleaned = raw
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();

  // 2. Tentative directe
  try { return JSON.parse(cleaned); } catch (_) { /* continue */ }

  // 3. Extraction par regex — premier objet JSON valide trouvé
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) { /* continue */ }
  }

  // 4. Réparation basique : fermer un JSON tronqué
  const truncated = cleaned.replace(/,\s*$/, '') + '"}';
  try { return JSON.parse(truncated); } catch (_) { /* continue */ }

  throw new Error(`Réponse Gemini non parseable. Reçu : ${raw.slice(0, 150)}`);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY manquante dans les variables d'environnement." },
      { status: 503 },
    );
  }

  let imageBase64: string;
  let category: string;
  let tone: string;
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
    category = body.category || 'mode';
    tone = body.tone || 'editorial';
    if (!imageBase64) throw new Error('imageBase64 requis');
  } catch (e) {
    return NextResponse.json({ error: 'Body invalide : ' + String(e) }, { status: 400 });
  }

  // ── Résolution de l'image (URL Firebase Storage ou base64 direct) ─────────

  let mimeType = 'image/jpeg';
  let base64Data: string;

  if (imageBase64.startsWith('http://') || imageBase64.startsWith('https://')) {
    try {
      const imgRes = await fetch(imageBase64);
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      mimeType = contentType.split(';')[0].trim();
      base64Data = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
    } catch (e) {
      return NextResponse.json(
        { error: `Impossible de récupérer l'image depuis l'URL : ${String(e)}` },
        { status: 400 },
      );
    }
  } else {
    mimeType = imageBase64.startsWith('data:image/png')
      ? 'image/png'
      : imageBase64.startsWith('data:image/webp')
        ? 'image/webp'
        : 'image/jpeg';
    base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  }

  // ── Prompt ────────────────────────────────────────────────────────────────

  const categoryLabels: Record<string, string> = {
    mode:        'Mode (vêtements, chaussures, bijoux, accessoires, parfums)',
    technologie: 'Technologie (smartphones, ordinateurs, accessoires tech)',
    hybrides:    'Wearables & Hybrides (montres connectées, bracelets fitness)',
    services:    'Services digitaux (abonnements, forfaits data)',
  };

  const toneInstructions: Record<string, string> = {
    editorial:  'Ton éditorial : élégant, narratif, inspirationnel. Style magazine de luxe.',
    commercial: 'Ton commercial : direct, percutant, axé sur les bénéfices et la valeur.',
    luxe:       'Ton luxe : raffiné, exclusif, vocabulaire haut de gamme, sensorialité.',
    jeune:      'Ton jeune & urbain : casual, moderne, accessible, sans jargon technique.',
  };

  const prompt = `Tu es un expert en e-commerce spécialisé dans la rédaction de fiches produit pour ILU SHOP (Kinshasa, RDC).
Analyse cette image de produit dans la catégorie "${categoryLabels[category] || category}".
${toneInstructions[tone] || toneInstructions.editorial}

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans backticks) :
{"name":"Nom du produit court et commercial (2-5 mots, français)","shortDescription":"Accroche courte max 80 caractères","description":"Description commerciale 150-250 mots en français, caractéristiques visuelles, matière, style, occasions d'usage","tags":["tag1","tag2","tag3","tag4","tag5"]}

Les tags = mots-clés de recherche (catégorie, matière, couleur, style, usage). JSON brut uniquement.`;

  // ── Appel Gemini ─────────────────────────────────────────────────────────

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mimeType, data: base64Data } },
            { text: prompt },
          ]}],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,   // Augmenté : 1024 coupait le JSON en plein milieu
            responseMimeType: 'application/json',  // Force le mode JSON natif
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      throw new Error(`Gemini ${geminiRes.status}: ${errBody.slice(0, 300)}`);
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };

    const candidate = geminiData.candidates?.[0];

    // Vérifier que la réponse n'est pas tronquée
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new Error('Réponse Gemini tronquée (MAX_TOKENS). Réessaie.');
    }

    const rawText = candidate?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!rawText) throw new Error('Réponse Gemini vide');

    const parsed = extractJSON(rawText) as {
      name?: string;
      shortDescription?: string;
      description?: string;
      tags?: string[];
    };

    if (!parsed.name || !parsed.description) {
      throw new Error('Réponse Gemini incomplète (champs manquants)');
    }

    // Normaliser
    if (!parsed.shortDescription) parsed.shortDescription = parsed.description.slice(0, 80);
    if (!Array.isArray(parsed.tags)) parsed.tags = [];
    if (parsed.shortDescription.length > 120) {
      parsed.shortDescription = parsed.shortDescription.slice(0, 117) + '…';
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[describe]', err);
    return NextResponse.json(
      { error: 'Erreur Gemini : ' + String(err) },
      { status: 500 },
    );
  }
}
