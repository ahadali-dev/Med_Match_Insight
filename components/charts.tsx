"use client";

import { memo, useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { PIPELINE_STAGES } from "@/lib/types";
import type { Dashboard } from "@/lib/metrics";

const INK = "#15201b";
const AMBER = "#9a5b00";
const ACCENT = "#1a6b4a";
const TRACK = "#eef2f0";

// Light to dark. `text` is the label colour that keeps 4.5:1 on that segment.
export const STAGE_STYLES = [
  { fill: "#b9ccc3", text: INK },
  { fill: "#86a99a", text: INK },
  { fill: "#3f7a64", text: "#ffffff" },
  { fill: ACCENT, text: "#ffffff" },
  { fill: "#0e3b2a", text: "#ffffff" },
] as const;

/** Where the days go: average days per credentialing step. */
export const DaysChart = memo(function DaysChart({ steps }: { steps: Dashboard["stepAverages"] }) {
  const measured = steps.filter((s) => s.avgDays !== null);
  const longest = measured.length ? Math.max(...measured.map((s) => s.avgDays as number)) : 0;
  const data = steps.map((s) => ({ label: s.label, days: s.avgDays ?? 0, known: s.avgDays !== null, longest: s.avgDays === longest && longest > 0 }));

  return (
    <>
      <div aria-hidden="true" className="h-[196px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 420, height: 196 }}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 0 }} accessibilityLayer={false} barCategoryGap={14}>
            <XAxis type="number" hide domain={[0, Math.max(longest, 1)]} />
            <YAxis
              type="category"
              dataKey="label"
              width={132}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 14, fill: INK }}
              interval={0}
            />
            <Bar dataKey="days" barSize={16} radius={3} isAnimationActive={false} background={{ fill: TRACK, radius: 3 }}>
              {data.map((d) => (
                <Cell key={d.label} fill={d.longest ? AMBER : ACCENT} />
              ))}
              <LabelList
                dataKey="days"
                position="right"
                content={(props) => {
                  const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number };
                  const d = data[index];
                  return (
                    <text x={Number(x) + Number(width) + 8} y={Number(y) + Number(height) / 2} dominantBaseline="central" fontSize={14} fontWeight={600} fill={INK} style={{ fontFamily: "var(--font-plex-mono), monospace" }}>
                      {d.known ? d.days : "–"}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
<table>
        <caption>Average days per credentialing step</caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Average days</th>
            <th scope="col">Finished steps counted</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.step}>
              <th scope="row">{s.label}</th>
              <td>{s.avgDays ?? "no data"}</td>
              <td>{s.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
</div>
    </>
  );
});

interface PipelineDatum {
  key: string;
  title: string;
  sub: string;
  stalled: boolean;
  total: number;
  [stage: string]: string | number | boolean;
}

/** Recruiting pipeline: one stacked bar per open role. */
export const PipelineChart = memo(function PipelineChart({ roles }: { roles: Dashboard["roles"] }) {
  const [compact, setCompact] = useState(false);

  const data: PipelineDatum[] = roles.map((r, i) => {
    const row: PipelineDatum = {
      key: `${i}`,
      title: r.role.title,
      sub: `${r.role.location} · open ${r.openDays} days`,
      stalled: r.stalled,
      total: r.total,
    };
    PIPELINE_STAGES.forEach((stage, si) => {
      row[stage] = r.role.stages[si];
    });
    return row;
  });
  const totals = new Map(data.map((d) => [d.key, d.total]));
  const rowHeight = 54;
  const height = Math.max(120, data.length * rowHeight + 8);
  const axisWidth = compact ? 112 : 200;

  return (
    <>
      <div aria-hidden="true" style={{ height }}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 640, height }}
          onResize={(w) => setCompact(w < 520)}
        >
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 0 }} accessibilityLayer={false} barCategoryGap={12}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="key"
              width={axisWidth}
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={(props) => {
                const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
                const d = data.find((r) => r.key === payload.value);
                if (!d) return <g />;
                return (
                  <g transform={`translate(${Number(x)},${Number(y)})`}>
                    <text x={-8} y={compact ? -2 : -7} textAnchor="end" fontSize={compact ? 13 : 14} fontWeight={600} fill={INK}>
                      {compact && d.title.length > 14 ? `${d.title.slice(0, 13)}…` : d.title.length > 26 ? `${d.title.slice(0, 25)}…` : d.title}
                    </text>
                    <text x={-8} y={compact ? 12 : 11} textAnchor="end" fontSize={12} fill={d.stalled ? "#b42318" : "#4a5a53"} fontWeight={d.stalled ? 600 : 400}>
                      {compact ? `open ${d.sub.split("open ")[1]}` : d.sub}
                    </text>
                  </g>
                );
              }}
            />
            <YAxis
              yAxisId="total"
              orientation="right"
              type="category"
              dataKey="key"
              width={32}
              tickLine={false}
              axisLine={false}
              interval={0}
              tickFormatter={(k: string) => String(totals.get(k) ?? "")}
              tick={{ fontSize: 14, fontWeight: 600, fill: INK, style: { fontFamily: "var(--font-plex-mono), monospace" } }}
            />
            {PIPELINE_STAGES.map((stage, i) => (
              <Bar key={stage} dataKey={stage} stackId="pipeline" fill={STAGE_STYLES[i].fill} stroke="#ffffff" strokeWidth={1.5} barSize={22} isAnimationActive={false}>
                <LabelList
                  dataKey={stage}
                  content={(props) => {
                    const { x, y, width, height: h, value } = props as { x: number; y: number; width: number; height: number; value: number };
                    if (!value || Number(width) < 16) return null;
                    return (
                      <text x={Number(x) + Number(width) / 2} y={Number(y) + Number(h) / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill={STAGE_STYLES[i].text}>
                        {value}
                      </text>
                    );
                  }}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
<table>
        <caption>Candidates at each stage for every open role</caption>
        <thead>
          <tr>
            <th scope="col">Role</th>
            <th scope="col">Open for (days)</th>
            {PIPELINE_STAGES.map((s) => (
              <th key={s} scope="col">
                {s}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={`${r.role.title}-${r.role.location}`}>
              <th scope="row">
                {r.role.title}, {r.role.location}
              </th>
              <td>{r.openDays}</td>
              {r.role.stages.map((n, i) => (
                <td key={PIPELINE_STAGES[i]}>{n}</td>
              ))}
              <td>{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
</div>
    </>
  );
});

const WORKFORCE_SERIES = [
  { key: "Ready", fill: "#1a6b4a", text: "#ffffff" },
  { key: "In credentialing", fill: "#9a5b00", text: "#ffffff" },
  { key: "Onboarding", fill: "#b9ccc3", text: INK },
] as const;
export const WORKFORCE_COLORS = WORKFORCE_SERIES;

/** Providers by location, split by status. */
export const WorkforceChart = memo(function WorkforceChart({ rows }: { rows: Dashboard["workforce"] }) {
  const height = Math.max(120, rows.length * 56 + 8);
  return (
    <>
      <div aria-hidden="true" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 420, height }}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 0 }} accessibilityLayer={false} barCategoryGap={14}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="location" width={120} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 13, fill: INK }} />
            {WORKFORCE_SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} stackId="w" fill={s.fill} stroke="#ffffff" strokeWidth={1.5} barSize={24} isAnimationActive={false}>
                <LabelList
                  dataKey={s.key}
                  content={(props) => {
                    const { x, y, width, height: h, value } = props as { x: number; y: number; width: number; height: number; value: number };
                    if (!value || Number(width) < 16) return null;
                    return (
                      <text x={Number(x) + Number(width) / 2} y={Number(y) + Number(h) / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill={s.text}>
                        {value}
                      </text>
                    );
                  }}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
        <table>
          <caption>Providers by location and status</caption>
          <thead>
            <tr>
              <th scope="col">Location</th>
              {WORKFORCE_SERIES.map((s) => (
                <th key={s.key} scope="col">
                  {s.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.location}>
                <th scope="row">{r.location}</th>
                {WORKFORCE_SERIES.map((s) => (
                  <td key={s.key}>{r[s.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
});
