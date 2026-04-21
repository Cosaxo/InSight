import { C } from "../../theme";

interface ToastProps {
  message: string;
  color?: string;
  icon?: string;
}

export function Toast({ message, color = C.teal, icon = "✓" }: ToastProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 90,
        left: "50%",
        transform: "translateX(-50%)",
        background: color,
        color: "#fff",
        borderRadius: 20,
        padding: "10px 20px",
        fontSize: 13,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: `0 4px 20px ${color}50`,
        zIndex: 999,
        pointerEvents: "none",
        animation: "toastIn 0.25s ease, toastOut 0.3s ease 1.2s both",
        whiteSpace: "nowrap",
      }}
    >
      <span>{icon}</span>
      {message}
    </div>
  );
}
