import { useState } from "react";
import { Kicker } from "../shared/primitives";

interface ScrapCat {
  id: string;
  label: string;
  glyph: string;
  hue: number;
  count: number;
  total: number;
}

interface Specimen {
  name: string;
  latin: string;
  date: string;
  loc: string;
  conf: number;
  note?: string;
}

const SCRAP_CATS: ScrapCat[] = [
  { id: "plants", label: "plants", glyph: "❀", hue: 145, count: 23, total: 180 },
  { id: "insects", label: "insects", glyph: "✺", hue: 38, count: 11, total: 240 },
  { id: "birds", label: "birds", glyph: "⌇", hue: 220, count: 17, total: 95 },
  { id: "animals", label: "animals", glyph: "◑", hue: 12, count: 6, total: 60 },
  { id: "landmarks", label: "landmarks", glyph: "⌂", hue: 200, count: 14, total: 120 },
  { id: "spices", label: "spices", glyph: "✦", hue: 28, count: 9, total: 45 },
  { id: "fungi", label: "fungi", glyph: "☂", hue: 280, count: 4, total: 70 },
];

const SAMPLE_SPECIMENS: Record<string, Specimen[]> = {
  plants: [
    { name: "Wood anemone", latin: "Anemone nemorosa", date: "apr 12 · 2026", loc: "Nordmarka", conf: 96, note: "first of the spring carpet" },
    { name: "Bilberry", latin: "Vaccinium myrtillus", date: "may 03 · 2026", loc: "Sognsvann", conf: 94, note: "still in flower" },
    { name: "Reindeer lichen", latin: "Cladonia rangiferina", date: "mar 28 · 2026", loc: "Hardangervidda", conf: 89, note: "on the south rocks" },
    { name: "Yarrow", latin: "Achillea millefolium", date: "jul 18 · 2025", loc: "Bygdøy", conf: 92 },
    { name: "Cloudberry", latin: "Rubus chamaemorus", date: "aug 02 · 2025", loc: "Finnmark", conf: 99, note: "rare find — only nine berries" },
    { name: "Marsh marigold", latin: "Caltha palustris", date: "apr 24 · 2026", loc: "Akerselva", conf: 91 },
  ],
  insects: [
    { name: "Small tortoiseshell", latin: "Aglais urticae", date: "apr 30 · 2026", loc: "St. Hanshaugen", conf: 97, note: "first butterfly of the year" },
    { name: "Common blue", latin: "Polyommatus icarus", date: "jun 12 · 2025", loc: "Bygdøy", conf: 95 },
    { name: "Bumblebee, white-tailed", latin: "Bombus lucorum", date: "may 06 · 2026", loc: "home garden", conf: 88 },
    { name: "Stag beetle", latin: "Lucanus cervus", date: "jul 22 · 2025", loc: "Bærum forest", conf: 99, note: "huge — male" },
  ],
  birds: [
    { name: "European robin", latin: "Erithacus rubecula", date: "apr 18 · 2026", loc: "Frogner park", conf: 99, note: "sang for ten minutes" },
    { name: "Common loon", latin: "Gavia immer", date: "mar 14 · 2026", loc: "Oslofjord", conf: 94 },
    { name: "White-throated dipper", latin: "Cinclus cinclus", date: "feb 09 · 2026", loc: "Akerselva", conf: 96 },
    { name: "Eurasian jay", latin: "Garrulus glandarius", date: "oct 30 · 2025", loc: "Nordmarka", conf: 92 },
    { name: "Black grouse", latin: "Lyrurus tetrix", date: "apr 08 · 2026", loc: "Hardangervidda", conf: 87, note: "lekking at dawn" },
  ],
  animals: [
    { name: "Red squirrel", latin: "Sciurus vulgaris", date: "mar 22 · 2026", loc: "Bygdøy", conf: 98 },
    { name: "Roe deer", latin: "Capreolus capreolus", date: "apr 02 · 2026", loc: "Nordmarka", conf: 95, note: "a doe and her fawn" },
    { name: "Moose", latin: "Alces alces", date: "oct 18 · 2025", loc: "Hardangervidda", conf: 99 },
  ],
  spices: [
    { name: "Saffron", latin: "Crocus sativus", date: "feb 11 · 2026", loc: "home kitchen", conf: 99, note: "gift from grandmother" },
    { name: "Ceylon cinnamon", latin: "Cinnamomum verum", date: "jan 03 · 2026", loc: "Mathallen", conf: 96 },
    { name: "Black cardamom", latin: "Amomum subulatum", date: "mar 20 · 2026", loc: "Grønland market", conf: 94 },
    { name: "Sumac", latin: "Rhus coriaria", date: "apr 14 · 2026", loc: "home pantry", conf: 91 },
    { name: "Sichuan pepper", latin: "Zanthoxylum simulans", date: "dec 18 · 2025", loc: "Mathallen", conf: 97, note: "numbing — the real thing" },
    { name: "Smoked paprika", latin: "Capsicum annuum", date: "nov 02 · 2025", loc: "home pantry", conf: 95 },
  ],
  fungi: [
    { name: "Chanterelle", latin: "Cantharellus cibarius", date: "sep 04 · 2025", loc: "Nordmarka", conf: 98, note: "two kilos — froze most" },
    { name: "Birch bolete", latin: "Leccinum scabrum", date: "aug 22 · 2025", loc: "Sognsvann", conf: 93 },
  ],
  landmarks: [
    { name: "Oslo Opera House", latin: "Snøhetta · 2008", date: "apr 22 · 2026", loc: "Bjørvika", conf: 99, note: "walked the roof at dawn" },
    { name: "Vigeland Monolith", latin: "Gustav Vigeland · 1944", date: "mar 30 · 2026", loc: "Frogner park", conf: 98 },
    { name: "Akershus Fortress", latin: "c. 1299", date: "feb 17 · 2026", loc: "Pipervika", conf: 97 },
    { name: "Holmenkollen ski jump", latin: "JDS Architects · 2010", date: "jan 11 · 2026", loc: "Holmenkollen", conf: 99, note: "snow still on the lip" },
    { name: "Stave church, Borgund", latin: "c. 1180", date: "jul 08 · 2025", loc: "Lærdal", conf: 94, note: "darker inside than expected" },
    { name: "Nidaros Cathedral", latin: "begun 1070", date: "aug 14 · 2025", loc: "Trondheim", conf: 96 },
    { name: "Pulpit Rock", latin: "Preikestolen · natural", date: "jun 22 · 2025", loc: "Lysefjord", conf: 99 },
    { name: "Bryggen wharf", latin: "Hanseatic, 14th c.", date: "sep 03 · 2025", loc: "Bergen", conf: 95, note: "creaking timber, smell of tar" },
  ],
};

