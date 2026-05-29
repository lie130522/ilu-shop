// ─── ILU SHOP — Gemini Image Analysis for Bulk Import ────────────────────────
// POST /api/admin/imports/analyze-image
// Prend une image base64 et retourne les métadonnées produit extraites par Gemini

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, filename, mimeType } = (await req.json()) as {
      imageBase64: string;
      filename: string;
      mimeType: string;
    };

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 requis' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel(
      { model: 'gemini-2.5-flash-preview-05-20' },
      { apiVersion: 'v1alpha' },
    );

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

Note: le nom du fichier peut aider à identifier le produit: "${filename}"

Règles:
- priceUSD doit être un nombre entier raisonnable en USD (vêtements: 15-80, chaussures: 40-150, parfums: 30-120, tech: 50-500)
- Si le produit n'est pas clairement identifiable, utilise des valeurs génériques cohérentes
- La subcategory DOIT correspondre à la catégorie choisie`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: base64Data,
        },
      },
    ]);

    const text = result.response.text().trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Gemini a parfois des balises markdown malgré la consigne
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[analyze-image] Non-JSON response:', text.slice(0, 200));
        throw new Error('Réponse Gemini non parseable');
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Validation et nettoyage
    const validCategories = ['mode', 'technologie', 'hybrides', 'services'];
    if (!validCategories.includes(parsed.category as string)) {
      parsed.category = 'mode';
    }

    if (typeof parsed.priceUSD !== 'number' || parsed.priceUSD <= 0) {
      parsed.priceUSD = 30;
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[analyze-image] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analyse échouée' },
      { status: 500 },
    );
  }
}
