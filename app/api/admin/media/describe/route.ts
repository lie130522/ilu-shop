// POST /api/admin/media/describe
// Analyse une image produit avec Gemini Vision et génère automatiquement
// le nom, les descriptions et les tags.
// Body JSON : { imageBase64: string, category: string, tone?: string }
// Retourne  : { name, shortDescription, description, tags[] }

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY manquante dans les variables d\'environnement.' },
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

  // Extraire le type MIME et les données base64 pures
  const mimeType = imageBase64.startsWith('data:image/png')
    ? 'image/png'
    : imageBase64.startsWith('data:image/webp')
      ? 'image/webp'
      : 'image/jpeg';
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  const categoryLabels: Record<string, string> = {
    mode:        'Mode (vêtements, chaussures, bijoux, accessoires, parfums)',
    technologie: 'Technologie (smartphones, ordinateurs, accessoires tech)',
    hybrides:    'Wearables & Hybrides (montres connectées, bracelets fitness)',
    services:    'Services digitaux (abonnements, forfaits data)',
  };
  const categoryLabel = categoryLabels[category] || category;

  const toneInstructions: Record<string, string> = {
    editorial:  'Ton éditorial : élégant, narratif, inspirationnel. Style magazine de luxe.',
    commercial: 'Ton commercial : direct, percutant, axé sur les bénéfices et la valeur.',
    luxe:       'Ton luxe : raffiné, exclusif, vocabulaire haut de gamme, sensorialité.',
    jeune:      'Ton jeune & urbain : casual, moderne, accessible, sans jargon technique.',
  };
  const toneInstruction = toneInstructions[tone] || toneInstructions.editorial;

  const prompt = `Tu es un expert en e-commerce spécialisé dans la rédaction de fiches produit pour ILU SHOP (Kinshasa, RDC).
Analyse cette image de produit dans la catégorie "${categoryLabel}".

${toneInstruction}

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans backticks, sans commentaires) :
{
  "name": "Nom du produit court et commercial (2-5 mots, en français)",
  "shortDescription": "Accroche courte pour la carte produit (max 80 caractères, percutante)",
  "description": "Description commerciale complète en français (150-250 mots). Décris les caractéristiques visuelles, la matière supposée, le style, les occasions de port/usage.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Les tags doivent être des mots-clés de recherche pertinents (catégorie, matière, couleur, style, usage).
Réponds uniquement avec le JSON brut, rien d'autre.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // gemini-2.0-flash — modèle multimodal recommandé (v0.24+)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
      { inlineData: { mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: base64Data } },
      { text: prompt },
    ]);

    const rawText = result.response.text().trim();

    // Nettoyer le markdown éventuel
    const jsonText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(jsonText) as {
      name: string;
      shortDescription: string;
      description: string;
      tags: string[];
    };

    // Validation basique
    if (!parsed.name || !parsed.shortDescription || !parsed.description || !Array.isArray(parsed.tags)) {
      throw new Error('Réponse Gemini incomplète');
    }

    // Tronquer shortDescription si trop long
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
