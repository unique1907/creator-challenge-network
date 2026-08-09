import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const navigation = readFileSync("src/features/dashboard/components/brand-workspace-navigation.tsx", "utf8");
const dashboard = readFileSync("src/features/dashboard/components/brand-dashboard.tsx", "utf8");

assert.ok(navigation.includes("function notificationStorageKey(accountKey: string)"), "Notification read-state storage must be scoped by Brand account key.");
assert.ok(navigation.includes("return `${NOTIFICATION_READ_STORAGE_KEY}:${scope}`;"), "Notification read-state storage key must include account scope.");
assert.ok(navigation.includes("hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;"), "Notification account scope must avoid storing raw private account data.");
assert.ok(navigation.includes("filter((item) => !visibleIds || visibleIds.has(item))"), "Read receipts must ignore IDs that no longer exist.");
assert.ok(navigation.includes("writeStoredNotificationIds(accountKey, next)"), "Notification read-state must persist to localStorage.");
assert.ok(navigation.includes("window.dispatchEvent(new Event(NOTIFICATION_READ_STORAGE_EVENT))"), "Notification read-state must update the badge immediately.");
assert.ok(navigation.includes("function markVisibleUnreadNotificationsRead()"), "Opening the panel must mark visible unread notifications read.");
assert.ok(navigation.includes("item.unread && !readNotificationIds.has(item.id)"), "Unread count must derive from notification event unread flag minus persisted read ids.");
assert.ok(navigation.includes("if (!open) markVisibleUnreadNotificationsRead();"), "Unread notifications must be marked read when opening, not merely rendering.");
assert.ok(navigation.includes('unread ? "Unread" : "Read"'), "Every notification row must explicitly render Unread or Read.");
assert.ok(navigation.includes("bg-red-500 px-1 text-[10px] font-semibold text-white"), "Unread badge must use compact red alert styling with white text.");
assert.ok(!navigation.includes("bg-violet-500 px-1"), "Unread-zero state must not fall back to a purple numeric badge.");
assert.ok(navigation.includes("? \"border-red-400/45 hover:border-red-300/70\""), "Bell control must use a subtle red alert border when unread exists.");
assert.ok(navigation.includes("unreadCount ? (") && navigation.includes(") : null}"), "Badge must be hidden when unread count is zero.");
assert.ok(navigation.includes("border-red-300/20 bg-red-500/[0.055]"), "Unread rows must have stronger red visual emphasis.");
assert.ok(navigation.includes("border-white/5 bg-white/[0.02]"), "Read rows must have muted visual styling.");
assert.ok(navigation.includes("{item.statusLabel}"), "Needs Action must remain separate from Read/Unread state.");
assert.ok(navigation.includes("All caught up"), "Action Center should show a compact caught-up summary after read.");
assert.ok(navigation.includes("markNotificationRead(item.id)"), "Clicking an individual notification must still mark it read.");
assert.ok(dashboard.includes("<BrandAccountControls"), "Dashboard must render notifications through the shared Brand account controls.");
assert.ok(navigation.includes("accountKey={email ?? profileName}"), "Brand notifications must receive authenticated Brand account scope.");

console.log("P0 Brand Dashboard notification read-state verifier passed.");
