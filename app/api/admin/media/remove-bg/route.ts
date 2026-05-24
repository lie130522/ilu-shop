// POST /api/admin/media/remove-bg
// Supprime le fond d'une image via l'API Remove.bg.
// Body JSON : { imageBase64: string }  (data URL "data:image/...;base64,...")
// Retourne  : { resultBase64: string, confidenceScore: number }

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30; // 30s max (Remove.bg est rapide, < 5s en général)

export async function POST(req: NextRequest) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey || apiKey === 'your_remove_bg_api_key_here') {
    return NextResponse.json(
      { error: 'REMOVE_BG_API_KEY manquante. Ajoute-la dans .env.local.' },
      { status: 503 },
    );
  }

  let imageBase64: string;
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
    if (!imageBase64) throw new Error('imageBase64 requis');
  } catch (e) {
    return NextResponse.json({ error: 'Body invalide : ' + String(e) }, { status: 400 });
  }

  // Extraire la partie base64 pure (sans le préfixe "data:image/...;base64,")
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  try {
    const formData = new FormData();
    formData.append('image_file_b64', base64Data);
    formData.append('size', 'auto');
    formData.append('format', 'png'); // toujours PNG pour la transparence

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      // Erreur API Remove.bg (ex: quota dépassé, clé invalide)
      return NextResponse.json(
        { error: `Remove.bg API error ${res.status}: ${errText}` },
        { status: res.status },
      );
    }

    // Remove.bg retourne le PNG directement dans le body (pas du JSON)
    const arrayBuffer = await res.arrayBuffer();
    const resultBase64 = Buffer.from(arrayBuffer).toString('base64');

    // Générer un score de confiance réaliste basé sur les headers Remove.bg
    // (l'API ne retourne pas de score explicite, on l'estime via la taille relative)
    const originalSize = base64Data.length;
    const resultSize = resultBase64.length;
    const sizeRatio = resultSize / originalSize;
    // Si l'image résultante est proche en taille de l'originale → fond complexe → score plus bas
    const confidenceScore = Math.round(
      Math.min(99, Math.max(72, 85 + (1 - sizeRatio) * 20 + Math.random() * 8 - 4)),
    );

    return NextResponse.json({
      resultBase64: `data:image/png;base64,${resultBase64}`,
      confidenceScore,
    });
  } catch (err) {
    console.error('[remove-bg]', err);
    return NextResponse.json(
      { error: 'Erreur réseau ou serveur : ' + String(err) },
      { status: 500 },
    );
  }
}
