// InterestsTab — what you're into, plus who else is.
//
// Replaces the old GroupsTab/skills concept (with hours, levels,
// milestones, the three-question test) with a much simpler shape:
//   - You add interests by name + category.
//   - You filter by category to find your list quickly.
//   - The demographics card shows who in your circle / followers /
//     following shares the filtered interests, with k-anonymised
//     personality / gender / age / country breakdowns.
//   - When exactly one interest is selected, voting lists (best
//     media / public figures / literature / tips) render below the
//     demographics. Voting is shipped in a follow-up commit; for
//     now the lists render as honest empty-state placeholders.

import { useMemo, useState } from "react";
import { INTEREST_CATS } from "../../data/taxonomies";
import { Kicker } from "../shared/primitives";
import { HBars } from "../shared/charts";
import { useInterests } from "../../lib/useInterests";
import { useInterestStats } from "../../lib/useInterestStats";
import {
  INTEREST_ITEM_TYPES,
  useInterestVotes,
} from "../../lib/useInterestVotes";
import type { InterestItem, InterestItemType } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";

const TRAIT_LABELS = ["Open", "Conscient.", "Extra.", "Agree.", "Neuro."];

export function InterestsTab() {
  const { interests, add, remove } = useInterests();
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // Filter combines two predicates: matching category AND matching
  // selected-name. Either can be empty (all categories or all names).
  const visible = useMemo(() => {
    return interests.filter((i) => {
      if (selectedCats.size > 0 && !selectedCats.has(i.cat)) return false;
      return true;
    });
  }, [interests, selectedCats]);

  const filterNames = selectedNames.size > 0
    ? [...selectedNames]
    : visible.map((i) => i.name);
  const stats = useInterestStats(filterNames);

  const toggleCat = (id: string) => {
    setSelectedCats((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleName = (name: string) => {
    setSelectedNames((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const showSingleInterestDeep = selectedNames.size === 1;

  return (
    <div className="fade-in">
      <Kicker>Interests · what you're into</Kicker>
      <div className="sec-head">
        <h2>
          Your <em>interests</em>
        </h2>
      </div>

      <CategoryFilter
        active={selectedCats}
        onToggle={toggleCat}
        onClear={() => setSelectedCats(new Set())}
      />

      {interests.length === 0 && (
        <EmptyInterestList onAdd={() => setAdding(true)} />
      )}

      {interests.length > 0 && (
        <InterestList
          interests={visible}
          selectedNames={selectedNames}
          onToggle={toggleName}
          onRemove={(id) => void remove(id)}
          onAdd={() => setAdding(true)}
        />
      )}

      <DemographicsCard
        stats={stats}
        filterNames={filterNames}
        anyInterests={interests.length > 0}
      />

      {showSingleInterestDeep && (
        <DeepInterestCard interestName={[...selectedNames][0]!} />
      )}

      {adding && (
        <AddInterestSheet
          onCancel={() => setAdding(false)}
          onAdd={async (input) => {
            await add(input);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

// ─── filter pills ────────────────────────────────────────────────

function CategoryFilter({
  active,
  onToggle,
  onClear,
}: {
  active: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="card" style={{ padding: 12, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <Kicker>Filter by category</Kicker>
        {active.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            style={{
              background: "transparent",
              border: "none",
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--ink-3)",
              cursor: "pointer",
            }}
          >
            CLEAR
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {INTEREST_CATS.map((c) => {
          const on = active.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                cursor: "pointer",
                background: on ? `oklch(0.92 0.07 ${c.hue})` : "var(--paper-2)",
                color: on ? `oklch(0.3 0.14 ${c.hue})` : "var(--ink-2)",
                border: on ? `0.5px solid oklch(0.65 0.10 ${c.hue})` : "0.5px solid var(--rule)",
              }}
            >
              <span style={{ marginRight: 4 }}>{c.glyph}</span>
              {c.label.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── interest list (your own) ─────────────────────────────────────

function InterestList({
  interests,
  selectedNames,
  onToggle,
  onRemove,
  onAdd,
}: {
  interests: { id: string; name: string; cat: string }[];
  selectedNames: Set<string>;
  onToggle: (name: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="card" style={{ padding: 12, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <Kicker>Your list · {interests.length}</Kicker>
        <button
          type="button"
          onClick={onAdd}
          style={{
            background: "transparent",
            border: "none",
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          + ADD
        </button>
      </div>

      {interests.length === 0 ? (
        <div
          className="margin-note"
          style={{ fontStyle: "italic", fontSize: 12 }}
        >
          No interests in this category yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {interests.map((i) => {
            const cat = INTEREST_CATS.find((c) => c.id === i.cat);
            const hue = cat?.hue ?? 50;
            const on = selectedNames.has(i.name);
            return (
              <div
                key={i.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  background: on ? `oklch(0.96 0.04 ${hue})` : "var(--paper-2)",
                  border: on
                    ? `0.5px solid oklch(0.65 0.10 ${hue})`
                    : "0.5px solid var(--rule)",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                onClick={() => onToggle(i.name)}
              >
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 14,
                    color: `oklch(0.35 0.14 ${hue})`,
                    width: 16,
                    textAlign: "center",
                  }}
                >
                  {cat?.glyph ?? "·"}
                </span>
                <span
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 14,
                    flex: 1,
                  }}
                >
                  {i.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    color: "var(--ink-3)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {cat?.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(i.id);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--ink-3)",
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                  }}
                  aria-label="remove"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyInterestList({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="card"
      style={{
        padding: 22,
        marginBottom: 14,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 14,
          color: "var(--ink-2)",
        }}
      >
        Add the things you're into — pottery, distance running, Murakami,
        sourdough, chess. Your list powers the demographic stats below
        and matches with nearby people.
      </div>
      <button
        type="button"
        onClick={onAdd}
        style={{
          marginTop: 12,
          padding: "10px 16px",
          background: "var(--ink)",
          color: "var(--paper)",
          border: "none",
          borderRadius: 999,
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.12em",
          cursor: "pointer",
        }}
      >
        + ADD FIRST INTEREST
      </button>
    </div>
  );
}

// ─── add sheet ───────────────────────────────────────────────────

function AddInterestSheet({
  onCancel,
  onAdd,
}: {
  onCancel: () => void;
  onAdd: (input: { name: string; cat: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [cat, setCat] = useState<string>(INTEREST_CATS[0].id);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onAdd({ name: trimmed, cat });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(20,18,14,0.85)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--paper)",
          borderRadius: 12,
          padding: 18,
          maxWidth: 360,
          width: "100%",
        }}
      >
        <Kicker>Add interest</Kicker>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="e.g. distance running, jazz, sourdough"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            marginTop: 8,
            background: "var(--paper-2)",
            border: "0.5px solid var(--rule)",
            borderRadius: 8,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 15,
            color: "var(--ink)",
          }}
        />

        <div style={{ marginTop: 14 }}>
          <Kicker>Category</Kicker>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {INTEREST_CATS.map((c) => {
              const on = cat === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(c.id)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    background: on ? `oklch(0.92 0.07 ${c.hue})` : "var(--paper-2)",
                    color: on ? `oklch(0.3 0.14 ${c.hue})` : "var(--ink-2)",
                    border: on ? `0.5px solid oklch(0.65 0.10 ${c.hue})` : "0.5px solid var(--rule)",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ marginRight: 4 }}>{c.glyph}</span>
                  {c.label.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px",
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 999,
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              cursor: "pointer",
            }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!name.trim() || saving}
            style={{
              flex: 1,
              padding: "10px",
              background: name.trim() ? "var(--ink)" : "var(--paper-3)",
              color: name.trim() ? "var(--paper)" : "var(--ink-3)",
              border: "none",
              borderRadius: 999,
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              cursor: name.trim() ? "pointer" : "default",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "ADDING…" : "ADD"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── demographics card ────────────────────────────────────────────

function DemographicsCard({
  stats,
  filterNames,
  anyInterests,
}: {
  stats: ReturnType<typeof useInterestStats>;
  filterNames: string[];
  anyInterests: boolean;
}) {
  if (!anyInterests) return null;

  const label =
    filterNames.length === 0
      ? "everyone"
      : filterNames.length === 1
        ? `into "${filterNames[0]}"`
        : `into any of ${filterNames.length} interests`;

  if (stats.loading) {
    return (
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <Kicker>People · {label}</Kicker>
        <div className="margin-note" style={{ marginTop: 8, fontSize: 12 }}>
          Loading…
        </div>
      </div>
    );
  }

  if (stats.insufficient) {
    return (
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <Kicker>People · {label}</Kicker>
        <div className="margin-note" style={{ marginTop: 8, fontSize: 12, fontStyle: "italic" }}>
          {stats.count === 0
            ? "No one in your circle or among followers shares these interests yet."
            : `Only ${stats.count} match${stats.count === 1 ? "" : "es"} — need at least 3 for an honest breakdown.`}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Kicker>People · {label}</Kicker>
        <span
          className="fig-num"
          style={{ fontSize: 22, fontStyle: "italic" }}
        >
          {stats.count}
        </span>
      </div>

      {stats.personality && (
        <div style={{ marginTop: 12 }}>
          <Kicker>Personality · average</Kicker>
          <div style={{ marginTop: 8 }}>
            <HBars
              items={stats.personality.map((v, i) => ({
                label: TRAIT_LABELS[i],
                value: v,
                color: "var(--sage)",
              }))}
            />
          </div>
        </div>
      )}

      {Object.keys(stats.genderRatio).length > 0 && (
        <RatioStrip title="Gender" map={stats.genderRatio} />
      )}

      {Object.keys(stats.ageBuckets).length > 0 && (
        <RatioStrip title="Age" map={stats.ageBuckets} order={["<20", "20-29", "30-39", "40-49", "50+"]} />
      )}

      {Object.keys(stats.countryRatio).length > 0 && (
        <RatioStrip title="Country" map={stats.countryRatio} maxItems={6} />
      )}

      <div
        className="margin-note"
        style={{ marginTop: 12, fontSize: 11, fontStyle: "italic" }}
      >
        Aggregated from friends, followers, and people you follow who
        opted into sharing each field. Minimum 3 matches per breakdown
        for an honest reading.
      </div>
    </div>
  );
}

function RatioStrip({
  title,
  map,
  order,
  maxItems,
}: {
  title: string;
  map: Record<string, number>;
  order?: string[];
  maxItems?: number;
}) {
  const entries = order
    ? order
        .filter((k) => map[k] != null && map[k] > 0)
        .map((k) => [k, map[k]!] as [string, number])
    : Object.entries(map).sort((a, b) => b[1] - a[1]);
  const limited = maxItems ? entries.slice(0, maxItems) : entries;

  return (
    <div style={{ marginTop: 14 }}>
      <Kicker>{title}</Kicker>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
        {limited.map(([k, frac]) => (
          <div
            key={k}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--mono)",
              fontSize: 11,
            }}
          >
            <span style={{ width: 90, color: "var(--ink-2)" }}>{k}</span>
            <div
              style={{
                flex: 1,
                height: 4,
                background: "var(--paper-2)",
                border: "0.5px solid var(--rule)",
                borderRadius: 999,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round(frac * 100)}%`,
                  height: "100%",
                  background: "var(--ochre)",
                }}
              />
            </div>
            <span style={{ width: 40, textAlign: "right", color: "var(--ink-3)" }}>
              {Math.round(frac * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── single-interest deep view (community voting lists) ──────────

function DeepInterestCard({ interestName }: { interestName: string }) {
  const { user } = useAuth();
  const vote = useInterestVotes(interestName);
  const [activeType, setActiveType] = useState<InterestItemType>("media");
  const [suggesting, setSuggesting] = useState(false);

  const items = vote.byType[activeType];
  const canVote = !!user;

  return (
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Kicker>{interestName} · community picks</Kicker>
        <button
          type="button"
          onClick={() => setSuggesting(true)}
          disabled={!canVote}
          style={{
            background: "transparent",
            border: "none",
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            color: canVote ? "var(--ink)" : "var(--ink-3)",
            cursor: canVote ? "pointer" : "default",
          }}
        >
          + SUGGEST
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {INTEREST_ITEM_TYPES.map((t) => {
          const on = activeType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveType(t.id)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                background: on ? "var(--ink)" : "var(--paper-2)",
                color: on ? "var(--paper)" : "var(--ink-2)",
                border: on ? "none" : "0.5px solid var(--rule)",
                cursor: "pointer",
              }}
            >
              {t.label.toUpperCase()}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        {vote.loading ? (
          <div className="margin-note" style={{ fontSize: 12 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div
            className="margin-note"
            style={{
              fontSize: 12,
              fontStyle: "italic",
              padding: 14,
              textAlign: "center",
            }}
          >
            {canVote
              ? `No ${INTEREST_ITEM_TYPES.find((t) => t.id === activeType)?.label.toLowerCase()} suggested yet. Be the first — tap "+ SUGGEST".`
              : "Sign in to see and vote on community picks."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((item) => (
              <VoteItemRow
                key={item.id}
                item={item}
                voted={vote.votedIds.has(item.id)}
                canVote={canVote}
                isMine={!!user && item.createdBy === user.uid}
                onUpvote={() => void vote.upvote(item.id)}
                onUnvote={() => void vote.unvote(item.id)}
                onDelete={() => {
                  if (!confirm("Delete this suggestion?")) return;
                  void vote.remove(item.id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {suggesting && (
        <SuggestSheet
          interestName={interestName}
          defaultType={activeType}
          onCancel={() => setSuggesting(false)}
          onSubmit={async (type, name, description) => {
            await vote.suggest(type, name, description);
            setActiveType(type);
            setSuggesting(false);
          }}
        />
      )}
    </div>
  );
}

function VoteItemRow({
  item,
  voted,
  canVote,
  isMine,
  onUpvote,
  onUnvote,
  onDelete,
}: {
  item: InterestItem;
  voted: boolean;
  canVote: boolean;
  isMine: boolean;
  onUpvote: () => void;
  onUnvote: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        background: voted ? "oklch(0.96 0.04 60)" : "var(--paper-2)",
        border: voted ? "0.5px solid oklch(0.65 0.10 60)" : "0.5px solid var(--rule)",
        borderRadius: 8,
      }}
    >
      <button
        type="button"
        onClick={voted ? onUnvote : onUpvote}
        disabled={!canVote}
        title={
          !canVote
            ? "Sign in to vote"
            : voted
              ? "Remove your upvote"
              : "Upvote"
        }
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "transparent",
          border: "none",
          padding: "2px 6px",
          cursor: canVote ? "pointer" : "default",
          color: voted ? "oklch(0.45 0.16 30)" : "var(--ink-3)",
        }}
        aria-label={voted ? "remove vote" : "upvote"}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{voted ? "▲" : "△"}</span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: voted ? "oklch(0.45 0.16 30)" : "var(--ink-2)",
            marginTop: 2,
          }}
        >
          {item.voteCount}
        </span>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 14,
            color: "var(--ink)",
          }}
        >
          {item.name}
        </div>
        {item.description && (
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 12,
              color: "var(--ink-2)",
              marginTop: 2,
              lineHeight: 1.35,
            }}
          >
            {item.description}
          </div>
        )}
      </div>
      {isMine && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="delete suggestion"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--ink-3)",
            cursor: "pointer",
            fontFamily: "var(--mono)",
            fontSize: 12,
            padding: "0 4px",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function SuggestSheet({
  interestName,
  defaultType,
  onCancel,
  onSubmit,
}: {
  interestName: string;
  defaultType: InterestItemType;
  onCancel: () => void;
  onSubmit: (
    type: InterestItemType,
    name: string,
    description?: string,
  ) => Promise<void>;
}) {
  const [type, setType] = useState<InterestItemType>(defaultType);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(type, trimmed, description.trim() || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    background: "var(--paper-2)",
    border: "0.5px solid var(--rule)",
    borderRadius: 8,
    fontFamily: "var(--serif)",
    fontSize: 14,
    color: "var(--ink)",
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(20,18,14,0.85)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--paper)",
          borderRadius: 12,
          padding: 18,
          maxWidth: 380,
          width: "100%",
        }}
      >
        <Kicker>Suggest · {interestName}</Kicker>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {INTEREST_ITEM_TYPES.map((t) => {
            const on = type === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  background: on ? "var(--ink)" : "var(--paper-2)",
                  color: on ? "var(--paper)" : "var(--ink-2)",
                  border: on ? "none" : "0.5px solid var(--rule)",
                  cursor: "pointer",
                }}
              >
                {t.label.toUpperCase()}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 14 }}>
          <Kicker>Name</Kicker>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tove Jansson, Steady running, Mariko Aoki"
            maxLength={120}
            style={{ ...inputStyle, marginTop: 6, fontStyle: "italic" }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Kicker>Description · optional</Kicker>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A sentence or two about why."
            maxLength={500}
            rows={3}
            style={{ ...inputStyle, marginTop: 6, resize: "vertical" }}
          />
          <div
            style={{
              textAlign: "right",
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--ink-3)",
              marginTop: 2,
            }}
          >
            {description.length}/500
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px",
              background: "var(--paper-2)",
              border: "0.5px solid var(--rule)",
              borderRadius: 999,
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              cursor: "pointer",
            }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!name.trim() || submitting}
            style={{
              flex: 1,
              padding: "10px",
              background: name.trim() ? "var(--ink)" : "var(--paper-3)",
              color: name.trim() ? "var(--paper)" : "var(--ink-3)",
              border: "none",
              borderRadius: 999,
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              cursor: name.trim() ? "pointer" : "default",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "POSTING…" : "POST"}
          </button>
        </div>
      </div>
    </div>
  );
}

