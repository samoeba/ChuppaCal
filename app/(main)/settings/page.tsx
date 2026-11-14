"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFamilyRuntime } from "@/components/family-runtime";
import PinGate from "@/components/pin-gate";
import type { CalendarConnectionSummary, ChoreTemplate, ChoreTemplateMember, Family, FamilyMember, List, StarReward } from "@/lib/types";
import ChoreTemplatesSection from "@/components/settings/chore-templates-section";
import ExtraWorkSection from "@/components/settings/extra-work-section";
import StarRewardsSection from "@/components/settings/star-rewards-section";
import MealSlotsSection from "@/components/settings/meal-slots-section";
import ListsSection from "@/components/settings/lists-section";
import KioskModeSection from "@/components/settings/kiosk-mode-section";
import { updateDisplaySettings } from "@/app/actions/settings";
import DisplaySettingsSection from "@/components/settings/display-settings-section";
import ScreensaverAlbum from "@/components/settings/screensaver-album";
import { clearOfflineSnapshot } from "@/components/offline-snapshot";
import CalendarConnectionControls from "@/components/settings/calendar-connection-controls";
import MemberAvatar from "@/components/family/member-avatar";
import PhotoCropModal from "@/components/family/photo-crop-modal";
import { toggleChoresEnabled } from "@/app/actions/chores";
import { useDialog } from "@/lib/use-dialog";

const COLORS = [
  "#4ecdc4", "#ff6b6b", "#a78bfa", "#ffd93d",
  "#f97316", "#22c55e", "#3b82f6", "#ec4899",
];

const AVATARS = [
  "👨", "👩", "👧", "👦", "👶",
  "🧑", "👱", "🧔", "👸", "🤴",
];

