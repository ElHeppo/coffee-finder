'use client';

import { useState } from 'react';

const QUESTIONS = [
  {
    id: 'coffeeStyle',
    question: 'What\'s your go-to coffee order?',
    options: [
      { emoji: '☕', text: 'Flat white or cappuccino — espresso-based, always', value: 'espresso-based drinks like flat white, cappuccino, cortado' },
      { emoji: '🫖', text: 'Pour-over or filter — I care about the bean', value: 'specialty filter coffee, pour-over, single origin' },
      { emoji: '🧊', text: 'Cold brew or iced latte', value: 'cold brew, iced coffee, iced latte' },
      { emoji: '🤷', text: 'Whatever\'s good — I trust the barista', value: 'open to anything, trusts the barista recommendation' },
    ],
  },
  {
    id: 'vibe',
    question: 'What vibe are you looking for?',
    options: [
      { emoji: '🛋️', text: 'Cozy and slow — armchairs, soft lighting, no rush', value: 'cozy, warm, comfortable, relaxed atmosphere with soft lighting' },
      { emoji: '✨', text: 'Minimal and cool — clean design, good music', value: 'minimalist, modern, stylish, Instagrammable' },
      { emoji: '🏘️', text: 'Local neighbourhood gem — lived-in, unpretentious', value: 'neighbourhood cafe, local, unpretentious, community feel' },
      { emoji: '⚡', text: 'Buzzy and social — lively, energy in the room', value: 'lively, social, energetic, busy atmosphere' },
    ],
  },
  {
    id: 'activity',
    question: 'What will you actually be doing there?',
    options: [
      { emoji: '💻', text: 'Working or studying — I need a table and power', value: 'working on laptop, needs good wifi, power outlets, tables' },
      { emoji: '👥', text: 'Meeting a friend — we\'ll be talking for hours', value: 'catching up with friends, conversation, social visit' },
      { emoji: '📖', text: 'Reading or just enjoying the moment alone', value: 'solo visit, reading, people watching, relaxing alone' },
      { emoji: '🏃', text: 'Grab and go — I just need my coffee', value: 'takeaway, quick stop, fast service' },
    ],
  },
  {
    id: 'noiseLevel',
    question: 'How do you feel about noise?',
    options: [
      { emoji: '🤫', text: 'Dead quiet — I want to hear myself think', value: 'very quiet, silent, peaceful' },
      { emoji: '🎵', text: 'Nice background music — enough to drown out silence', value: 'some background music, mild buzz' },
      { emoji: '🗣️', text: 'Lively chatter is fine — I like feeling around people', value: 'lively, busy, chatty atmosphere fine' },
      { emoji: '😌', text: 'Whatever — noise doesn\'t bother me', value: 'flexible on noise level' },
    ],
  },
  {
    id: 'priority',
    question: 'What matters most to you?',
    options: [
      { emoji: '🏆', text: 'Coffee quality above everything — I can taste the difference', value: 'exceptional coffee quality, specialty roasts, skilled baristas' },
      { emoji: '🌿', text: 'The atmosphere — I want to feel good being there', value: 'great atmosphere and interior design' },
      { emoji: '⚡', text: 'Speed and efficiency — my time matters', value: 'fast service, efficient, no long waits' },
      { emoji: '💰', text: 'Value for money — great coffee shouldn\'t cost a fortune', value: 'affordable, good value, reasonable prices' },
    ],
  },
  {
    id: 'mustHave',
    question: 'Any must-haves?',
    options: [
      { emoji: '📶', text: 'Strong WiFi — non-negotiable', value: 'good wifi, laptop-friendly' },
      { emoji: '🌤️', text: 'Outdoor seating — I want to sit outside', value: 'outdoor seating, terrace, garden' },
      { emoji: '🥐', text: 'Good food or pastries — coffee and a bite', value: 'food menu, pastries, cakes, breakfast options' },
      { emoji: '🌱', text: 'Plant-based milk options — oat, almond, soy', value: 'oat milk, plant-based milk alternatives' },
    ],
  },
];

