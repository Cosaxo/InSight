import type { ReactNode } from "react";
import { FAB_COLORS, RAINBOW_GRADIENT } from "../../theme";
import type { TabId } from "../../types";
import {
  IcoAdd,
  IcoClose,
  IcoConnect,
  IcoFilter,
  IcoInfo,
  IcoInsights,
  IcoMap,
  IcoPlus,
  IcoSearch,
  IcoStar,
} from "../icons/UtilIcons";

interface FABAction {
  color: string;
  label: string;
  icon: ReactNode;
  isInsights?: boolean;
  onClick?: () => void;
}

const TAB_FABS: Record<TabId, FABAction[]> = {
  around: [
    { color: FAB_COLORS.insights, label: "My Insights", isInsights: true, icon: <IcoInsights col="#fff" /> },
    { color: FAB_COLORS.connect, label: "Connect", icon: <IcoConnect col="#fff" /> },
    { color: FAB_COLORS.filter, label: "Filter", icon: <IcoFilter col="#fff" /> },
    { color: FAB_COLORS.search, label: "Search", icon: <IcoSearch col="#fff" /> },
    { color: FAB_COLORS.map, label: "Map", icon: <IcoMap col="#fff" /> },
  ],
  world: [
    { color: FAB_COLORS.insights, label: "My Insights", isInsights: true, icon: <IcoInsights col="#fff" /> },
    { color: FAB_COLORS.filter, label: "Compare", icon: <IcoFilter col="#fff" /> },
    { color: FAB_COLORS.search, label: "Explore", icon: <IcoSearch col="#fff" /> },
    { color: FAB_COLORS.rate, label: "Save", icon: <IcoStar col="#fff" /> },
    { color: FAB_COLORS.info, label: "Info", icon: <IcoInfo col="#fff" /> },
  ],
  city: [
    { color: FAB_COLORS.insights, label: "My Insights", isInsights: true, icon: <IcoInsights col="#fff" /> },
    { color: FAB_COLORS.add, label: "Add city", icon: <IcoAdd col="#fff" /> },
    { color: FAB_COLORS.rate, label: "Rate", icon: <IcoStar col="#fff" /> },
    { color: FAB_COLORS.info, label: "Info", icon: <IcoInfo col="#fff" /> },
    { color: FAB_COLORS.filter, label: "Filter", icon: <IcoFilter col="#fff" /> },
  ],
  groups: [
    { color: FAB_COLORS.insights, label: "My Insights", isInsights: true, icon: <IcoInsights col="#fff" /> },
    { color: FAB_COLORS.create, label: "Create", icon: <IcoAdd col="#fff" /> },
    { color: FAB_COLORS.discover, label: "Discover", icon: <IcoSearch col="#fff" /> },
    { color: FAB_COLORS.filter, label: "Filter", icon: <IcoFilter col="#fff" /> },
    { color: FAB_COLORS.info, label: "Info", icon: <IcoInfo col="#fff" /> },
  ],
  people: [
    { color: FAB_COLORS.insights, label: "My Insights", isInsights: true, icon: <IcoInsights col="#fff" /> },
    { color: FAB_COLORS.add, label: "Add person", icon: <IcoAdd col="#fff" /> },
    { color: FAB_COLORS.connect, label: "Connect", icon: <IcoConnect col="#fff" /> },
    { color: FAB_COLORS.search, label: "Search", icon: <IcoSearch col="#fff" /> },
    { color: FAB_COLORS.filter, label: "Filter", icon: <IcoFilter col="#fff" /> },
  ],
};

interface FABStackProps {
  tab: TabId;
  open: boolean;
  onToggle: () => void;
  onInsights: () => void;
}

export function FABStack({ tab, open, onToggle, onInsights }: FABStackProps) {
  const actions = TAB_FABS[tab] || [];
  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        bottom: 16,
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "flex-start",
        gap: 10,
        zIndex: 30,
        pointerEvents: "none",
      }}
    >
      <button
        onClick={onToggle}
        aria-label={open ? "Close actions" : "Open actions"}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: RAINBOW_GRADIENT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
          pointerEvents: "auto",
          transition: "transform 0.22s cubic-bezier(.4,0,.2,1)",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
        }}
      >
        {open ? <IcoClose col="#fff" /> : <IcoPlus col="#fff" />}
      </button>

      {open &&
        actions.map((a, i) => (
          <button
            key={i}
            onClick={() => {
              if (a.isInsights) {
                onToggle();
                onInsights();
              } else if (a.onClick) {
                a.onClick();
              }
            }}
            title={a.label}
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              background: a.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 3px 14px ${a.color}60`,
              animation: `fabUp 0.16s ease ${i * 0.045}s both`,
              pointerEvents: "auto",
            }}
          >
            {a.icon}
          </button>
        ))}
    </div>
  );
}