export default function SettingsPage() {
  const router = useRouter();
  const { familyId } = useFamilyRuntime();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [connections, setConnections] = useState<CalendarConnectionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  // Add/Edit member form state
  const [memberName, setMemberName] = useState("");
  const [memberColor, setMemberColor] = useState(COLORS[0]);
  const [memberAvatar, setMemberAvatar] = useState(AVATARS[0]);
  const [memberRole, setMemberRole] = useState<"parent" | "child">("child");
  const [memberPhotoUrl, setMemberPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const memberDialog = useDialog(showAddMember, savingMember || uploadingPhoto ? undefined : () => setShowAddMember(false));

  // Display settings
  const [weatherLocation, setWeatherLocation] = useState("");
  const [savingWeather, setSavingWeather] = useState(false);
  const [templates, setTemplates] = useState<(ChoreTemplate & { memberIds: string[] })[]>([]);
  const [jobs, setJobs] = useState<ChoreTemplate[]>([]);
  const [rewards, setRewards] = useState<StarReward[]>([]);
  const [lists, setLists] = useState<List[]>([]);

  const [supabase] = useState(createClient);

  const loadData = useCallback(async () => {
    try {
      // The layout verifies membership. Supabase still enforces RLS on every read.
      const responses = await Promise.all([
        supabase.from("families").select("*").eq("id", familyId).single(),
        supabase.from("family_members").select("*").eq("family_id", familyId).order("created_at"),
        // Credentials must never be downloaded by the settings UI.
        supabase.from("calendar_connections").select("id,family_id,member_id,provider,calendar_external_id,calendar_name,last_synced_at,last_sync_attempt_at,last_sync_error,created_at").eq("family_id", familyId).order("created_at"),
        supabase.from("chore_templates").select("*,chore_template_members(member_id)").eq("family_id", familyId).eq("active", true).order("created_at")
          .overrideTypes<(ChoreTemplate & { chore_template_members: Pick<ChoreTemplateMember, "member_id">[] })[], { merge: false }>(),
        supabase.from("star_rewards").select("*").eq("family_id", familyId).order("star_cost"),
        supabase.from("lists").select("*").eq("family_id", familyId).order("sort_order").order("created_at"),
      ]);
      if (responses.some((response) => response.error)) throw new Error("Could not load all settings. Please retry.");
      const [{ data: familyData }, { data: membersData }, { data: connectionsData }, { data: templatesData }, { data: rewardsData }, { data: listsData }] = responses;

      if (connectionsData) setConnections(connectionsData);

      if (familyData) {
        setFamily(familyData);
        setWeatherLocation(familyData.settings?.weather_location ?? "");
      }
      if (membersData) setMembers(membersData);

      const loaded = (templatesData ?? []).map(({ chore_template_members, ...template }) => ({
        ...template,
        memberIds: chore_template_members.map(({ member_id }) => member_id),
      }));
      setTemplates(loaded.filter((t) => t.category === "expectation"));
      setJobs(loaded.filter((t) => t.category === "extra_work"));
      if (rewardsData) setRewards(rewardsData as StarReward[]);

      if (listsData) setLists(listsData as List[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load settings");
    } finally {
      setLoading(false);
    }
  }, [familyId, supabase]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    const refresh = () => { void loadData(); };
    window.addEventListener("chuppacal-refresh-settings", refresh);
    return () => window.removeEventListener("chuppacal-refresh-settings", refresh);
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("gcal_error")) setError("Google Calendar could not be connected. Please try connecting again and allow calendar access.");
    if (params.has("gcal_connected")) setStatus("Google Calendar connected. Events will appear after the next sync.");
  }, []);

  async function runMutation(work: () => Promise<void>) {
    setError(null);
    setStatus(null);
    try { await work(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save changes. Please retry.");
    }
  }

  async function updateConnection(id: string, fields: Partial<CalendarConnectionSummary>) {
    await runMutation(async () => {
    const response = await fetch(`/api/calendar/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!response.ok) throw new Error("Could not update the calendar connection. Please retry.");
    await loadData();
    });
  }

  async function disconnectConnection(conn: CalendarConnectionSummary) {
    if (!confirm(`Disconnect ${conn.calendar_name || conn.provider}?`)) return;
    await runMutation(async () => {
      const response = await fetch(`/api/calendar/connections/${conn.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not disconnect the calendar. Please retry.");
      await loadData();
    });
  }

  async function saveWeatherLocation() {
    if (!family) return;
    setSavingWeather(true);
    await runMutation(async () => {
      const nextSettings = await updateDisplaySettings({ weather_location: weatherLocation.trim() });
      setFamily({ ...family, settings: nextSettings });
      setStatus("Weather location saved.");
    });
    setSavingWeather(false);
  }

  function openAddMember() {
    setEditingMember(null);
    setMemberName("");
    setMemberColor(COLORS[members.length % COLORS.length]);
    setMemberAvatar(AVATARS[0]);
    setMemberRole("child");
    setMemberPhotoUrl(null);
    setShowAddMember(true);
  }

  function openEditMember(member: FamilyMember) {
    setEditingMember(member);
    setMemberName(member.name);
    setMemberColor(member.color);
    setMemberAvatar(member.avatar_emoji);
    setMemberRole(member.role as "parent" | "child");
    setMemberPhotoUrl(member.avatar_url);
    setShowAddMember(true);
  }

  async function uploadBlob(blob: Blob) {
    if (!family) return;
    setUploadingPhoto(true);
    try {
      const path = `${family.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("family-photos")
        .upload(path, blob, { cacheControl: "3600", upsert: false, contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("family-photos").getPublicUrl(path);
      setMemberPhotoUrl(data.publicUrl);
    } catch (e) {
      alert("Upload failed: " + (e as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function saveMember() {
    if (!family || !memberName.trim() || savingMember) return;
    setSavingMember(true);
    await runMutation(async () => {

    if (editingMember) {
      const { error } = await supabase
        .from("family_members")
        .update({
          name: memberName.trim(),
          color: memberColor,
          avatar_emoji: memberAvatar,
          avatar_url: memberPhotoUrl,
          role: memberRole,
        })
        .eq("id", editingMember.id);
      if (error) throw new Error("Could not save this family member. Please retry.");
    } else {
      const { error } = await supabase.from("family_members").insert({
        family_id: family.id,
        name: memberName.trim(),
        color: memberColor,
        avatar_emoji: memberAvatar,
        avatar_url: memberPhotoUrl,
        role: memberRole,
      });
      if (error) throw new Error("Could not add this family member. Please retry.");
    }

    setShowAddMember(false);
    await loadData();
    });
    setSavingMember(false);
  }

  async function deleteMember(member: FamilyMember) {
    if (!confirm(`Remove ${member.name} from the family?`)) return;
    await runMutation(async () => {
      const { error } = await supabase.from("family_members").delete().eq("id", member.id);
      if (error) throw new Error("Could not remove this family member. Please retry.");
      await loadData();
    });
  }

  function getInviteLink() {
    if (!family) return "";
    return `${window.location.origin}/auth/callback?invite=${family.id}`;
  }

  async function copyInviteLink() {
    const link = getInviteLink();
    await runMutation(async () => {
      await navigator.clipboard.writeText(link);
      setStatus("Invite link copied to clipboard.");
    });
  }

  async function signOut() {
    if (!confirm("Sign out? You'll need to sign back in with your Google account.")) return;
    await runMutation(async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error("Could not sign out. Please retry.");
      clearOfflineSnapshot();
      router.replace("/login");
      router.refresh();
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="flex items-center justify-center h-64">
        <p role="alert" className="text-slate-600">{error ?? "No family found"}</p>
        <button onClick={() => { setError(null); void loadData(); }} className="ml-4 px-4 py-3 rounded-xl bg-cc-ink text-white">Retry</button>
      </div>
    );
  }

  const pinHash = family.settings.pin_hash ?? "";

  return (
    <PinGate familyPin={pinHash}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">⚙️ Settings</h1>
        {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
        {status && <p role="status" className="text-green-800 mb-4">{status}</p>}

        {/* Family Members */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Family Members
            </h2>
            <button
              onClick={openAddMember}
              className="bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold active:bg-rose-600 transition-colors touch-manipulation"
            >
              + Add Member
            </button>
          </div>

          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50"
              >
                <MemberAvatar member={member} size={48} emojiClassName="text-2xl" />
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">
                    {member.name}
                  </div>
                  <div className="text-sm text-slate-400 capitalize">
                    {member.role}
                    {member.user_id ? " (linked)" : ""}
                  </div>
                </div>
                {member.role === "child" && (
                  <button
                    onClick={async () => {
                      await runMutation(async () => {
                        await toggleChoresEnabled(member.id, !member.chores_enabled);
                        await loadData();
                      });
                    }}
                    className={`text-xs px-2 py-1 rounded-lg font-semibold touch-manipulation ${
                      member.chores_enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {member.chores_enabled ? "✅ Chores on" : "Chores off"}
                  </button>
                )}
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0"
                  style={{ backgroundColor: member.color }}
                />
                <button
                  onClick={() => openEditMember(member)}
                  aria-label={`Edit ${member.name}`}
                  className="text-slate-400 hover:text-slate-600 p-2 touch-manipulation"
                >
                  ✏️
                </button>
                {!member.user_id && (
                  <button
                    onClick={() => deleteMember(member)}
                    aria-label={`Remove ${member.name}`}
                    className="text-slate-400 hover:text-rose-500 p-2 touch-manipulation"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Calendar Connections */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-slate-900">Calendar Connections</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Link Google Calendar accounts. Events sync approximately every 5 minutes and
            appear color-coded by the assigned family member.
          </p>

          {connections.length === 0 ? (
            <p className="text-sm text-slate-400 mb-3">No connections yet.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {connections.map((conn) => {
                return (
                  <div
                    key={conn.id}
                    className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-slate-100"
                  >
                    <div className="text-xl">{conn.provider === "google" ? "📆" : "📅"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {conn.calendar_name || conn.provider}
                      </div>
                      <div className="text-xs text-slate-400">
                        {conn.provider === "google" ? "Google" : "CalDAV"}
                        {conn.last_synced_at
                          ? ` · last synced ${new Date(conn.last_synced_at).toLocaleString()}`
                          : " · not yet synced"}
                      </div>
                    </div>
                    <select
                      value={conn.member_id ?? ""}
                      aria-label={`Family member for ${conn.calendar_name || conn.provider}`}
                      onChange={(e) =>
                        updateConnection(conn.id, { member_id: e.target.value })
                      }
                      className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => disconnectConnection(conn)}
                      aria-label={`Disconnect ${conn.calendar_name || conn.provider}`}
                      className="text-slate-400 hover:text-rose-500 p-2 touch-manipulation"
                    >
                      🗑️
                    </button>
                    <CalendarConnectionControls connection={conn} onChanged={loadData} />
                  </div>
                );
              })}
            </div>
          )}

          <a
            href={`/api/calendar/google/connect${
              members[0] ? `?member_id=${members[0].id}` : ""
            }`}
            className="block text-center bg-slate-100 text-slate-700 px-4 py-3 rounded-xl text-sm font-semibold active:bg-slate-200 transition-colors touch-manipulation"
          >
            + Connect Google Calendar
          </a>
        </section>

        <ChoreTemplatesSection
          templates={templates}
          kids={members.filter((m) => m.role === "child")}
          familyId={family.id}
          onChanged={loadData}
        />

        <ExtraWorkSection jobs={jobs} familyId={family.id} onChanged={loadData} />

        <StarRewardsSection rewards={rewards} familyId={family.id} onChanged={loadData} />

        <MealSlotsSection
          familyId={family.id}
          initialSlots={
            family.settings?.meal_slots ?? {
              breakfast: true,
              lunch: true,
              dinner: true,
              snack: false,
            }
          }
        />

        <ListsSection initialLists={lists} />

        <KioskModeSection />
        <DisplaySettingsSection settings={family.settings} />
        <ScreensaverAlbum key={family.id} familyId={family.id} />

        {/* Display / Weather */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Weather</h2>
          <p className="text-sm text-slate-400 mb-4">
            City or ZIP used for the calendar weather bar.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="Weather city or ZIP"
              data-unsaved={weatherLocation !== (family.settings.weather_location ?? "")}
              value={weatherLocation}
              onChange={(e) => setWeatherLocation(e.target.value)}
              placeholder="e.g. Austin, TX or 78701"
              className="flex-1 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              onClick={saveWeatherLocation}
              disabled={savingWeather}
              className="bg-rose-500 text-white px-4 py-3 rounded-xl text-sm font-semibold active:bg-rose-600 transition-colors touch-manipulation disabled:opacity-50"
            >
              {savingWeather ? "Saving…" : "Save"}
            </button>
          </div>
        </section>

        {/* Invite Partner */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Invite Partner
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Share this link with your partner so they can join the family and
            manage ChuppaCal from their phone.
          </p>
          <button
            onClick={copyInviteLink}
            className="w-full bg-slate-100 text-slate-700 px-4 py-3 rounded-xl text-sm font-semibold active:bg-slate-200 transition-colors touch-manipulation"
          >
            📋 Copy Invite Link
          </button>
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Account</h2>
          <p className="text-sm text-slate-400 mb-4">
            Signs out of ChuppaCal on this device only. Other devices stay signed in.
          </p>
          <button
            onClick={signOut}
            className="w-full bg-slate-100 text-slate-700 px-4 py-3 rounded-xl text-sm font-semibold active:bg-slate-200 transition-colors touch-manipulation"
          >
            Sign out
          </button>
        </section>

        {/* Add/Edit Member Modal */}
        {showAddMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div ref={memberDialog} role="dialog" aria-modal="true" aria-label={editingMember ? "Edit member" : "Add family member"} aria-busy={savingMember || uploadingPhoto} tabIndex={-1} className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90dvh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {editingMember ? "Edit Member" : "Add Family Member"}
              </h3>

              <input
                type="text"
                aria-label="Member name"
                maxLength={100}
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Name"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg mb-4 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />

              {/* Role */}
              <div className="flex gap-2 mb-4">
                {(["parent", "child"] as const).map((role) => (
                  <button
                    key={role}
                    aria-pressed={memberRole === role}
                    onClick={() => setMemberRole(role)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-colors touch-manipulation ${
                      memberRole === role
                        ? "bg-rose-500 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {/* Color picker */}
              <p className="text-sm text-slate-400 mb-2">Color</p>
              <div className="flex gap-2 mb-4 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    aria-label={`Use color ${color}`}
                    aria-pressed={memberColor === color}
                    onClick={() => setMemberColor(color)}
                    className={`w-11 h-11 rounded-full touch-manipulation ${
                      memberColor === color
                        ? "ring-2 ring-slate-900 ring-offset-2 scale-110"
                        : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              {/* Photo */}
              <p className="text-sm text-slate-400 mb-2">Photo</p>
              <div className="flex items-center gap-3 mb-4">
                <MemberAvatar
                  member={{
                    avatar_url: memberPhotoUrl,
                    avatar_emoji: memberAvatar,
                    color: memberColor,
                    name: memberName || "preview",
                  }}
                  size={56}
                  emojiClassName="text-2xl"
                />
                <div className="flex flex-col gap-2 flex-1">
                  <label
                    data-no-keyboard
                    className={`text-sm font-semibold px-4 py-2 rounded-xl text-center cursor-pointer touch-manipulation ${
                      uploadingPhoto ? "bg-slate-200 text-slate-400" : "bg-slate-100 text-slate-700 active:bg-slate-200"
                    }`}
                  >
                    {uploadingPhoto ? "Uploading…" : memberPhotoUrl ? "Change photo" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full mt-2 text-xs"
                      aria-label="Family member photo"
                      disabled={uploadingPhoto}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
                          setError("Choose an image smaller than 10 MB.");
                        } else if (file) setCropFile(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {memberPhotoUrl && (
                    <button
                      onClick={() => setMemberPhotoUrl(null)}
                      className="text-xs text-slate-400 hover:text-rose-500 touch-manipulation"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>

              {/* Emoji fallback picker */}
              <p className="text-sm text-slate-400 mb-2">
                Emoji {memberPhotoUrl && <span className="text-slate-300">(used if photo is removed)</span>}
              </p>
              <div className="flex gap-2 mb-6 flex-wrap">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    aria-label={`Use ${emoji} avatar`}
                    aria-pressed={memberAvatar === emoji}
                    onClick={() => setMemberAvatar(emoji)}
                    className={`w-11 h-11 rounded-lg text-xl flex items-center justify-center touch-manipulation ${
                      memberAvatar === emoji
                        ? "bg-slate-200 ring-2 ring-rose-500"
                        : "bg-slate-50"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {error && <p role="alert" className="mb-3 text-red-700">{error}</p>}
              <div className="flex gap-2">
                <button
                  disabled={savingMember || uploadingPhoto}
                  onClick={() => setShowAddMember(false)}
                  className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  onClick={saveMember}
                  disabled={savingMember || uploadingPhoto || !memberName.trim()}
                  className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-semibold touch-manipulation"
                >
                  {editingMember ? "Save" : "Add"}
                </button>
              </div>
            </div>
          </div>
        )}

        {cropFile && (
          <PhotoCropModal
            file={cropFile}
            onCancel={() => setCropFile(null)}
            onSave={async (blob) => {
              setCropFile(null);
              await uploadBlob(blob);
            }}
          />
        )}
      </div>
    </PinGate>
  );
}
