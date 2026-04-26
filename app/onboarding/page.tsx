"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const COLORS = [
  "#2668FD", // Sky
  "#FD4401", // Coral
  "#FDCB40", // Sun
  "#00B351", // Clover
  "#F780D4", // Petal
  "#2CD1D0", // Lagoon
  "#6B3088", // Plum
];

const AVATARS = [
  "👨", "👩", "👧", "👦", "👶",
  "🧑", "👱", "🧔", "👸", "🤴",
];

type Step = "family" | "parent" | "pin" | "done";

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invite = searchParams.get("invite");

  const [step, setStep] = useState<Step>(invite ? "parent" : "family");
  const [familyName, setFamilyName] = useState("");
  const [parentName, setParentName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateFamily = async () => {
    if (!familyName.trim()) {
      setError("Please enter a family name");
      return;
    }
    setError("");
    setStep("parent");
  };

  const handleSetParent = async () => {
    if (!parentName.trim()) {
      setError("Please enter your name");
      return;
    }
    setError("");
    setStep("pin");
  };

  const handleSetPin = async () => {
    if (pin.length !== 4) {
      setError("PIN must be 4 digits");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PINs don't match");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyName,
          parentName,
          color: selectedColor,
          avatarEmoji: selectedAvatar,
          pin,
          invite,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create family");

      setStep("done");
      // Brief pause to show success, then redirect
      setTimeout(() => router.push("/calendar"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(invite ? ["parent", "pin"] : ["family", "parent", "pin"]).map(
            (s, i) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  step === s
                    ? "w-8 bg-rose-500"
                    : step === "done" || (invite ? i < ["parent", "pin"].indexOf(step) : i < ["family", "parent", "pin"].indexOf(step))
                    ? "w-8 bg-rose-500/50"
                    : "w-2 bg-slate-600"
                }`}
              />
            )
          )}
        </div>

        {/* Step: Family Name */}
        {step === "family" && (
          <div className="text-center">
            <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Name your family
            </h2>
            <p className="text-slate-400 mb-6">
              This shows at the top of your calendar
            </p>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="The Casey Family"
              className="w-full bg-slate-700/50 text-white placeholder-slate-400 border border-slate-600 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
              autoFocus
            />
            {error && <p className="text-rose-400 text-sm mb-4">{error}</p>}
            <button
              onClick={handleCreateFamily}
              className="w-full bg-rose-500 text-white font-semibold py-4 rounded-xl hover:bg-rose-600 active:bg-rose-700 transition-colors touch-manipulation text-lg"
            >
              Next
            </button>
          </div>
        )}

        {/* Step: Parent Profile */}
        {step === "parent" && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              {invite ? "Set up your profile" : "Add yourself"}
            </h2>
            <p className="text-slate-400 mb-6">
              Pick your name, color, and avatar
            </p>

            <input
              type="text"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-slate-700/50 text-white placeholder-slate-400 border border-slate-600 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
              autoFocus
            />

            {/* Color picker */}
            <div className="mb-4">
              <p className="text-slate-400 text-sm mb-2">Your color</p>
              <div className="flex justify-center gap-3">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-10 h-10 rounded-full transition-transform touch-manipulation ${
                      selectedColor === color
                        ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110"
                        : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Avatar picker */}
            <div className="mb-6">
              <p className="text-slate-400 text-sm mb-2">Your avatar</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setSelectedAvatar(emoji)}
                    className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all touch-manipulation ${
                      selectedAvatar === emoji
                        ? "bg-slate-600 ring-2 ring-rose-500 scale-110"
                        : "bg-slate-700/50 hover:bg-slate-600"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-rose-400 text-sm mb-4">{error}</p>}
            <button
              onClick={handleSetParent}
              className="w-full bg-rose-500 text-white font-semibold py-4 rounded-xl hover:bg-rose-600 active:bg-rose-700 transition-colors touch-manipulation text-lg"
            >
              Next
            </button>
          </div>
        )}

        {/* Step: PIN */}
        {step === "pin" && (
          <div className="text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Set a parental PIN
            </h2>
            <p className="text-slate-400 mb-6">
              4-digit code to protect settings from little fingers
            </p>

            <div className="space-y-3 mb-6">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 4-digit PIN"
                className="w-full bg-slate-700/50 text-white placeholder-slate-400 border border-slate-600 rounded-xl px-4 py-4 text-lg text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-rose-500"
                autoFocus
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinConfirm}
                onChange={(e) =>
                  setPinConfirm(e.target.value.replace(/\D/g, ""))
                }
                placeholder="Confirm PIN"
                className="w-full bg-slate-700/50 text-white placeholder-slate-400 border border-slate-600 rounded-xl px-4 py-4 text-lg text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {error && <p className="text-rose-400 text-sm mb-4">{error}</p>}
            <button
              onClick={handleSetPin}
              disabled={loading}
              className="w-full bg-rose-500 text-white font-semibold py-4 rounded-xl hover:bg-rose-600 active:bg-rose-700 transition-colors touch-manipulation text-lg disabled:opacity-50"
            >
              {loading ? "Setting up..." : "Create Family"}
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Welcome to ChuppaCal!
            </h2>
            <p className="text-slate-400">Redirecting to your calendar...</p>
          </div>
        )}
      </div>
    </div>
  );
}
