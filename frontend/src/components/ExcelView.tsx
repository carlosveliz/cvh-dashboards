import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import type { ExcelData } from "../api/types";
import { FullSpinner } from "./ui";

const CHART_COLORS = ["#8b8ef0", "#5fc9b0", "#f0a3b8", "#f3c969", "#9bb5f0"];

export function ExcelView({ dashboardId }: { dashboardId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["excel", dashboardId],
    queryFn: async () =>
      (await api.get<ExcelData>(`/api/dashboards/${dashboardId}/data`)).data,
  });
  const [active, setActive] = useState(0);

  if (isLoading) return <FullSpinner />;
  if (error || !data)
    return <p className="p-8 text-center text-danger">No se pudo cargar el Excel.</p>;
  if (data.sheets.length === 0)
    return <p className="p-8 text-center text-muted-fg">El archivo no tiene hojas.</p>;

  const sheet = data.sheets[Math.min(active, data.sheets.length - 1)];

  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      {data.sheets.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {data.sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActive(i)}
              className={`badge px-3 py-1.5 ${
                i === active ? "bg-primary text-primary-fg" : "bg-muted text-muted-fg"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {sheet.chart && (
        <div className="card mb-6 p-5">
          <h3 className="mb-4 font-medium text-fg">Resumen</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sheet.chart.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 18% 92%)" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {sheet.chart.series.map((s, i) => (
                  <Bar
                    key={s}
                    dataKey={s}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {sheet.columns.map((c) => (
                  <th
                    key={c}
                    className="whitespace-nowrap px-4 py-3 text-left font-semibold text-fg"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 ? "bg-bg" : "bg-surface"}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="whitespace-nowrap px-4 py-2.5 text-fg/90"
                    >
                      {cell === null ? "" : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
