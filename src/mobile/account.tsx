// Native Account tab — profile, plan, upgrade, billing.
// Plain React + Supabase + RevenueCat (via platformPayments adapter).
// No router, no UI libs, no shadcn/sonner/lucide.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  Banner,
  Card,
  Pill,
  ScreenHeader,
  SectionHeader,
  Spinner,
  ghostButton,
  inputStyle,
  labelStyle,
  pageStyle,
  palette,
  primaryButton,
  radii,
  shadow,
  space,
  useKeyboardScrollIntoView,
} from "./ui";
import {
  subscriptionService,
  type SubscriptionState,
} from "@/services/subscription";
import { isNative } from "@/platform/runtime";
import { PaymentsError, type SubscriptionPackage } from "@/platform/payments";
import { PRODUCT_IDS } from "@/config/subscription";

type Props = {
  sb: SupabaseClient;
  userId: string;
  email: string;
  onSignOut: () => Promise<void>;
};

type Profile = {
  full_name: string;
  department: string;
};

const FREE_HANDOFF_LIMIT = 10;
const FREE_VOICE_MINUTES = 5 * 60; // 5h/mo, shown in minutes (display only)

function formatExpiry(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function statusOf(state: SubscriptionState): {
  label: string;
  tone: "info" | "success" | "warning" | "neutral";
} {
  const ci = state.customerInfo;
  if (!state.ready) return { label: "Checking…", tone: "neutral" };
  if (ci.activeEntitlements.length === 0) return { label: "Free", tone: "neutral" };
  if (ci.inAccountHold) return { label: "On hold", tone: "warning" };
  if (ci.inGracePeriod) return { label: "Billing retry", tone: "warning" };
  if (ci.willRenew) return { label: "Active", tone: "success" };
  return { label: "Canceled (active until expiry)", tone: "warning" };
}

export function AccountScreen({ sb, userId, email, onSignOut }: Props) {
  useKeyboardScrollIntoView();

  // ---------- Profile ----------
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDept, setEditDept] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileErr(null);
    try {
      const [{ data: p, error: pErr }, { data: r }] = await Promise.all([
        sb
          .from("profiles")
          .select("full_name, department")
          .eq("id", userId)
          .maybeSingle(),
        sb.from("user_roles").select("role").eq("user_id", userId).limit(1),
      ]);
      if (pErr) throw pErr;
      const next: Profile = {
        full_name: (p?.full_name ?? "") as string,
        department: (p?.department ?? "") as string,
      };
      setProfile(next);
      setEditName(next.full_name);
      setEditDept(next.department);
      setRole(r && r.length > 0 ? (r[0] as { role: string }).role : null);
    } catch (err) {
      console.error("[account] load profile failed", err);
      setProfileErr(err instanceof Error ? err.message : "Couldn't load profile.");
    } finally {
      setProfileLoading(false);
    }
  }, [sb, userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const saveProfile = useCallback(async () => {
    setSavingProfile(true);
    setProfileErr(null);
    try {
      const { error } = await sb
        .from("profiles")
        .update({
          full_name: editName.trim(),
          department: editDept.trim(),
        })
        .eq("id", userId);
      if (error) throw error;
      setProfile({ full_name: editName.trim(), department: editDept.trim() });
      setEditing(false);
    } catch (err) {
      console.error("[account] save profile failed", err);
      setProfileErr(err instanceof Error ? err.message : "Couldn't save profile.");
    } finally {
      setSavingProfile(false);
    }
  }, [editDept, editName, sb, userId]);

  // ---------- Subscription state ----------
  const [subState, setSubState] = useState<SubscriptionState>(
    subscriptionService.getState(),
  );
  const [offerings, setOfferings] = useState<SubscriptionPackage[] | null>(null);
  const [offeringsErr, setOfferingsErr] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    null | "purchase" | "restore" | "manage"
  >(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  useEffect(() => {
    // Idempotent boot — safe to call repeatedly.
    void subscriptionService.init(userId);
    const unsub = subscriptionService.subscribe(setSubState);
    return () => unsub();
  }, [userId]);

  const loadOfferings = useCallback(async () => {
    setOfferingsErr(null);
    try {
      const pkgs = await subscriptionService.getOfferings();
      setOfferings(pkgs);
    } catch (err) {
      console.error("[account] offerings failed", err);
      setOfferingsErr(
        err instanceof Error ? err.message : "Couldn't load plans.",
      );
      setOfferings([]);
    }
  }, []);

  useEffect(() => {
    if (isNative()) void loadOfferings();
    else setOfferings([]);
  }, [loadOfferings]);

  // ---------- Usage ----------
  const [handoffCount, setHandoffCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { count, error } = await sb
          .from("handoff_drafts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        if (error) throw error;
        if (!cancelled) setHandoffCount(count ?? 0);
      } catch (err) {
        console.warn("[account] handoff count failed", err);
        if (!cancelled) setHandoffCount(null);
      }
    })();
    return () => {
      cancelled = false;
    };
  }, [sb, userId]);

  // ---------- Derived ----------
  const isPro = subState.customerInfo.activeEntitlements.length > 0;
  const status = statusOf(subState);
  const expiry = formatExpiry(subState.customerInfo.expirationDate);
  const monthlyPkg = useMemo(
    () =>
      (offerings ?? []).find((p) => p.period === "monthly") ??
      (offerings ?? [])[0] ??
      null,
    [offerings],
  );

  // ---------- Actions ----------
  const onPurchase = useCallback(async () => {
    if (!isNative()) {
      setActionErr(
        "Subscriptions are managed inside the iOS or Android app. Open Shift Secure on your device to upgrade.",
      );
      return;
    }
    if (!monthlyPkg) {
      setActionErr("No plan is available right now. Please try again later.");
      return;
    }
    setBusyAction("purchase");
    setActionErr(null);
    setActionOk(null);
    try {
      await subscriptionService.purchase(monthlyPkg.identifier);
      setActionOk("Welcome to Team! Your plan is now active.");
    } catch (err) {
      if (err instanceof PaymentsError && err.code === "cancelled") {
        // Silent — user cancelled.
      } else {
        console.error("[account] purchase failed", err);
        setActionErr(
          err instanceof Error ? err.message : "Purchase failed. Please try again.",
        );
      }
    } finally {
      setBusyAction(null);
    }
  }, [monthlyPkg]);

  const onRestore = useCallback(async () => {
    if (!isNative()) {
      setActionErr(
        "Restore is available inside the iOS or Android app.",
      );
      return;
    }
    setBusyAction("restore");
    setActionErr(null);
    setActionOk(null);
    try {
      const next = await subscriptionService.restore();
      setActionOk(
        next.customerInfo.activeEntitlements.length > 0
          ? "Purchases restored."
          : "No previous purchases were found for this Apple ID.",
      );
    } catch (err) {
      console.error("[account] restore failed", err);
      setActionErr(
        err instanceof Error ? err.message : "Restore failed. Please try again.",
      );
    } finally {
      setBusyAction(null);
    }
  }, []);

  const onManage = useCallback(() => {
    // Apple requires subscription management in App Store settings.
    setBusyAction("manage");
    setActionErr(null);
    setActionOk(null);
    try {
      // Universal manage-subscriptions URL.
      const url = "https://apps.apple.com/account/subscriptions";
      window.open(url, "_blank", "noopener,noreferrer");
      setActionOk(
        "Opening App Store subscription settings. If it didn't open, manage your plan from Settings → Apple ID → Subscriptions.",
      );
    } catch (err) {
      console.error("[account] manage failed", err);
      setActionErr("Couldn't open the App Store. Manage your plan from Settings → Apple ID → Subscriptions.");
    } finally {
      setBusyAction(null);
    }
  }, []);

  const [signingOut, setSigningOut] = useState(false);
  const [signOutErr, setSignOutErr] = useState<string | null>(null);

  const onSignOutPressed = useCallback(async () => {
    console.log("[account] sign out clicked");
    setSigningOut(true);
    setSignOutErr(null);
    try {
      await onSignOut();
      console.log("[logout] Account sign out flow returned");
    } catch (error) {
      console.error("[account] sign out failed", error);
      setSignOutErr(
        error instanceof Error ? error.message : "Failed to sign out. Please try again.",
      );
    } finally {
      setSigningOut(false);
      try {
        setProfile(null);
        setRole(null);
        setHandoffCount(null);
      } catch {}
    }
  }, [onSignOut]);

  // ---------- Render ----------
  return (
    <main style={pageStyle}>
      <ScreenHeader title="Account" subtitle="Profile, plan, and billing" />
      <div
        aria-label="Auth debug"
        style={{
          margin: `-${space.xs}px 0 ${space.md}px`,
          padding: "8px 10px",
          borderRadius: radii.md,
          background: palette.bgAlt,
          border: `1px solid ${palette.hairline}`,
          color: palette.subtle,
          fontSize: 11,
          lineHeight: 1.4,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        }}
      >
        <div>signedIn: {authDebug.signedIn ? "true" : "false"}</div>
        <div>session present: {authDebug.session ? "yes" : "no"}</div>
        <div>user id: {authDebug.userId ?? "none"}</div>
        <div>current auth event: {authDebug.currentAuthEvent}</div>
        <div>last logout step reached: {authDebug.lastLogoutStep}</div>
        <div>auth root state: {authDebug.rootState}</div>
      </div>

      {/* Profile */}
      <SectionHeader title="Profile" />
      <Card>
        {profileLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Spinner size={16} /> <span style={{ color: palette.muted }}>Loading…</span>
          </div>
        ) : editing ? (
          <div>
            <label style={labelStyle} htmlFor="acc-name">Full name</label>
            <input
              id="acc-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoCapitalize="words"
              autoCorrect="off"
              style={inputStyle}
            />
            <label style={labelStyle} htmlFor="acc-dept">Department / unit</label>
            <input
              id="acc-dept"
              value={editDept}
              onChange={(e) => setEditDept(e.target.value)}
              autoCapitalize="words"
              style={{ ...inputStyle, marginBottom: space.md }}
            />
            {profileErr && <Banner tone="error">{profileErr}</Banner>}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="mobile-tap"
                onClick={() => {
                  setEditing(false);
                  setEditName(profile?.full_name ?? "");
                  setEditDept(profile?.department ?? "");
                  setProfileErr(null);
                }}
                style={{ ...ghostButton, flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mobile-tap"
                disabled={savingProfile}
                onClick={saveProfile}
                style={{ ...primaryButton, flex: 1 }}
              >
                {savingProfile ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <Row label="Name" value={profile?.full_name || "—"} />
            <Row label="Email" value={email} />
            <Row label="Role" value={role ? prettyRole(role) : "—"} />
            <Row label="Department" value={profile?.department || "—"} last />
            {profileErr && <Banner tone="error">{profileErr}</Banner>}
            {signOutErr && <Banner tone="error">{signOutErr}</Banner>}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="mobile-tap"
                onClick={() => setEditing(true)}
                style={{ ...ghostButton, flex: 1 }}
              >
                Edit profile
              </button>
              <button
                type="button"
                className="mobile-tap"
                onClick={onSignOutPressed}
                disabled={signingOut}
                style={{
                  ...ghostButton,
                  flex: 1,
                  color: palette.critical,
                  borderColor: palette.hairline,
                  opacity: signingOut ? 0.6 : 1,
                }}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </>
        )}
      </Card>

      {/* Current plan */}
      <SectionHeader title="Current plan" />
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: palette.ink }}>
              {isPro ? "Team" : "Resident · Free"}
            </div>
            <div style={{ fontSize: 13, color: palette.muted, marginTop: 2 }}>
              {isPro
                ? expiry
                  ? subState.customerInfo.willRenew
                    ? `Renews ${expiry}`
                    : `Access until ${expiry}`
                  : "Active subscription"
                : "Forever for individuals"}
            </div>
          </div>
          <Pill
            tone={
              status.tone === "success"
                ? "success"
                : status.tone === "warning"
                  ? "warning"
                  : status.tone === "info"
                    ? "info"
                    : "neutral"
            }
          >
            {status.label}
          </Pill>
        </div>

        {subState.stale && (
          <Banner tone="warning">
            Showing last known plan — couldn't reach the store. We'll refresh automatically.
          </Banner>
        )}

        <div style={{ height: 1, background: palette.hairline, margin: "10px 0 12px" }} />

        <UsageRow
          label="Handoffs"
          used={handoffCount}
          limit={isPro ? null : FREE_HANDOFF_LIMIT}
          unit=""
        />
        <UsageRow
          label="Voice-to-text"
          used={null}
          limit={isPro ? null : FREE_VOICE_MINUTES}
          unit="min / mo"
          note={isPro ? "Unlimited" : "5 h / month on Free"}
        />
        <FeatureRow label="Shared templates & tasks" unlocked={isPro} />
        <FeatureRow label="Critical SMS alerts" unlocked={isPro} />
        <FeatureRow label="Audit trail" unlocked={isPro} last />
      </Card>

      {/* Plan comparison */}
      {!isPro && (
        <>
          <SectionHeader title="Upgrade" />
          <PlanCard
            name="Resident"
            price="Free"
            cadence="forever"
            tag="Current plan"
            features={[
              "Up to 10 active handoffs",
              "Voice-to-text 5 h / month",
              "Personal templates",
            ]}
            current
          />
          <div style={{ height: 12 }} />
          <PlanCard
            name="Team"
            price={monthlyPkg?.priceString || "$24"}
            cadence={
              monthlyPkg?.period === "annual" ? "per user / year" : "per user / month"
            }
            tag="14-day free trial"
            features={[
              "Unlimited handoffs",
              "Shared templates & tasks",
              "Critical alerts (SMS + in-app)",
              "Audit trail",
            ]}
            highlighted
          />
        </>
      )}

      {/* Billing actions */}
      <SectionHeader title="Billing" />
      <Card>
        {actionErr && <Banner tone="error">{actionErr}</Banner>}
        {actionOk && <Banner tone="success">{actionOk}</Banner>}
        {offeringsErr && <Banner tone="warning">{offeringsErr}</Banner>}
        {!isNative() && (
          <Banner tone="info">
            Subscriptions are managed inside the iOS or Android app. Open Shift Secure on your device to upgrade or restore.
          </Banner>
        )}

        {isPro ? (
          <button
            type="button"
            className="mobile-tap"
            disabled={busyAction !== null}
            onClick={onManage}
            style={{ ...primaryButton, width: "100%", marginTop: 4 }}
          >
            {busyAction === "manage" ? "Opening…" : "Manage subscription"}
          </button>
        ) : (
          <button
            type="button"
            className="mobile-tap"
            disabled={busyAction !== null || (isNative() && offerings === null)}
            onClick={onPurchase}
            style={{ ...primaryButton, width: "100%", marginTop: 4 }}
          >
            {busyAction === "purchase"
              ? "Starting…"
              : monthlyPkg
                ? `Start 14-day trial · ${monthlyPkg.priceString || "Team"}`
                : isNative()
                  ? "Upgrade to Team"
                  : "Upgrade in the app"}
          </button>
        )}

        <button
          type="button"
          className="mobile-tap"
          disabled={busyAction !== null}
          onClick={onRestore}
          style={{ ...ghostButton, width: "100%", marginTop: 10 }}
        >
          {busyAction === "restore" ? "Restoring…" : "Restore purchases"}
        </button>

        <p
          style={{
            margin: `${space.md}px 0 0`,
            fontSize: 11,
            color: palette.subtle,
            lineHeight: 1.4,
            textAlign: "center",
          }}
        >
          Payment will be charged to your Apple ID after the 14-day trial. Cancel anytime from Settings → Apple ID → Subscriptions.
        </p>
      </Card>

      <div style={{ height: 18 }} />
    </main>
  );
}

