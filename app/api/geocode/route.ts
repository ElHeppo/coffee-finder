import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { lat, lng } = await req.json();
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );
    const data = await res.json();
    const label =
      data.results?.[2]?.formatted_address ||
      data.results?.[0]?.formatted_address ||
      'your location';

    return NextResponse.json({ label });
  } catch {
    return NextResponse.json({ label: 'your location' });
  }
}
