import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C, SEC } from "../../../theme";
import {
  EXPENSE_CATS,
  INCOME_CATS,
  TODAY,
  daysAgo,
} from "../../../data/insightDefaults";
import { fmtDate } from "../../../utils/helpers";
import type { Transaction, TransactionType } from "../../../types";
import { Card } from "../../shared/Card";
import { SLabel } from "../../shared/SLabel";
import { BarFill } from "../../shared/BarFill";

interface FinancePanelProps {
  transactions: Transaction[];
  onLog: (t: Omit<Transaction, "id">) => void;
  onToast: (message: string, color: string, icon: string) => void;
}

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 12,
  border: `1px solid ${C.divider}`,
  background: C.dim,
  color: C.text,
  fontFamily: "inherit",
  fontSize: 14,
  outline: "none",
  marginBottom: 8,
} as const;

const CAT_COLS = [C.coral, C.amber, C.green, C.purple, C.pink, C.muted];

export function FinancePanel({
  transactions,
  onLog,
  onToast,
}: FinancePanelProps) {
  const [show, setShow] = useState(false);
  const [txType, setTxType] = useState<TransactionType>("expense");
  const [cat, setCat] = useState("Food");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    if (!amount) return;
    onLog({
      date: TODAY,
      type: txType,
      category: cat,
      amount: Number(amount),
      note,
    });
    onToast(
      `${txType === "income" ? "Income" : "Expense"} logged`,
      txType === "income" ? C.teal : C.coral,
      "✓",
    );
    setAmount("");
    setNote("");
    setShow(false);
  }

  // Cumulative cashflow over the last 30 days, plus daily expense bars.
  const trend = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => daysAgo(29 - i));
    let running = 0;
    return days.map((date) => {
      const same = transactions.filter((t) => t.date === date);
      const income = same
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0);
      const expense = same
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);
      running += income - expense;
      return {
        date,
        income,
        expense,
        net: running,
        label: new Date(date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
      };
    });
  }, [transactions]);
  const hasTrend = trend.some((d) => d.income > 0 || d.expense > 0);

  const monthTx = transactions.filter((t) => t.date >= daysAgo(30));
  const monthIncome = monthTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const net = monthIncome - monthExpense;
  const savingsPct =
    monthIncome > 0
      ? Math.min(100, Math.max(0, (net / monthIncome) * 100))
      : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card sec="finance">
        <SLabel sec="finance">This month</SLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              background: SEC.interests.bg,
              borderRadius: 14,
              padding: "14px 16px",
              border: `1.5px solid ${C.teal}40`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: C.teal,
                fontWeight: 700,
                letterSpacing: "0.8px",
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Income
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.teal }}>
              {monthIncome.toLocaleString()} kr
            </div>
          </div>
          <div
            style={{
              background: SEC.mood.bg,
              borderRadius: 14,
              padding: "14px 16px",
              border: `1.5px solid ${C.coral}40`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: C.coral,
                fontWeight: 700,
                letterSpacing: "0.8px",
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Expenses
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.coral }}>
              {monthExpense.toLocaleString()} kr
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
          Net savings
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              flex: 1,
              height: 12,
              background: C.dim,
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${savingsPct}%`,
                background:
                  net >= 0
                    ? `linear-gradient(90deg, ${C.green}bb, ${C.teal})`
                    : `linear-gradient(90deg, ${C.red}bb, ${C.coral})`,
                borderRadius: 6,
              }}
            />
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: net >= 0 ? C.teal : C.coral,
              flexShrink: 0,
            }}
          >
            {net.toLocaleString()} kr
          </span>
        </div>
      </Card>

      {hasTrend && (
        <Card sec="finance">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <SLabel sec="finance">30-day cashflow</SLabel>
            <span style={{ fontSize: 11, color: C.muted }}>
              net{" "}
              <span
                style={{
                  color: net >= 0 ? C.teal : C.coral,
                  fontWeight: 700,
                }}
              >
                {net >= 0 ? "+" : ""}
                {net.toLocaleString()} kr
              </span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <ComposedChart
              data={trend}
              margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="netPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.teal} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={C.teal} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: C.muted }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={{ stroke: C.divider }}
              />
              <YAxis
                tick={{ fontSize: 9, fill: C.muted }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v) =>
                  typeof v === "number" && Math.abs(v) >= 1000
                    ? `${Math.round(v / 1000)}k`
                    : `${v}`
                }
              />
              <Tooltip
                cursor={{ stroke: C.divider }}
                contentStyle={{
                  borderRadius: 8,
                  border: `1px solid ${C.divider}`,
                  fontSize: 12,
                  padding: "4px 8px",
                }}
                formatter={(v) =>
                  typeof v === "number" ? `${v.toLocaleString()} kr` : `${v}`
                }
              />
              <Area
                type="monotone"
                dataKey="net"
                stroke={C.teal}
                strokeWidth={2}
                fill="url(#netPos)"
                isAnimationActive={false}
                name="Cumulative net"
              />
              <Line
                type="monotone"
                dataKey="expense"
                stroke={C.coral}
                strokeWidth={1.2}
                dot={false}
                isAnimationActive={false}
                name="Daily spend"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card sec="finance">
        <SLabel sec="finance">Expense breakdown</SLabel>
        {monthExpense === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: C.muted,
              padding: "12px 0",
              fontSize: 13,
            }}
          >
            No expenses this month
          </div>
        ) : (
          EXPENSE_CATS.map((c, i) => {
            const total = monthTx
              .filter((t) => t.type === "expense" && t.category === c)
              .reduce((s, t) => s + t.amount, 0);
            if (!total) return null;
            const pct = (total / monthExpense) * 100;
            return (
              <div key={c} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 5,
                  }}
                >
                  <span style={{ color: C.text }}>{c}</span>
                  <span
                    style={{ color: CAT_COLS[i], fontWeight: 600 }}
                  >
                    {total.toLocaleString()} kr
                  </span>
                </div>
                <BarFill value={pct} color={CAT_COLS[i]} />
              </div>
            );
          })
        )}
      </Card>

      {show ? (
        <Card>
          <SLabel>Log transaction</SLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {(["expense", "income"] as TransactionType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTxType(t);
                  setCat(t === "income" ? INCOME_CATS[0] : EXPENSE_CATS[0]);
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  background:
                    txType === t
                      ? t === "income"
                        ? C.teal
                        : C.coral
                      : C.dim,
                  color: txType === t ? "#fff" : C.muted,
                }}
              >
                {t === "income" ? "Income" : "Expense"}
              </button>
            ))}
          </div>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            style={inputStyle}
          >
            {(txType === "income" ? INCOME_CATS : EXPENSE_CATS).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (kr)"
            type="number"
            style={inputStyle}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={submit}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 12,
                border: "none",
                background: txType === "income" ? C.teal : C.coral,
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Log
            </button>
            <button
              onClick={() => setShow(false)}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 12,
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
        </Card>
      ) : (
        <button
          onClick={() => setShow(true)}
          style={{
            padding: "13px",
            borderRadius: 14,
            border: "none",
            background: C.navy,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 14,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Log transaction
        </button>
      )}

      <Card sec="finance">
        <SLabel sec="finance">Recent transactions</SLabel>
        {transactions.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: C.muted,
              padding: "12px 0",
              fontSize: 13,
            }}
          >
            No transactions yet
          </div>
        ) : (
          transactions.slice(0, 6).map((t, i, arr) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 0",
                borderBottom:
                  i < arr.length - 1 ? `1px solid ${C.divider}` : "none",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: t.type === "income" ? C.teal : C.coral,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                  boxShadow: `0 2px 8px ${
                    t.type === "income" ? C.teal : C.coral
                  }40`,
                }}
              >
                {t.type === "income" ? "+" : "–"}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: C.navy }}
                >
                  {t.note || t.category}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {fmtDate(t.date)} · {t.category}
                </div>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: t.type === "income" ? C.teal : C.coral,
                  flexShrink: 0,
                }}
              >
                {t.type === "income" ? "+" : "–"}
                {t.amount.toLocaleString()} kr
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
