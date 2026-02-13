"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { COUNTRY_PATHS } from "./world-map-paths";

interface CountryData {
  code: string;
  name: string;
  pageviews: number;
  uniqueVisitors: number;
}

interface WorldMapProps {
  countries: CountryData[];
}

export function WorldMap({ countries }: WorldMapProps) {
  const [hovered, setHovered] = useState<CountryData | null>(null);

  const countryMap = useMemo(() => {
    const map = new Map<string, CountryData>();
    for (const c of countries) {
      map.set(c.code, c);
    }
    return map;
  }, [countries]);

  const maxViews = useMemo(
    () => Math.max(...countries.map((c) => c.pageviews), 1),
    [countries]
  );

  function getColor(code: string): string {
    const data = countryMap.get(code);
    if (!data) return "rgba(0,0,0,0.04)";
    // Logarithmic scale to prevent one dominant country from washing out others
    const intensity = Math.log(data.pageviews + 1) / Math.log(maxViews + 1);
    const alpha = 0.15 + intensity * 0.7; // range 0.15 to 0.85
    return `rgba(220, 103, 67, ${alpha.toFixed(2)})`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative"
    >
      {/* Tooltip — fixed top-right */}
      {hovered && (
        <div
          className="absolute top-2 right-2 z-10 px-3 py-2 rounded-lg text-xs pointer-events-none"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
          }}
        >
          <div className="font-medium mb-0.5">{hovered.name}</div>
          <div style={{ opacity: 0.7 }}>
            {hovered.pageviews} views &middot; {hovered.uniqueVisitors} unique
          </div>
        </div>
      )}

      <svg
        viewBox="0 0 1010 665"
        className="w-full"
        style={{ maxHeight: 320 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {Object.entries(COUNTRY_PATHS).map(([code, d]) => {
          const data = countryMap.get(code);
          return (
            <path
              key={code}
              d={d}
              fill={getColor(code)}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={0.5}
              className="transition-[filter] duration-150"
              style={{
                cursor: data ? "pointer" : "default",
                filter: hovered?.code === code ? "brightness(1.2)" : "none",
              }}
              onMouseEnter={() => data && setHovered(data)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </svg>
    </motion.div>
  );
}
