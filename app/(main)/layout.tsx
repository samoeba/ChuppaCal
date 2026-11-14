import Sidebar from "@/components/sidebar";
import RefreshData from "@/components/refresh-data";
import FamilyRealtime from "@/components/family-realtime";
import KioskDisplay from "@/components/kiosk-display";
import FamilyRuntimeProvider from "@/components/family-runtime";
import { SCREENSAVER_BUCKET, SCREENSAVER_PHOTO_LIMIT, screensaverPhotoUrl } from "@/lib/screensaver-photos";
import { loadFamily } from "@/lib/load-family";
import { familyTimeZone } from "@/lib/time-zone";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { family, supabase } = await loadFamily();
  const { data: album } = family.settings.screensaver_enabled
    ? await supabase.storage.from(SCREENSAVER_BUCKET).list(family.id, {
        limit: SCREENSAVER_PHOTO_LIMIT,
        sortBy: { column: "created_at", order: "desc" },
      })
    : { data: [] };
  const photos = (album ?? []).filter((photo) => photo.id).map((photo) => screensaverPhotoUrl(photo.name));
  return (
    <FamilyRuntimeProvider familyId={family.id} timeZone={familyTimeZone(family.settings.time_zone)}>
    <div className="flex min-h-screen">
      <Sidebar />
      <RefreshData />
      <FamilyRealtime />
      <KioskDisplay key={family.id} photos={photos} settings={{ sleep_start: family.settings.sleep_start, sleep_end: family.settings.sleep_end, sleep_enabled: family.settings.sleep_enabled, screensaver_enabled: family.settings.screensaver_enabled, screensaver_timeout_minutes: family.settings.screensaver_timeout_minutes }} />
      <main className="flex-1 min-w-0 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
        {children}
      </main>
    </div>
    </FamilyRuntimeProvider>
  );
}
