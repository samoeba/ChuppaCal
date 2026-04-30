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
}

const LAYOUT_DEFAULT = [
  "1 2 3 4 5 6 7 8 9 0",
  "q w e r t y u i o p",
  "a s d f g h j k l",
  "{shift} z x c v b n m {bksp}",
  "{done} ' {space} - {enter}",
];

const LAYOUT_SHIFTED = [
  "1 2 3 4 5 6 7 8 9 0",
  "Q W E R T Y U I O P",
  "A S D F G H J K L",
  "{shift} Z X C V B N M {bksp}",
  "{done} ' {space} - {enter}",
];

const DISPLAY: Record<string, string> = {
  "{shift}": "⇧",
  "{space}": " ",
  "{enter}": "⏎",
  "{done}": "✓",
  "{bksp}": "⌫",
};

const BUTTON_THEME = [
  { class: "tk-key-shift", buttons: "{shift}" },
  { class: "tk-key-bksp", buttons: "{bksp}" },
  { class: "tk-key-done", buttons: "{done}" },
  { class: "tk-key-enter", buttons: "{enter}" },
  { class: "tk-key-space", buttons: "{space}" },
  { class: "tk-key-punct", buttons: "' -" },
  { class: "tk-key-num", buttons: "1 2 3 4 5 6 7 8 9 0" },
];

export default function TouchKeyboard({ onKey }: Props) {
  const [shifted, setShifted] = useState(false);

  function handleKeyPress(button: string) {
    if (button === "{shift}") {
      setShifted((s) => !s);
      return;
    }
    if (button === "{space}") {
      onKey({ kind: "char", char: " " });
      if (shifted) setShifted(false);
      return;
    }
    if (button === "{bksp}") {
      onKey({ kind: "backspace" });
      return;
    }
    if (button === "{enter}") {
      onKey({ kind: "enter" });
      return;
    }
    if (button === "{done}") {
      onKey({ kind: "done" });
      return;
    }
    // Printable char
    onKey({ kind: "char", char: button });
    if (shifted) setShifted(false);
  }

  return (
    <Keyboard
      layoutName={shifted ? "shifted" : "default"}
      layout={{
        default: LAYOUT_DEFAULT,
        shifted: LAYOUT_SHIFTED,
      }}
      display={DISPLAY}
      buttonTheme={BUTTON_THEME}
      onKeyPress={handleKeyPress}
      preventMouseDownDefault={true}
      stopMouseDownPropagation={true}
    />
  );
}