const RADIUS_OPTIONS = [
  { label: '500m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
];

interface Recommendation {
  name: string;
  address: string;
  rating: number | null;
  matchReason: string;
  bestFor: string;
  mapsUrl: string;
}

type Step = 'intro' | 'quiz' | 'location' | 'loading' | 'results';

const bg = 'linear-gradient(160deg, #fef3c7 0%, #fde8d8 50%, #f9d9c5 100%)';

export default function CoffeeFinder() {
  const [step, setStep] = useState<Step>('intro');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [radius, setRadius] = useState(1000);
  const [gpsState, setGpsState] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLabel, setGpsLabel] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error, setError] = useState('');

  const handleAnswer = (value: string) => {
    const newAnswers = { ...answers, [QUESTIONS[currentQ].id]: value };
    setAnswers(newAnswers);
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setStep('location');
    }
  };

  const handleUseGPS = async () => {
    if (!navigator.geolocation) {
      setError('GPS not supported in this browser');
      return;
    }
    setGpsState('loading');
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsCoords({ lat, lng });
        setGpsState('granted');
        try {
          const res = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng }),
          });
          const data = await res.json();
          setGpsLabel(data.label || 'your location');
        } catch {
          setGpsLabel('your location');
        }
      },
      () => {
        setGpsState('denied');
        setError('Could not access your location. Try typing your city below.');
      }
    );
  };

  const handleManualSearch = () => {
    if (!query.trim()) return;
    setGpsState('idle');
    setGpsCoords(null);
    handleFind();
  };

  const handleFind = async () => {
    const usingGPS = gpsState === 'granted' && gpsCoords;
    const usingManual = query.trim();

    if (!usingGPS && !usingManual) return;

    setStep('loading');
    setError('');

    try {
      const body: Record<string, unknown> = { preferences: answers, radius };

      if (usingGPS) {
        body.lat = gpsCoords!.lat;
        body.lng = gpsCoords!.lng;
        body.locationLabel = gpsLabel;
      } else {
        body.query = query.trim();
      }

      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      setRecommendations(data.recommendations);
      setLocationLabel(data.locationLabel || query || gpsLabel);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('location');
    }
  };

  const handleRestart = () => {
    setStep('intro');
    setCurrentQ(0);
    setAnswers({});
    setQuery('');
    setRadius(1000);
    setGpsState('idle');
    setGpsCoords(null);
    setGpsLabel('');
    setLocationLabel('');
    setRecommendations([]);
    setError('');
  };

  // INTRO
  if (step === 'intro') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
        <div className="w-full max-w-xl">
          <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-10 shadow-xl text-center" style={{ border: '1px solid rgba(255,255,255,0.6)' }}>
            <div className="text-7xl mb-4">☕</div>
            <h1 className="text-3xl font-bold text-amber-900 mb-3 leading-tight">
              Find Your Perfect Coffee Shop
            </h1>
            <p className="text-amber-600 font-medium italic mb-6">
              &ldquo;New city, no idea where to go? We&apos;ve got you.&rdquo;
            </p>
            <p className="text-amber-800 text-sm leading-relaxed mb-8 px-4">
              Answer 6 quick questions about what you love, share your location, and we&apos;ll match you with the 5 best coffee shops nearby — personalised to you.
            </p>
            <button
              onClick={() => setStep('quiz')}
              className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              Find My Coffee Shop →
            </button>
            <p className="text-amber-400 text-xs mt-4">6 questions · powered by real reviews + AI</p>
          </div>
        </div>
      </div>
    );
  }

  // QUIZ
  if (step === 'quiz') {
    const q = QUESTIONS[currentQ];
    const progress = (currentQ / QUESTIONS.length) * 100;

    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
        <div className="w-full max-w-xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-full px-4 py-2">
              <span className="text-2xl">☕</span>
              <span className="font-bold text-amber-800 text-sm">Coffee Finder</span>
            </div>
          </div>
          <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-8 shadow-xl" style={{ border: '1px solid rgba(255,255,255,0.6)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                Question {currentQ + 1} of {QUESTIONS.length}
              </span>
              <span className="text-xs text-amber-400">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-amber-100 rounded-full h-2 mb-8">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)' }}
              />
            </div>
            <h2 className="text-xl font-bold text-amber-900 mb-6 leading-snug">{q.question}</h2>
            <div className="flex flex-col gap-3">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt.value)}
                  className="w-full text-left px-5 py-4 rounded-2xl font-medium text-amber-900 bg-amber-50 border border-amber-200 transition-all duration-150 hover:bg-amber-100 hover:border-amber-400 hover:scale-[1.02] active:scale-95"
                >
                  <span className="mr-3 text-lg">{opt.emoji}</span>
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LOCATION
  if (step === 'location') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
        <div className="w-full max-w-xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-full px-4 py-2">
              <span className="text-2xl">☕</span>
              <span className="font-bold text-amber-800 text-sm">Coffee Finder</span>
            </div>
          </div>
          <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-8 shadow-xl" style={{ border: '1px solid rgba(255,255,255,0.6)' }}>
            <div className="text-4xl mb-4 text-center">📍</div>
            <h2 className="text-2xl font-bold text-amber-900 mb-2 text-center">Where are you?</h2>
            <p className="text-amber-600 text-sm text-center mb-8">
              Choose one of the two options below.
            </p>

            {/* OPTION 1: GPS */}
            <div className="rounded-2xl border-2 border-amber-200 p-5 mb-4">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3">Option 1 — Use my location</p>
              {gpsState === 'granted' ? (
                <div className="flex items-center justify-between">
                  <p className="text-amber-800 text-sm font-medium">✓ {gpsLabel}</p>
                  <button onClick={() => { setGpsState('idle'); setGpsCoords(null); }} className="text-xs text-amber-400 underline">Clear</button>
                </div>
              ) : (
                <button
                  onClick={handleUseGPS}
                  disabled={gpsState === 'loading'}
                  className="w-full py-3 rounded-xl font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
                >
                  {gpsState === 'loading' ? '⏳ Getting your location...' : '📍 Detect my location'}
                </button>
              )}
            </div>

            {/* OPTION 2: Manual */}
            <div className="rounded-2xl border-2 border-amber-200 p-5 mb-6">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3">Option 2 — Type a city or neighbourhood</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && query.trim() && handleManualSearch()}
                  placeholder="e.g. Shoreditch London, Bangkok..."
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-amber-200 bg-white text-amber-900 placeholder-amber-300 text-sm font-medium focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleManualSearch}
                  disabled={!query.trim()}
                  className="px-4 py-3 rounded-xl font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  Go
                </button>
              </div>
            </div>

            {/* Radius picker — shared */}
            <div className="mb-6">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3">Search radius</p>
              <div className="grid grid-cols-4 gap-2">
                {RADIUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setRadius(opt.value)}
                    className="py-2 rounded-xl text-sm font-bold transition-all duration-150"
                    style={{
                      background: radius === opt.value ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#fef3c7',
                      color: radius === opt.value ? 'white' : '#92400e',
                      border: radius === opt.value ? 'none' : '1px solid #fde68a',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm mb-4 bg-red-50 rounded-xl p-3">{error}</p>
            )}

            {/* GPS search button — only shown when GPS is granted */}
            {gpsState === 'granted' && gpsCoords && (
              <button
                onClick={handleFind}
                className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                Find My Coffee Shops ☕
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // LOADING
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
        <div className="w-full max-w-xl text-center">
          <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-10 shadow-xl" style={{ border: '1px solid rgba(255,255,255,0.6)' }}>
            <div className="text-6xl mb-6 animate-bounce">☕</div>
            <h2 className="text-2xl font-bold text-amber-900 mb-3">Brewing your results...</h2>
            <p className="text-amber-600 text-sm">
              Searching nearby cafés, reading reviews, and finding your top 5 matches.
            </p>
            <div className="mt-8 flex justify-center gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RESULTS
  return (
    <div className="min-h-screen p-4 pb-12" style={{ background: bg }}>
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6 pt-4">
          <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-full px-4 py-2">
            <span className="text-2xl">☕</span>
            <span className="font-bold text-amber-800 text-sm">Coffee Finder</span>
          </div>
        </div>

        <div className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-xl mb-4 text-center" style={{ border: '1px solid rgba(255,255,255,0.6)' }}>
          <h2 className="text-2xl font-bold text-amber-900 mb-1">Your top 5 nearby</h2>
          <p className="text-amber-600 text-sm">📍 {locationLabel}</p>
        </div>

        <div className="flex flex-col gap-4">
          {recommendations.map((rec, i) => (
            <div
              key={i}
              className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-lg"
              style={{ border: '1px solid rgba(255,255,255,0.6)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <h3 className="font-bold text-amber-900 text-lg leading-tight">{rec.name}</h3>
                </div>
                {rec.rating && (
                  <span className="text-sm font-bold text-amber-600 bg-amber-50 rounded-full px-3 py-1 flex-shrink-0 ml-2">
                    ★ {rec.rating}
                  </span>
                )}
              </div>

              <p className="text-amber-500 text-xs mb-3">📍 {rec.address}</p>

              <div className="bg-amber-50 rounded-2xl p-4 mb-4">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Why it matches you</p>
                <p className="text-amber-800 text-sm leading-relaxed">{rec.matchReason}</p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-600 bg-amber-100 rounded-full px-3 py-1">
                  Best for: {rec.bestFor}
                </span>
                {rec.mapsUrl && (
                  <a
                    href={rec.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-white px-4 py-2 rounded-full transition-opacity hover:opacity-80"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  >
                    Open in Maps →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleRestart}
          className="w-full mt-6 py-4 rounded-2xl font-bold text-amber-700 bg-white/70 border border-amber-200 transition-all hover:bg-white hover:shadow-md"
        >
          Start over ↩
        </button>
      </div>
    </div>
  );
}
