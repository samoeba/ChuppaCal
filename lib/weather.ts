export type Weather = {
  temp: number;
  condition: string;
  icon: string;
  location: string;
};

type CacheEntry = { data: Weather; expires: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;

export async function getWeather(location: string): Promise<Weather | null> {
  if (!location.trim()) return null;
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  const now = Date.now();
  const cached = cache.get(location);
  if (cached && cached.expires > now) return cached.data;

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
    location
  )}&units=imperial&appid=${apiKey}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const weather: Weather = {
      temp: Math.round(json.main?.temp ?? 0),
      condition: json.weather?.[0]?.main ?? "—",
      icon: json.weather?.[0]?.icon ?? "",
      location: json.name ?? location,
    };
    cache.set(location, { data: weather, expires: now + TTL_MS });
    return weather;
  } catch {
    return null;
  }
}
