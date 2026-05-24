// POST /api/admin/imports/scrape
// Body: { url: string }
// Retourne: { title, description, images[], price, currency }

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const maxDuration = 30;

interface ScrapeResult {
  title: string;
  description: string;
  images: string[];
  price: string;
  currency: string;
  url: string;
  siteName: string;
}

function extractPrice(text: string): { price: string; currency: string } {
  // Try common price patterns
  const usdMatch = text.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  if (usdMatch) return { price: usdMatch[1].replace(',', ''), currency: 'USD' };

  const fcMatch = text.match(/([\d\s]+(?:[\.,]\d+)?)\s*(?:FC|CDF|Francs?)/i);
  if (fcMatch) return { price: fcMatch[1].replace(/\s/g, ''), currency: 'CDF' };

  const euroMatch = text.match(/€\s?([\d,]+(?:[.,]\d{1,2})?)/);
  if (euroMatch) return { price: euroMatch[1].replace(',', '.'), currency: 'EUR' };

  const numMatch = text.match(/([\d,]+(?:\.\d{1,2})?)/);
  if (numMatch) return { price: numMatch[1], currency: 'USD' };

  return { price: '', currency: 'USD' };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json() as { url: string };

    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
    }

    // Fetch the page
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Impossible d'accéder au site (${res.status})` }, { status: 422 });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // ── Title ────────────────────────────────────────────────────────────────
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      $('title').text().trim() ||
      '';

    // ── Description ──────────────────────────────────────────────────────────
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('[itemprop="description"]').first().text().trim() ||
      $('.product-description, .description, #description').first().text().trim().slice(0, 500) ||
      '';

    // ── Images ───────────────────────────────────────────────────────────────
    const images: string[] = [];
    const baseUrl = new URL(url).origin;

    // OG image first
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      images.push(ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`);
    }

    // Product images
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy');
      if (!src) return;
      const width = parseInt($(el).attr('width') ?? '0');
      const height = parseInt($(el).attr('height') ?? '0');
      // Skip tiny images (icons, etc.)
      if (width > 0 && width < 100) return;
      if (height > 0 && height < 100) return;
      const fullSrc = src.startsWith('http') ? src : `${baseUrl}${src}`;
      if (!images.includes(fullSrc) && images.length < 8) {
        images.push(fullSrc);
      }
    });

    // ── Price ────────────────────────────────────────────────────────────────
    let rawPrice =
      $('[itemprop="price"]').attr('content') ||
      $('[itemprop="price"]').first().text().trim() ||
      $('meta[property="product:price:amount"]').attr('content') ||
      $('.price, .product-price, [class*="price"]').first().text().trim() ||
      '';

    const { price, currency: priceCurrency } =
      rawPrice ? extractPrice(rawPrice) : { price: '', currency: 'USD' };

    // ── Site name ────────────────────────────────────────────────────────────
    const siteName =
      $('meta[property="og:site_name"]').attr('content') ||
      new URL(url).hostname.replace('www.', '');

    const result: ScrapeResult = {
      title: title.slice(0, 200),
      description: description.slice(0, 1000),
      images: images.slice(0, 8),
      price,
      currency: priceCurrency,
      url,
      siteName,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json({ error: `Erreur lors du scraping : ${message}` }, { status: 500 });
  }
}
