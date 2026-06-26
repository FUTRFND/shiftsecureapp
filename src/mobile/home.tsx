// Native mobile Home tab — greeting + 2x2 feature tiles.
// Plain React + Supabase only. No router, no UI libs.
import React, { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Card,
  Skeleton,
  gradient,
  palette,
  radii,
  shadow,
  space,
  type,
  pageStyle,
  usePullToRefresh,
} from "./ui";

type HomeTarget = "Alerts" | "Templates" | "Tasks" | "Voice";

type Profile = { full_name: string | null; department: string | null };

function greetingFor(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameOf(profile: Profile | null, fallback: string) {
  const full = (profile?.full_name ?? "").trim();
  if (full) return full.split(/\s+/)[0];
  // Email prefix fallback, prettified.
  const base = fallback.split("@")[0] ?? fallback;
  return base
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type TileKey = HomeTarget;

const TILES: Array<{
  key: TileKey;
  title: string;
  subtitle: string;
  icon: string;
  tint: string;
  tintSoft: string;
}> = [
  {
    key: "Alerts",
    title: "Critical Alerts",
    subtitle: "Real-time shift broadcasts",
    icon: "!",
    tint: palette.critical,
    tintSoft: palette.criticalSoft,
  },
  {
    key: "Templates",
    title: "Handoff Templates",
    subtitle: "SBAR & custom formats",
    icon: "▤",
    tint: palette.info,
    tintSoft: palette.infoSoft,
  },
  {
    key: "Tasks",
    title: "Tasks",
    subtitle: "Pending & in-progress",
    icon: "✓",
    tint: palette.accentDeep,
    tintSoft: palette.accentSoft,
  },
  {
    key: "Voice",
    title: "Voice Summary",
    subtitle: "Dictate & summarize",
    icon: "●",
    tint: palette.warning,
    tintSoft: palette.warningSoft,
  },
];

function Tile({
  title,
  subtitle,
  icon,
  tint,
  tintSoft,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: string;
  tint: string;
  tintSoft: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mobile-tap"
      style={{
        textAlign: "left",
        padding: space.lg,
        background: palette.surface,
        border: `1px solid ${palette.hairline}`,
        borderRadius: radii.xxl,
        boxShadow: shadow.card,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 150,
        cursor: "pointer",
        fontFamily: "inherit",
        WebkitAppearance: "none",
        touchAction: "manipulation",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: tintSoft,
          color: tint,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {icon}
      </span>
      <div
        style={{
          fontSize: type.headline,
          fontWeight: 700,
          color: palette.ink,
          letterSpacing: -0.2,
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: type.footnote,
          color: palette.muted,
          lineHeight: 1.35,
          marginTop: "auto",
        }}
      >
        {subtitle}
      </div>
    </button>
  );
}

export function HomeScreen({
  sb,
  userId,
  email,
  onNavigate,
}: {
  sb: SupabaseClient;
  userId: string;
  email: string;
  onNavigate: (t: HomeTarget) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowStr, setNowStr] = useState(() => greetingFor(new Date()));

  const load = React.useCallback(async () => {
    setNowStr(greetingFor(new Date()));
    const [p, r] = await Promise.all([
      sb
        .from("profiles")
        .select("full_name, department")
        .eq("id", userId)
        .maybeSingle(),
      sb
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (p.error) console.error("[home] profile load failed", p.error);
    if (r.error) console.error("[home] role load failed", r.error);
    setProfile((p.data as Profile) ?? null);
    setRole((r.data as { role?: string } | null)?.role ?? null);
    setLoading(false);
  }, [sb, userId]);

  useEffect(() => {
    let alive = true;
    load().catch((e) => {
      if (!alive) return;
      console.error("[home] load failed", e);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const { refreshing, indicator } = usePullToRefresh(load);

  const firstName = firstNameOf(profile, email);
  const roleLine =
    [role, profile?.department].filter(Boolean).join(" · ") ||
    "Shift Secure team";

  return (
    <main style={pageStyle}>
      {indicator}

      {/* Greeting card with subtle brand gradient accent */}
      <section
        style={{
          marginTop: 4,
          marginBottom: space.lg,
          padding: `${space.xl}px ${space.lg}px`,
          borderRadius: radii.xxl,
          background: gradient.primary,
          color: "#ffffff",
          boxShadow: shadow.primary,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative blob */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -40,
            top: -40,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.16)",
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          {nowStr}
        </p>
        <h1
          style={{
            margin: "6px 0 0",
            fontSize: type.largeTitle,
            fontWeight: 800,
            letterSpacing: -0.8,
            lineHeight: 1.05,
          }}
        >
          {loading ? (
            <Skeleton width={180} height={28} style={{ background: "rgba(255,255,255,0.25)" }} />
          ) : (
            firstName
          )}
        </h1>
        <div
          style={{
            margin: "8px 0 0",
            fontSize: type.callout,
            opacity: 0.95,
            fontWeight: 500,
          }}
        >
          {loading ? (
            <Skeleton width={140} height={14} style={{ background: "rgba(255,255,255,0.25)" }} />
          ) : (
            roleLine
          )}
        </div>
      </section>

      {/* 2x2 tile grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: space.md,
        }}
      >
        {TILES.map((t) => (
          <Tile
            key={t.key}
            title={t.title}
            subtitle={t.subtitle}
            icon={t.icon}
            tint={t.tint}
            tintSoft={t.tintSoft}
            onClick={() => onNavigate(t.key)}
          />
        ))}
      </div>

      {refreshing && (
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: palette.subtle,
            marginTop: space.lg,
          }}
        >
          Refreshing…
        </p>
      )}

      <Card style={{ marginTop: space.lg, background: palette.surfaceAlt }}>
        <div style={{ fontSize: type.footnote, color: palette.muted, lineHeight: 1.4 }}>
          Tip: pull down to refresh your profile and shift info.
        </div>
      </Card>
    </main>
  );
}
