import { useState } from "react";
import { C } from "../../theme";

interface AddChipInputProps {
  placeholder: string;
  onAdd: (value: string) => void;
  color: string;
}

export function AddChipInput({ placeholder, onAdd, color }: AddChipInputProps) {
  const [val, setVal] = useState("");

  function submit() {
    const t = val.trim();
    if (!t) return;
    onAdd(t);
    setVal("");
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: "8px 12px",
          borderRadius: 10,
          border: `1px solid ${C.divider}`,
          background: C.card,
          color: C.text,
          fontFamily: "inherit",
          fontSize: 13,
          outline: "none",
        }}
      />
      <button
        onClick={submit}
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          border: "none",
          background: `${color}15`,
          color,
          fontFamily: "inherit",
          fontSize: 12,
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Add
      </button>
    </div>
  );
}
