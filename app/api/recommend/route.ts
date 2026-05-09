import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface Preferences {
  coffeeStyle: string;
  vibe: string;
  activity: string;
  noiseLevel: string;
  priority: string;
  mustHave: string;
}

interface PlaceResult {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  editorialSummary?: { text: string };
  reviews?: Array<{ text: { text: string }; rating: number }>;
  currentOpeningHours?: { openNow: boolean };
  priceLevel?: string;
  websiteUri?: string;
}

async function searchCoffeeShops(city: string): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set');

  // First geocode the city to get coordinates
  const geocodeRes = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${apiKey}`
  );
  const geocodeData = await geocodeRes.json();

  if (!geocodeData.results?.length) {
    throw new Error(`Could not find location: ${city}`);
  }

  const { lat, lng } = geocodeData.results[0].geometry.location;

  // Search for coffee shops using Places API (New)
  const placesRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.editorialSummary,places.reviews,places.currentOpeningHours,places.priceLevel,places.websiteUri',
    },
    body: JSON.stringify({
      includedTypes: ['cafe'],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 2000,
        },
      },
      rankPreference: 'POPULARITY',
    }),
  });

  const placesData = await placesRes.json();
  return placesData.places || [];
}

function summarisePlaces(places: PlaceResult[]): string {
  return places.map((p, i) => {
    const reviews = p.reviews
      ?.slice(0, 3)
      .map(r => `"${r.text?.text?.substring(0, 200)}"`)
      .join(' | ') || 'No reviews available';

    return `${i + 1}. ${p.displayName?.text}
   Address: ${p.formattedAddress}
   Rating: ${p.rating || 'N/A'} (${p.userRatingCount || 0} reviews)
   Price level: ${p.priceLevel || 'unknown'}
   Summary: ${p.editorialSummary?.text || 'No summary'}
   Reviews: ${reviews}
   Open now: ${p.currentOpeningHours?.openNow ?? 'unknown'}
   Maps: ${p.googleMapsUri || ''}`;
  }).join('\n\n');
}

export async function POST(req: NextRequest) {
  try {
    const { city, preferences }: { city: string; preferences: Preferences } = await req.json();

    if (!city || !preferences) {
      return NextResponse.json({ error: 'Missing city or preferences' }, { status: 400 });
    }

    const places = await searchCoffeeShops(city);

    if (!places.length) {
      return NextResponse.json({ error: 'No coffee shops found in that location' }, { status: 404 });
    }

    const placesSummary = summarisePlaces(places);

    const userProfile = `
- Coffee style: ${preferences.coffeeStyle}
- Vibe they want: ${preferences.vibe}
- What they'll be doing: ${preferences.activity}
- Noise preference: ${preferences.noiseLevel}
- What matters most: ${preferences.priority}
- Must-have feature: ${preferences.mustHave}
    `.trim();

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a coffee shop recommendation expert. Based on a user's preferences and a list of real coffee shops with reviews, recommend the 3 best matches.

USER PREFERENCES:
${userProfile}

COFFEE SHOPS IN ${city}:
${placesSummary}

Return ONLY a valid JSON array with exactly 3 objects. No explanation, no markdown, no code fences, just the raw JSON array. Each object must have:
- name (string)
- address (string)
- rating (number or null)
- matchReason (string, 1-2 sentences explaining why this matches their preferences specifically)
- bestFor (string, short phrase like "Working alone" or "Quick espresso")
- mapsUrl (string)

Pick the genuinely best matches based on the reviews and their stated preferences. If reviews mention noisy music but user wants quiet, deprioritise it. Be specific in matchReason.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if Gemini adds them
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const recommendations = JSON.parse(cleaned);
    return NextResponse.json({ recommendations });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Something went wrong';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
