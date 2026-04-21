import { C } from "../../theme";
import type { Person } from "../../types";
import { Card } from "../shared/Card";
import { SLabel } from "../shared/SLabel";

interface LikesDislikesCompareProps {
  person: Person;
  myLikes: string[];
  myDislikes: string[];
  personColor: string;
}

export function LikesDislikesCompare({
  person,
  myLikes,
  myDislikes,
  personColor,
}: LikesDislikesCompareProps) {
  if (!person.likes || !person.likes.length) return null;
  const sharedLikes = (person.likes || []).filter((l) => myLikes.includes(l));
  const sharedDislikes = (person.dislikes || []).filter((d) =>
    myDislikes.includes(d),
  );
  const theirUniqLikes = (person.likes || []).filter(
    (l) => !myLikes.includes(l),
  );

  return (
    <Card sec="likes">
      <SLabel sec="likes">Likes and dislikes</SLabel>

      {sharedLikes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              color: C.teal,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Both love
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {sharedLikes.map((l, i) => (
              <span
                key={i}
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  background: `${C.teal}15`,
                  color: C.teal,
                  border: `1px solid ${C.teal}30`,
                }}
              >
                + {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {sharedDislikes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              color: C.coral,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Both dislike
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {sharedDislikes.map((d, i) => (
              <span
                key={i}
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  background: `${C.coral}10`,
                  color: C.coral,
                  border: `1px solid ${C.coral}25`,
                }}
              >
                – {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {theirUniqLikes.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              fontSize: 11,
              color: personColor,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            {person.name.split(" ")[0]} loves
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {theirUniqLikes.map((l, i) => (
              <span
                key={i}
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  background: `${personColor}10`,
                  color: personColor,
                  border: `1px solid ${personColor}25`,
                }}
              >
                + {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {sharedLikes.length === 0 && sharedDislikes.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "8px 0",
            fontSize: 13,
            color: C.muted,
          }}
        >
          No overlap found yet
        </div>
      )}
    </Card>
  );
}