function CatTile({ c, onOpen }: { c: ScrapCat; onOpen: (id: string) => void }) {
  const pct = (c.count / c.total) * 100;
  return (
    <div
      onClick={() => onOpen(c.id)}
      className="card"
      style={{ cursor: "pointer", padding: 14 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: `oklch(0.94 0.04 ${c.hue})`,
            border: `0.5px solid oklch(0.78 0.08 ${c.hue})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: `oklch(0.40 0.13 ${c.hue})`,
          }}
        >
          {c.glyph}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 17,
              fontStyle: "italic",
            }}
          >
            {c.label}
          </div>
          <div className="kicker" style={{ marginTop: 2 }}>
            {c.count} of {c.total} known
          </div>
          <div
            style={{
              height: 4,
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 999,
              marginTop: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: `oklch(0.55 0.13 ${c.hue})`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecimenCard({ s, hue }: { s: Specimen; hue: number }) {
  return (
    <div className="card" style={{ padding: 12, position: "relative" }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div
          style={{
            width: 64,
            height: 64,
            flexShrink: 0,
            background: `linear-gradient(135deg, oklch(0.88 0.08 ${hue}) 0%, oklch(0.72 0.10 ${hue}) 100%)`,
            border: "0.5px solid var(--rule)",
            position: "relative",
            boxShadow: "1px 2px 3px rgba(0,0,0,0.08)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: -3,
              left: "50%",
              transform: "translateX(-50%)",
              width: 6,
              height: 6,
              background: "var(--ink)",
              borderRadius: "50%",
              boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {s.name}
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 12,
              color: "var(--ink-2)",
              marginTop: 1,
            }}
          >
            {s.latin}
          </div>
          <div className="kicker" style={{ marginTop: 6 }}>
            {s.date} · {s.loc}
          </div>
          {s.note && (
            <div className="margin-note" style={{ fontSize: 12, marginTop: 4 }}>
              "{s.note}"
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="kicker">AI</div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 13,
              color: `oklch(0.45 0.13 ${hue})`,
            }}
          >
            {s.conf}%
          </div>
        </div>
      </div>
    </div>
  );
}

function CaptureFlow({
  cat,
  onClose,
  onSave,
}: {
  cat: ScrapCat;
  onClose: () => void;
  onSave: () => void;
}) {
  const [step, setStep] = useState<"frame" | "classifying" | "result">(
    "frame",
  );
  const [result, setResult] = useState<Specimen | null>(null);

  const guess = (): Specimen => {
    const opts = SAMPLE_SPECIMENS[cat.id] || [];
    const pick = opts[Math.floor(Math.random() * opts.length)] || {
      name: "Unknown",
      latin: "—",
      conf: 0,
      date: "",
      loc: "",
    };
    return { ...pick, date: "today", loc: "here" };
  };

  const start = () => {
    setStep("classifying");
    setTimeout(() => {
      setResult(guess());
      setStep("result");
    }, 1400);
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(20,18,14,0.92)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="app-header"
        style={{
          background: "transparent",
          borderBottom: "0.5px solid rgba(255,255,255,0.15)",
        }}
      >
        <button
          className="avatar-btn"
          onClick={onClose}
          style={{
            color: "white",
            borderColor: "rgba(255,255,255,0.3)",
          }}
        >
          ✕
        </button>
        <div className="h-title" style={{ color: "white" }}>
          capture · <em>{cat.label}</em>
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 20,
        }}
      >
        {step === "frame" && (
          <>
            <div
              style={{
                aspectRatio: "3/4",
                border: "1px dashed rgba(255,255,255,0.4)",
                borderRadius: 6,
                position: "relative",
                overflow: "hidden",
                background: `radial-gradient(circle at center, oklch(0.30 0.04 ${cat.hue}) 0%, oklch(0.18 0.02 ${cat.hue}) 100%)`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  color: "white",
                  textAlign: "center",
                  opacity: 0.7,
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                  }}
                >
                  {cat.glyph}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    marginTop: 8,
                  }}
                >
                  frame the specimen
                </div>
              </div>
            </div>
            <button
              onClick={start}
              style={{
                marginTop: 24,
                padding: "14px 24px",
                background: "white",
                color: "var(--ink)",
                border: "none",
                borderRadius: 999,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              capture
            </button>
          </>
        )}

        {step === "classifying" && (
          <div style={{ textAlign: "center", color: "white" }}>
            <div
              style={{
                fontSize: 48,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                opacity: 0.6,
              }}
            >
              {cat.glyph}
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 22,
                marginTop: 20,
              }}
            >
              looking closely…
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                marginTop: 12,
                opacity: 0.6,
              }}
            >
              AI is consulting the field guide
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div
            style={{
              background: "var(--paper)",
              borderRadius: 8,
              padding: 20,
              color: "var(--ink)",
            }}
          >
            <div className="kicker">
              identified · {result.conf}% confident
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 26,
                marginTop: 8,
                letterSpacing: "-0.01em",
              }}
            >
              {result.name}
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 14,
                color: "var(--ink-2)",
                marginTop: 2,
              }}
            >
              {result.latin}
            </div>
            <div className="margin-note" style={{ marginTop: 14, fontSize: 13 }}>
              "Added to your <em>{cat.label}</em> collection."
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button
                onClick={() => {
                  setStep("frame");
                  setResult(null);
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "var(--paper-2)",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 999,
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                not quite
              </button>
              <button
                onClick={onSave}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  border: "none",
                  borderRadius: 999,
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                pin it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ScrapbookOverlayProps {
  onClose: () => void;
}

export function ScrapbookOverlay({ onClose }: ScrapbookOverlayProps) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const totalCount = SCRAP_CATS.reduce((s, c) => s + c.count, 0);
  const totalKnown = SCRAP_CATS.reduce((s, c) => s + c.total, 0);

  if (openCat) {
    const cat = SCRAP_CATS.find((c) => c.id === openCat);
    if (!cat) return null;
    const items = SAMPLE_SPECIMENS[openCat] || [];
    return (
      <div className="overlay paper-grain">
        <div className="app-header">
          <button className="avatar-btn" onClick={() => setOpenCat(null)}>
            ‹
          </button>
          <div className="h-title">{cat.label}</div>
          <div className="h-meta">
            {cat.count}/{cat.total}
          </div>
        </div>
        <div className="app-body">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 22,
                fontStyle: "italic",
                color: `oklch(0.40 0.13 ${cat.hue})`,
              }}
            >
              {cat.glyph} {cat.label}
            </div>
            <div className="kicker">
              {((cat.count / cat.total) * 100).toFixed(0)}% catalogued
            </div>
          </div>

          <button
            onClick={() => setCapturing(true)}
            style={{
              width: "100%",
              padding: "14px",
              background: `oklch(0.94 0.04 ${cat.hue})`,
              border: `0.5px dashed oklch(0.60 0.13 ${cat.hue})`,
              borderRadius: 6,
              marginBottom: 14,
              cursor: "pointer",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 15,
              color: `oklch(0.35 0.15 ${cat.hue})`,
            }}
          >
            ◉ capture a new {cat.label.replace(/s$/, "")}
          </button>

          <Kicker>Pinned · most recent first</Kicker>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 10,
            }}
          >
            {items.map((s, i) => (
              <SpecimenCard key={i} s={s} hue={cat.hue} />
            ))}
          </div>
        </div>
        {capturing && (
          <CaptureFlow
            cat={cat}
            onClose={() => setCapturing(false)}
            onSave={() => setCapturing(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="overlay paper-grain">
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>
          ✕
        </button>
        <div className="h-title">
          the <em>scrapbook</em>
        </div>
        <div className="h-meta">
          {totalCount}
          <br />
          specimens
        </div>
      </div>
      <div className="app-body">
        <div
          className="card"
          style={{ marginBottom: 14, textAlign: "center", padding: 18 }}
        >
          <div className="kicker">field journal</div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 32,
              fontStyle: "italic",
              marginTop: 6,
              letterSpacing: "-0.01em",
            }}
          >
            {totalCount}
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 13,
              color: "var(--ink-2)",
              marginTop: 2,
            }}
          >
            specimens collected · of <em>{totalKnown}</em> known
          </div>
          <div className="margin-note" style={{ marginTop: 10, fontSize: 12 }}>
            "Take a photograph; the AI will name it for you."
          </div>
        </div>

        <Kicker>Categories</Kicker>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 10,
          }}
        >
          {SCRAP_CATS.map((c) => (
            <CatTile key={c.id} c={c} onOpen={setOpenCat} />
          ))}
        </div>

        <hr className="rule-dashed" />
        <Kicker>Recent finds · across categories</Kicker>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 10,
          }}
        >
          {SCRAP_CATS.flatMap((c) =>
            (SAMPLE_SPECIMENS[c.id] || [])
              .slice(0, 1)
              .map((s) => ({ s, hue: c.hue, cat: c })),
          )
            .slice(0, 4)
            .map((x, i) => (
              <div
                key={i}
                onClick={() => setOpenCat(x.cat.id)}
                style={{ cursor: "pointer" }}
              >
                <SpecimenCard s={x.s} hue={x.hue} />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
