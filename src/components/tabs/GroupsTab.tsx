import { useState } from "react";
import { GROUP_TEST, SKILL_CATS, type CategoryDef } from "../../data/taxonomies";
import { Kicker } from "../shared/primitives";
import { Donut } from "../shared/charts";
import { useSkills, type UserSkill } from "../../lib/useSkills";

type SkillCat = CategoryDef;

// Local rendering type — narrower than RemoteSkill, with optional
// time-series fields that may be absent on user-added skills.
interface Skill extends UserSkill {
  sessions30?: (0 | 1)[];
  growth12w?: number[];
  milestones?: string[];
}

function SkillCard({
  s,
  cat,
  suggest,
}: {
  s: Skill;
  cat: SkillCat;
  suggest?: boolean;
}) {
  const hue = cat.hue;
  const sessions = s.sessions30 || [];
  const growth = s.growth12w || [];
  return (
    <div className="card" style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            letterSpacing: "0.1em",
            color: `oklch(0.45 0.13 ${hue})`,
          }}
        >
          {cat.glyph} {cat.label.toUpperCase()}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 18,
              letterSpacing: "-0.01em",
            }}
          >
            {s.name}
          </div>
          <div
            className="kicker"
            style={{ marginTop: 2, textTransform: "none" }}
          >
            {s.hours.toLocaleString()} hours
            {s.lastPracticed && s.lastPracticed !== "—"
              ? ` · last practiced ${s.lastPracticed}`
              : ""}
          </div>
          {s.vibe && (
            <div
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: 13,
                color: "var(--ink-2)",
                marginTop: 6,
              }}
            >
              {s.vibe}
            </div>
          )}
        </div>
        <Donut value={s.level} color={`oklch(0.55 0.12 ${hue})`} size={62} />
      </div>
      {suggest && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "0.5px dashed var(--rule)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span className="margin-note" style={{ fontSize: 11 }}>
            not yet practiced
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.16em",
              padding: "6px 10px",
              border: `0.5px solid oklch(0.55 0.12 ${hue})`,
              color: `oklch(0.45 0.13 ${hue})`,
              cursor: "pointer",
            }}
          >
            BEGIN ›
          </span>
        </div>
      )}
      {!suggest && sessions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <svg viewBox="0 0 220 36" style={{ width: "100%" }}>
            {sessions.map((d, i) => {
              const x = 6 + (i / (sessions.length - 1)) * 208;
              const y =
                18 +
                (d
                  ? -10 + Math.sin(i * 1.7) * 4
                  : 10 + Math.sin(i * 1.3) * 3);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={d ? 2.2 : 1.2}
                  fill={`oklch(0.45 0.12 ${hue})`}
                  opacity={d ? 0.85 : 0.25}
                />
              );
            })}
            <line
              x1="6"
              y1="18"
              x2="214"
              y2="18"
              stroke="var(--rule)"
              strokeWidth="0.4"
              strokeDasharray="2 3"
            />
            <path
              d={growth
                .map((v, i) => {
                  const x = 6 + (i / (growth.length - 1)) * 208;
                  const y = 30 - (v / 100) * 24;
                  return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                })
                .join(" ")}
              fill="none"
              stroke={`oklch(0.55 0.13 ${hue})`}
              strokeWidth="1"
              strokeOpacity="0.6"
            />
          </svg>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--mono)",
              fontSize: 8,
              color: "var(--ink-3)",
              letterSpacing: "0.06em",
              marginTop: 2,
            }}
          >
            <span>
              30 days · {sessions.filter((d) => d).length} sessions
            </span>
            <span>
              level +
              {growth.length ? growth[growth.length - 1] - growth[0] : 0} in
              12w
            </span>
          </div>
          {s.milestones && s.milestones.length > 0 && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: "0.5px dashed var(--rule)",
              }}
            >
              <div
                className="kicker"
                style={{ marginBottom: 4 }}
              >
                MILESTONES
              </div>
              {s.milestones.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 6,
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 11.5,
                    color: "var(--ink-2)",
                    marginBottom: 2,
                  }}
                >
                  <span style={{ color: `oklch(0.55 0.13 ${hue})` }}>·</span>
                  <span>{m}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {suggest && growth.length > 0 && (
        <svg
          viewBox="0 0 220 28"
          style={{ width: "100%", marginTop: 10 }}
        >
          <path
            d={growth
              .map((v, i) => {
                const x = 6 + (i / (growth.length - 1)) * 208;
                const y = 24 - (v / 100) * 20;
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ")}
            fill="none"
            stroke={`oklch(0.55 0.13 ${hue})`}
            strokeWidth="1.2"
            strokeDasharray="2 2"
            strokeOpacity="0.5"
          />
        </svg>
      )}
    </div>
  );
}

interface TestOpt {
  t: string;
  cats: string[];
}

function GroupTestOverlay({
  onClose,
  skills,
}: {
  onClose: () => void;
  skills: Skill[];
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<TestOpt[]>([]);
  const total = GROUP_TEST.length;

  if (step >= total) {
    const score: Record<string, number> = {};
    answers.forEach((a) =>
      a.cats.forEach((c) => (score[c] = (score[c] || 0) + 1)),
    );
    const top = Object.entries(score)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);
    // Recommend categories where the user hasn't yet added a skill —
    // matches the user's recent test answers against the gap in their
    // existing skill list.
    const userCats = new Set(skills.map((s) => s.cat));
    const recCats = top.filter((c) => !userCats.has(c)).slice(0, 3);
    return (
      <div className="overlay" onClick={onClose}>
        <div
          className="overlay-inner"
          onClick={(e) => e.stopPropagation()}
          style={{ padding: 24, overflowY: "auto" }}
        >
          <div
            className="overlay-close"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              fontSize: 24,
              cursor: "pointer",
              color: "var(--ink-3)",
            }}
          >
            ×
          </div>
          <Kicker>Result</Kicker>
          <h2
            style={{
              fontFamily: "var(--serif)",
              fontSize: 28,
              fontStyle: "italic",
              margin: "6px 0 16px",
            }}
          >
            Three skills for you.
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {top.map((id) => {
              const c = SKILL_CATS.find((x) => x.id === id);
              if (!c) return null;
              return (
                <span
                  key={id}
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    padding: "4px 10px",
                    background: `oklch(0.93 0.05 ${c.hue})`,
                    color: `oklch(0.32 0.13 ${c.hue})`,
                    borderRadius: 999,
                  }}
                >
                  {c.glyph} {c.label.toUpperCase()}
                </span>
              );
            })}
          </div>
          {recCats.length === 0 && (
            <div
              className="margin-note"
              style={{
                fontStyle: "italic",
                fontSize: 13,
                padding: 12,
                textAlign: "center",
              }}
            >
              You're already practising in every category we'd suggest.
            </div>
          )}
          {recCats.map((catId) => {
            const c = SKILL_CATS.find((x) => x.id === catId);
            if (!c) return null;
            return (
              <div key={catId} className="card" style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color: `oklch(0.45 0.13 ${c.hue})`,
                  }}
                >
                  {c.glyph} {c.label.toUpperCase()}
                </div>
                <div
                  className="margin-note"
                  style={{ fontSize: 12, fontStyle: "italic", marginTop: 4 }}
                >
                  Try adding a {c.label.toLowerCase()} skill — your test answers
                  point here.
                </div>
              </div>
            );
          })}
          <div style={{ textAlign: "right", marginTop: 16 }}>
            <span
              onClick={() => {
                setStep(0);
                setAnswers([]);
              }}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.16em",
                padding: "8px 12px",
                border: "0.5px solid var(--ink)",
                cursor: "pointer",
                marginRight: 8,
              }}
            >
              RETAKE
            </span>
            <span
              onClick={onClose}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.16em",
                padding: "8px 12px",
                background: "var(--ink)",
                color: "var(--paper)",
                cursor: "pointer",
              }}
            >
              CLOSE
            </span>
          </div>
        </div>
      </div>
    );
  }
  const q = GROUP_TEST[step];
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="overlay-inner"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 24, overflowY: "auto" }}
      >
        <div
          className="overlay-close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            fontSize: 24,
            cursor: "pointer",
            color: "var(--ink-3)",
          }}
        >
          ×
        </div>
        <Kicker>
          Question {step + 1} / {total}
        </Kicker>
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontSize: 26,
            fontStyle: "italic",
            margin: "6px 0 18px",
          }}
        >
          {q.q}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.opts.map((o: TestOpt, i: number) => (
            <div
              key={i}
              onClick={() => {
                setAnswers([...answers, o]);
                setStep(step + 1);
              }}
              className="card"
              style={{
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 16,
                  fontStyle: "italic",
                }}
              >
                {o.t}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 14,
                  color: "var(--ink-3)",
                }}
              >
                ›
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GroupsTab() {
  const [active, setActive] = useState<Set<string>>(new Set());
  const [showTest, setShowTest] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const { skills: userSkills, add: addSkill } = useSkills();

  const cats: SkillCat[] = SKILL_CATS;
  const isAll = active.size === 0;
  const toggle = (id: string) =>
    setActive((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allSkills: Skill[] = userSkills as Skill[];
  const visible: Skill[] = allSkills.filter(
    (g) => isAll || active.has(g.id),
  );
  const suggest = visible.filter((g) => !g.joined);
  const joined = visible.filter((g) => g.joined);
  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

  const totalHours = visible.reduce((s, sk) => s + sk.hours, 0);
  const avgLevel = avg(visible.map((s) => s.level));
  const topCat = (() => {
    const map: Record<string, number> = {};
    visible.forEach((s) => {
      map[s.cat] = (map[s.cat] || 0) + s.hours;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0];
  })();
  const topCatLabel = cats.find((c) => c.id === topCat)?.label || "—";

  return (
    <div className="fade-in">
      <div className="page-num">— xv —</div>
      <Kicker>Practice · skills you keep</Kicker>
      <div className="sec-head">
        <h2>
          The skills you <em>return to</em>
        </h2>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <Kicker>Filter · skills</Kicker>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span
              onClick={() => setShowAdd(true)}
              className="kicker"
              style={{ cursor: "pointer", color: "var(--accent)" }}
            >
              + ADD
            </span>
            <span
              className="kicker"
              style={{ cursor: "pointer" }}
              onClick={() => setActive(new Set())}
            >
              {isAll ? "ALL" : "CLEAR"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {allSkills.length === 0 && (
            <div
              className="margin-note"
              style={{ fontSize: 12, fontStyle: "italic" }}
            >
              No skills yet — tap "+ ADD" above to add the first.
            </div>
          )}
          {allSkills.map((sk) => {
            const c = cats.find((x) => x.id === sk.cat);
            if (!c) return null;
            const on = isAll || active.has(sk.id);
            return (
              <span
                key={sk.id}
                onClick={() => toggle(sk.id)}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  padding: "5px 10px",
                  border: "0.5px solid var(--rule)",
                  borderRadius: 999,
                  cursor: "pointer",
                  background: on
                    ? `oklch(0.93 0.05 ${c.hue})`
                    : "transparent",
                  color: on
                    ? `oklch(0.32 0.13 ${c.hue})`
                    : "var(--ink-3)",
                  borderColor: on
                    ? `oklch(0.65 0.13 ${c.hue})`
                    : "var(--rule)",
                  opacity: sk.joined ? 1 : 0.78,
                }}
              >
                <span style={{ marginRight: 5 }}>{c.glyph}</span>
                {sk.name.toUpperCase()}
              </span>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Where the hours go {!isAll && "· filtered"}</Kicker>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginTop: 10,
          }}
        >
          <div>
            <div className="kicker">HOURS</div>
            <div className="fig-num" style={{ fontSize: 24 }}>
              <em>{totalHours.toLocaleString()}</em>
            </div>
          </div>
          <div>
            <div className="kicker">AVG LEVEL</div>
            <div className="fig-num" style={{ fontSize: 24 }}>
              <em>{avgLevel}</em>
            </div>
          </div>
          <div>
            <div className="kicker">MOST TIME</div>
            <div className="fig-num" style={{ fontSize: 18, marginTop: 4 }}>
              <em>{topCatLabel}</em>
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "0.5px dashed var(--rule)",
          }}
        >
          <div className="kicker" style={{ marginBottom: 6 }}>
            LEVEL BY CATEGORY
          </div>
          {cats.map((c) => {
            const inCat = visible.filter((s) => s.cat === c.id);
            if (!inCat.length) return null;
            const lvl = avg(inCat.map((s) => s.level));
            return (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    width: 80,
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 12,
                    color: `oklch(0.45 0.13 ${c.hue})`,
                  }}
                >
                  {c.glyph} {c.label}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: "var(--paper-2)",
                    border: "0.5px solid var(--rule)",
                    borderRadius: 2,
                  }}
                >
                  <div
                    style={{
                      width: `${lvl}%`,
                      height: "100%",
                      background: `oklch(0.55 0.13 ${c.hue})`,
                    }}
                  />
                </div>
                <span
                  style={{
                    width: 28,
                    textAlign: "right",
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--ink-3)",
                  }}
                >
                  {lvl}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 14,
          background: "oklch(0.97 0.02 80)",
          borderColor: "oklch(0.85 0.06 80)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <Kicker>A short test · find a skill to grow</Kicker>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 16,
                marginTop: 4,
              }}
            >
              <em>Three questions, one suggestion.</em>
            </div>
          </div>
          <span
            onClick={() => setShowTest(true)}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.16em",
              padding: "8px 12px",
              border: "0.5px solid var(--ink)",
              cursor: "pointer",
            }}
          >
            BEGIN ›
          </span>
        </div>
      </div>

      {visible.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginTop: 8,
            marginBottom: 16,
          }}
        >
          {joined.map((g) => {
            const cat = cats.find((c) => c.id === g.cat);
            if (!cat) return null;
            return <SkillCard key={g.id} s={g} cat={cat} />;
          })}
          {suggest.length > 0 && joined.length > 0 && (
            <hr className="rule-dashed" style={{ margin: 0 }} />
          )}
          {suggest.map((g) => {
            const cat = cats.find((c) => c.id === g.cat);
            if (!cat) return null;
            return <SkillCard key={g.id} s={g} cat={cat} suggest />;
          })}
        </div>
      )}

      {visible.length === 0 && allSkills.length > 0 && (
        <div
          className="margin-note"
          style={{ textAlign: "center", padding: 24, fontStyle: "italic" }}
        >
          Nothing in this filter yet.
        </div>
      )}

      {allSkills.length === 0 && (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: 28,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 14,
            color: "var(--ink-3)",
            marginTop: 8,
          }}
        >
          Add a skill you're returning to — woodworking, French,
          jiu-jitsu, sourdough. The cards build over time as you log
          hours.
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              style={{
                padding: "8px 14px",
                background: "var(--ink)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 99,
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                cursor: "pointer",
              }}
            >
              + ADD FIRST SKILL
            </button>
          </div>
        </div>
      )}

      {showTest && (
        <GroupTestOverlay
          onClose={() => setShowTest(false)}
          skills={allSkills}
        />
      )}
      {showAdd && (
        <AddSkillModal
          cats={cats}
          onClose={() => setShowAdd(false)}
          onAdd={async (input) => {
            await addSkill(input);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

// ───────── Add-skill modal ─────────

function AddSkillModal({
  cats,
  onClose,
  onAdd,
}: {
  cats: SkillCat[];
  onClose: () => void;
  onAdd: (s: Omit<UserSkill, "id">) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [cat, setCat] = useState(cats[0]?.id ?? "");
  const [hours, setHours] = useState("");
  const [level, setLevel] = useState(30);
  const [vibe, setVibe] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || !cat) return;
    setSubmitting(true);
    try {
      await onAdd({
        name: name.trim(),
        cat,
        hours: Number(hours) || 0,
        level,
        joined: true,
        vibe: vibe.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="overlay-inner"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 24, maxWidth: 360 }}
      >
        <div
          className="overlay-close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            fontSize: 24,
            cursor: "pointer",
            color: "var(--ink-3)",
          }}
        >
          ×
        </div>
        <Kicker>Add a skill</Kicker>
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontSize: 22,
            fontStyle: "italic",
            margin: "6px 0 16px",
          }}
        >
          Something you <em>return to</em>.
        </h2>

        <label className="kicker" style={{ display: "block", marginTop: 8 }}>
          NAME
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. woodworking"
          style={{
            width: "100%",
            padding: "8px 10px",
            marginTop: 4,
            border: "0.5px solid var(--rule)",
            background: "var(--paper)",
            fontFamily: "var(--serif)",
            fontSize: 15,
            borderRadius: 6,
          }}
        />

        <label className="kicker" style={{ display: "block", marginTop: 12 }}>
          CATEGORY
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {cats.map((c) => {
            const on = cat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  padding: "5px 10px",
                  border: `0.5px solid ${on ? `oklch(0.65 0.13 ${c.hue})` : "var(--rule)"}`,
                  borderRadius: 999,
                  cursor: "pointer",
                  background: on
                    ? `oklch(0.93 0.05 ${c.hue})`
                    : "transparent",
                  color: on
                    ? `oklch(0.32 0.13 ${c.hue})`
                    : "var(--ink-3)",
                }}
              >
                {c.glyph} {c.label.toUpperCase()}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="kicker" style={{ display: "block" }}>
              HOURS SO FAR
            </label>
            <input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0"
              style={{
                width: "100%",
                padding: "8px 10px",
                marginTop: 4,
                border: "0.5px solid var(--rule)",
                background: "var(--paper)",
                fontFamily: "var(--mono)",
                fontSize: 14,
                borderRadius: 6,
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="kicker" style={{ display: "block" }}>
              LEVEL · {level}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              style={{ width: "100%", marginTop: 8 }}
            />
          </div>
        </div>

        <label className="kicker" style={{ display: "block", marginTop: 12 }}>
          A LINE ON HOW IT FEELS · OPTIONAL
        </label>
        <input
          type="text"
          value={vibe}
          onChange={(e) => setVibe(e.target.value)}
          placeholder="quiet, careful, hands learning slowly"
          style={{
            width: "100%",
            padding: "8px 10px",
            marginTop: 4,
            border: "0.5px solid var(--rule)",
            background: "var(--paper)",
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 13,
            borderRadius: 6,
          }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: 10,
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 999,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!name.trim() || submitting}
            style={{
              flex: 1,
              padding: 10,
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 999,
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              cursor: !name.trim() || submitting ? "not-allowed" : "pointer",
              opacity: !name.trim() || submitting ? 0.5 : 1,
            }}
          >
            {submitting ? "…" : "ADD"}
          </button>
        </div>
      </div>
    </div>
  );
}
