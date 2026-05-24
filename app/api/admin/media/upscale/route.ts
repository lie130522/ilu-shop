// POST /api/admin/media/upscale
// Upscale une image via Real-ESRGAN sur Replicate.com.
// Body JSON : { imageBase64: string, scale: 2 | 4 }
// Retourne  : { resultBase64: string }
//
// ⚠️  Cette route peut prendre 20-60 secondes selon la charge de Replicate.
//     maxDuration est mis à 60s pour éviter le timeout Vercel.

import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export const maxDuration = 60;

// Real-ESRGAN sur Replicate — modèle nightmareai/real-esrgan
const REALESRGAN_VERSION =
  '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b';

export async function POST(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token || token === 'your_replicate_api_token_here') {
    return NextResponse.json(
      { error: 'REPLICATE_API_TOKEN manquante. Ajoute-la dans .env.local.' },
      { status: 503 },
    );
  }

  let imageBase64: string;
  let scale: number;
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
    scale = body.scale === 4 ? 4 : 2;
    if (!imageBase64) throw new Error('imageBase64 requis');
  } catch (e) {
    return NextResponse.json({ error: 'Body invalide : ' + String(e) }, { status: 400 });
  }

  // S'assurer que c'est bien une data URL (Replicate l'accepte directement)
  const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

  try {
    const replicate = new Replicate({ auth: token });

    const output = await replicate.run(`nightmareai/real-esrgan:${REALESRGAN_VERSION}`, {
      input: {
        image: dataUrl,
        scale,
        face_enhance: false,
      },
    });

    // Replicate retourne une URL publique de l'image upscalée
    const outputUrl = Array.isArray(output) ? output[0] : String(output);
    if (!outputUrl) throw new Error('Replicate n\'a pas retourné d\'URL de sortie');

    // Télécharger l'image upscalée et la convertir en base64
    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) throw new Error(`Impossible de télécharger le résultat Replicate: ${imgRes.status}`);
    const arrayBuffer = await imgRes.arrayBuffer();
    const resultBase64 = Buffer.from(arrayBuffer).toString('base64');

    // Détecter le type MIME depuis les headers
    const contentType = imgRes.headers.get('content-type') || 'image/png';

    return NextResponse.json({
      resultBase64: `data:${contentType};base64,${resultBase64}`,
    });
  } catch (err) {
    console.error('[upscale]', err);
    return NextResponse.json(
      { error: 'Erreur Replicate : ' + String(err) },
      { status: 500 },
    );
  }
}