// ---------- Small subcomponents ----------

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "10px 0",
        borderBottom: last ? "none" : `1px solid ${palette.hairline}`,
      }}
    >
      <span style={{ fontSize: 13, color: palette.muted }}>{label}</span>
      <span
        style={{
          fontSize: 14,
          color: palette.ink,
          fontWeight: 600,
          textAlign: "right",
          maxWidth: "65%",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function UsageRow({
  label,
  used,
  limit,
  unit,
  note,
}: {
  label: string;
  used: number | null;
  limit: number | null;
  unit: string;
  note?: string;
}) {
  const text = (() => {
    if (limit === null) return "Unlimited";
    if (used === null) return note ?? `0 / ${limit} ${unit}`.trim();
    return `${used} / ${limit}${unit ? " " + unit : ""}`;
  })();
  const pct =
    limit && used !== null ? Math.min(100, Math.round((used / limit) * 100)) : null;
  const over = limit !== null && used !== null && used >= limit;
  return (
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 13, color: palette.muted }}>{label}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: over ? palette.critical : palette.ink,
          }}
        >
          {text}
        </span>
      </div>
      {pct !== null && (
        <div
          style={{
            height: 6,
            background: palette.hairline,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: over ? palette.critical : palette.accent,
              transition: "width 240ms ease",
            }}
          />
        </div>
      )}
    </div>
  );
}

