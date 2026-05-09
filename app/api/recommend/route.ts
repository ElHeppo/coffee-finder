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
}

async function searchCoffeeShops(
  location: { lat: number; lng: number },
  radius: number
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set');

  const placesRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.editorialSummary,places.reviews,places.currentOpeningHours,places.priceLevel',
    },
    body: JSON.stringify({
      includedTypes: ['cafe'],
      maxResultCount: 10,
      locationRestriction: {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius,
        },
      },
      rankPreference: 'POPULARITY',
    }),
  });

  const placesData = await placesRes.json();
  return placesData.places || [];
}

async function geocode(query: string): Promise<{ lat: number; lng: number; label: string }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`
  );
  const data = await res.json();
  if (!data.results?.length) throw new Error(`Could not find location: ${query}`);
  const { lat, lng } = data.results[0].geometry.location;
  const label = data.results[0].formatted_address;
  return { lat, lng, label };
}

function summarisePlaces(places: PlaceResult[]): string {
  return places.map((p, i) => {
    const reviews = p.reviews
      ?.slice(0, 2)
      .map(r => `"${r.text?.text?.substring(0, 120)}"`)
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
    const body = await req.json();
    const { preferences, radius = 1500 }: { preferences: Preferences; radius: number } = body;

    // Accept either GPS coords or a text query
    let location: { lat: number; lng: number };
    let locationLabel: string;

    if (body.lat && body.lng) {
      location = { lat: body.lat, lng: body.lng };
      locationLabel = body.locationLabel || 'your location';
    } else if (body.query) {
      const geocoded = await geocode(body.query);
      location = { lat: geocoded.lat, lng: geocoded.lng };
      locationLabel = geocoded.label;
    } else {
      return NextResponse.json({ error: 'Provide either GPS coordinates or a location query' }, { status: 400 });
    }

    if (!preferences) {
      return NextResponse.json({ error: 'Missing preferences' }, { status: 400 });
    }

    const places = await searchCoffeeShops(location, radius);

    if (!places.length) {
      return NextResponse.json({ error: 'No coffee shops found nearby. Try increasing the radius.' }, { status: 404 });
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

    const prompt = `You are a coffee shop recommendation expert. Based on a user's preferences and a list of real coffee shops with reviews, recommend the 5 best matches.

USER PREFERENCES:
${userProfile}

COFFEE SHOPS NEAR ${locationLabel}:
${placesSummary}

Return ONLY a valid JSON array with exactly 5 objects. No explanation, no markdown, no code fences, just the raw JSON array. Each object must have:
- name (string)
- address (string)
- rating (number or null)
- matchReason (string, 1-2 sentences explaining why this matches their preferences specifically)
- bestFor (string, short phrase like "Working alone" or "Quick espresso")
- mapsUrl (string)

Pick the genuinely best matches based on the reviews and their stated preferences. If reviews mention noisy music but user wants quiet, deprioritise it. Be specific in matchReason. If fewer than 5 good matches exist, still return 5 — rank the best ones first.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const recommendations = JSON.parse(cleaned);

    return NextResponse.json({ recommendations, locationLabel });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Something went wrong';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
