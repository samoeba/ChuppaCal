"use client";

import { useState, useCallback } from "react";

interface PinGateProps {
  familyPin: string;
  children: React.ReactNode;
  /** Text shown above the PIN input */
  message?: string;
  /** Callback when PIN is verified */
  onVerified?: () => void;
  onCancel?: () => void;
}

/**
 * Wraps content behind a 4-digit PIN verification overlay.
 * Once verified, children are rendered and the overlay is dismissed.
 */
export default function PinGate({
  familyPin,
  children,
  message = "Enter parental PIN to continue",
  onVerified,
  onCancel,
}: PinGateProps) {
  const [verified, setVerified] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 4) return;
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);

      if (newPin.length === 4) {
        if (newPin === familyPin) {
          setVerified(true);
          onVerified?.();
        } else {
          setError(true);
          setShake(true);
          setTimeout(() => {
            setPin("");
            setShake(false);
          }, 500);
        }
      }
    },
    [pin, familyPin, onVerified]
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  }, []);

  if (verified) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        <div className="text-4xl mb-4">🔒</div>
        <p className="text-slate-300 mb-6 text-lg">{message}</p>

        {/* PIN dots */}
        <div
          className={`flex justify-center gap-4 mb-8 ${
            shake ? "animate-shake" : ""
          }`}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full transition-colors ${
                i < pin.length
                  ? error
                    ? "bg-rose-500"
                    : "bg-white"
                  : "bg-slate-600"
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-rose-400 text-sm mb-4">Wrong PIN, try again</p>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
            (key) =>
              key === "" ? (
                <div key="empty" />
              ) : key === "⌫" ? (
                <button
                  key="backspace"
                  onClick={handleBackspace}
                  className="w-20 h-16 rounded-xl bg-slate-700/50 text-white text-2xl flex items-center justify-center active:bg-slate-600 transition-colors touch-manipulation"
                >
                  ⌫
                </button>
              ) : (
                <button
                  key={key}
                  onClick={() => handleDigit(key)}
                  className="w-20 h-16 rounded-xl bg-slate-700/50 text-white text-2xl font-semibold flex items-center justify-center active:bg-slate-600 transition-colors touch-manipulation"
                >
                  {key}
                </button>
              )
          )}
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-6 text-slate-400 text-sm underline touch-manipulation"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
