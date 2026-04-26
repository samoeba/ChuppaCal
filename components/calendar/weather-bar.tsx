import { getWeather } from "@/lib/weather";

export default async function WeatherBar({ location }: { location: string }) {
  const weather = await getWeather(location);

  if (!weather) {
    return (
      <div className="text-caption">
        {location ? "Weather unavailable" : "Set a weather location in Settings"}
      </div>
    );
  }

  const iconUrl = weather.icon
    ? `https://openweathermap.org/img/wn/${weather.icon}@2x.png`
    : null;

  return (
    <div className="flex items-center gap-3">
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt={weather.condition} className="w-12 h-12 -my-2" />
      ) : null}
      <div className="flex items-baseline gap-2">
        <span className="text-heading-md">{weather.temp}°</span>
        <span className="text-caption">{weather.condition}</span>
      </div>
      <span className="text-caption">· {weather.location}</span>
    </div>
  );
}
