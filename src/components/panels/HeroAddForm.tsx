import { useState } from "react";
import { C } from "../../theme";
import type { Hero } from "../../types";

interface HeroAddFormProps {
  onAdd: (hero: Hero) => void;
}

export function HeroAddForm({ onAdd }: HeroAddFormProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 12,
          border: `1.5px dashed ${C.divider}`,
          background: "transparent",
          color: C.muted,
          fontFamily: "inherit",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        + Add a hero
      </button>
    );
  }

  function submit() {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      role: role.trim() || "Legend",
      reason: reason.trim() || "",
    });
    setName("");
    setRole("");
    setReason("");
    setOpen(false);
  }

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${C.divider}`,
    background: C.dim,
    color: C.text,
    fontFamily: "inherit",
    fontSize: 13,
    outline: "none",
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name..."
        style={inputStyle}
      />
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="What they were..."
        style={inputStyle}
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why they inspire you..."
        style={inputStyle}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={submit}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: 10,
            border: "none",
            background: C.purple,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Add
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: 10,
            border: `1px solid ${C.divider}`,
            background: "transparent",
            color: C.muted,
            fontFamily: "inherit",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