function FeatureRow({
  label,
  unlocked,
  last,
}: {
  label: string;
  unlocked: boolean;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: last ? "none" : `1px solid ${palette.hairline}`,
      }}
    >
      <span style={{ fontSize: 14, color: palette.ink }}>{label}</span>
      {unlocked ? (
        <Pill tone="success">Unlocked</Pill>
      ) : (
        <Pill tone="neutral">Team feature</Pill>
      )}
    </div>
  );
}

function PlanCard({
  name,
  price,
  cadence,
  tag,
  features,
  highlighted,
  current,
}: {
  name: string;
  price: string;
  cadence: string;
  tag?: string;
  features: string[];
  highlighted?: boolean;
  current?: boolean;
}) {
  return (
    <div
      style={{
        background: highlighted ? palette.accentSoft : palette.surface,
        border: `1px solid ${highlighted ? palette.accent : palette.hairline}`,
        borderRadius: radii.lg,
        padding: 16,
        boxShadow: highlighted ? shadow.primary : shadow.card,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color: palette.ink }}>{name}</div>
        {(tag || current) && (
          <Pill tone={current ? "neutral" : "success"}>{current ? "Current plan" : tag}</Pill>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: palette.ink, letterSpacing: -0.5 }}>
          {price}
        </span>
        <span style={{ fontSize: 12, color: palette.muted }}>{cadence}</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {features.map((f) => (
          <li
            key={f}
            style={{
              fontSize: 13,
              color: palette.ink,
              padding: "6px 0",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <span
              aria-hidden
              style={{
                color: highlighted ? palette.accentDeep : palette.muted,
                fontWeight: 700,
              }}
            >
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function prettyRole(r: string) {
  return r.charAt(0).toUpperCase() + r.slice(1);
}
