"use client";

import { useState } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";

export type KeyEvent =
  | { kind: "char"; char: string }
  | { kind: "backspace" }
  | { kind: "enter" }
  | { kind: "done" };

interface Props {
  onKey: (e: KeyEvent) => void;
  exiting?: boolean;
}

// 11 columns across rows 1-3; 3 pill keys on row 4. Letters render uppercase
// (Robuck Rounded looks best in caps) but emit lowercase chars to keep form
// values normal-cased. Family-color accents on punctuation match the pencil.
const LAYOUT_ALPHA = [
  "Q W E R T Y U I O P @",
  "A S D F G H J K L - '",
  "Z X C V B N M . ? + /",
  "{num} {space} {bksp}",
];

const LAYOUT_NUM = [
  "1 2 3 4 5 6 7 8 9 0",
  "! # $ % & * ( ) : ;",
  "+ = _ \" , . ? - / @",
  "{abc} {space} {bksp}",
];

const DISPLAY: Record<string, string> = {
  "{space}": "_",
  "{bksp}": "del",
  "{num}": "123",
  "{abc}": "ABC",
};

const BUTTON_THEME = [
  // Family-color punctuation accents (per pencil design)
  { class: "tk-key-sun", buttons: "@ ." },
  { class: "tk-key-petal", buttons: "-" },
  { class: "tk-key-lagoon", buttons: "'" },
  { class: "tk-key-clover", buttons: "?" },
  { class: "tk-key-coral", buttons: "+" },
  { class: "tk-key-sky", buttons: "/" },
  // Bottom-row pills
  { class: "tk-key-numpad", buttons: "{num} {abc}" },
  { class: "tk-key-space", buttons: "{space}" },
  { class: "tk-key-del", buttons: "{bksp}" },
];

export default function TouchKeyboard({ onKey, exiting = false }: Props) {
  const [layout, setLayout] = useState<"alpha" | "num">("alpha");

  function handleKeyPress(button: string) {
    if (button === "{num}") {
      setLayout("num");
      return;
    }
    if (button === "{abc}") {
      setLayout("alpha");
      return;
    }
    if (button === "{space}") {
      onKey({ kind: "char", char: " " });
      return;
    }
    if (button === "{bksp}") {
      onKey({ kind: "backspace" });
      return;
    }
    // Single character — letters lowercase, symbols/digits as-is
    if (button.length === 1) {
      const char = /[A-Z]/.test(button) ? button.toLowerCase() : button;
      onKey({ kind: "char", char });
    }
  }

  return (
    <Keyboard
      layoutName={layout}
      layout={{
        alpha: LAYOUT_ALPHA,
        num: LAYOUT_NUM,
      }}
      display={DISPLAY}
      buttonTheme={BUTTON_THEME}
      theme={`hg-theme-default hg-layout-default${exiting ? " kb-exiting" : ""}`}
      onKeyPress={handleKeyPress}
      preventMouseDownDefault={true}
      stopMouseDownPropagation={true}
    />
  );
}
