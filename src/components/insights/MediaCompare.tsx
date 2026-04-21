import { C } from "../../theme";
import { MEDIA_OPTIONS } from "../../data/constants";
import type { MediaKey, MediaMap, Person } from "../../types";
import { Card } from "../shared/Card";
import { SLabel } from "../shared/SLabel";

interface MediaCompareProps {
  person: Person;
  myMedia: MediaMap;
  personColor: string;
}

export function MediaCompare({
  person,
  myMedia,
  personColor,
}: MediaCompareProps) {
  if (!person.media) return null;

  return (
    <Card sec="media">
      <SLabel sec="media">Media taste comparison</SLabel>
      {(Object.entries(MEDIA_OPTIONS) as [MediaKey, typeof MEDIA_OPTIONS[MediaKey]][]).map(
        ([key, meta]) => {
          const theirGenres = person.media?.[key] || [];
          const myGenres = myMedia[key] || [];
          const shared = theirGenres.filter((g) => myGenres.includes(g));
          const unique = theirGenres.filter((g) => !myGenres.includes(g));
          if (!theirGenres.length) return null;
          return (
            <div key={key} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 15 }}>{meta.icon}</span>
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: C.navy }}
                >
                  {meta.label}
                </span>
                {shared.length > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "3px 10px",
                      borderRadius: 10,
                      background: C.teal,
                      color: "#fff",
                      fontWeight: 700,
                      marginLeft: "auto",
                      boxShadow: `0 2px 8px ${C.teal}40`,
                    }}
                  >
                    {shared.length} shared
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {shared.map((g, i) => (
                  <span
                    key={`s-${i}`}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${C.teal}15`,
                      color: C.teal,
                      border: `1px solid ${C.teal}30`,
                    }}
                  >
                    {g}
                  </span>
                ))}
                {unique.map((g, i) => (
                  <span
                    key={`u-${i}`}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      background: `${personColor}08`,
                      color: C.muted,
                      border: `1px solid ${C.divider}`,
                    }}
                  >
                    {g}
                  </span>
                ))}
                {myGenres
                  .filter((g) => !theirGenres.includes(g))
                  .map((g, i) => (
                    <span
                      key={`m-${i}`}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        background: C.dim,
                        color: `${C.muted}88`,
                        border: `1px dashed ${C.divider}`,
                      }}
                    >
                      {g}
                    </span>
                  ))}
              </div>
            </div>
          );
        },
      )}
      <div style={{ display: "flex", gap: 12, fontSize: 11, paddingTop: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: `${C.teal}15`,
              border: `1px solid ${C.teal}30`,
              display: "inline-block",
            }}
          />
          Shared
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: `${personColor}08`,
              border: `1px solid ${C.divider}`,
              display: "inline-block",
            }}
          />
          {person.name.split(" ")[0]}'s
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: C.dim,
              border: `1px dashed ${C.divider}`,
              display: "inline-block",
            }}
          />
          Yours only
        </span>
      </div>
    </Card>
  );
}
