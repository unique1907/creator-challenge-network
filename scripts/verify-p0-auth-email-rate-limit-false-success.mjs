import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, expected, message) {
  assert.ok(source.includes(expected), `${message}: missing ${expected}`);
}

function excludes(source, forbidden, message) {
  assert.ok(!source.includes(forbidden), `${message}: found ${forbidden}`);
}

function assertBefore(source, first, second, message) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.ok(firstIndex >= 0, `${message}: missing first token ${first}`);
  assert.ok(secondIndex >= 0, `${message}: missing second token ${second}`);
  assert.ok(firstIndex < secondIndex, message);
}

function safeAuthEmailError(error) {
  const parts = [];
  if (error instanceof Error) {
    parts.push(error.name, error.message);
  } else {
    parts.push(String(error ?? ""));
  }
  if (error && typeof error === "object") {
    parts.push(String(error.code ?? ""), String(error.status ?? ""), String(error.error_code ?? ""));
  }
  const lower = parts.join(" ").toLowerCase();
  if (
    lower.includes("rate limit") ||
    lower.includes("too many") ||
    lower.includes("email rate limit") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("email_rate_limit_exceeded") ||
    lower.includes("429")
  ) {
    return "Please wait before requesting another email.";
  }
  return "Authentication could not be completed. Try again.";
}

function safeRecoveryEmailError(error) {
  const parts = [];
  if (error instanceof Error) {
    parts.push(error.name, error.message);
  } else {
    parts.push(String(error ?? ""));
  }
  if (error && typeof error === "object") {
    parts.push(String(error.code ?? ""), String(error.status ?? ""), String(error.error_code ?? ""));
  }
  const lower = parts.join(" ").toLowerCase();
  if (
    lower.includes("rate limit") ||
    lower.includes("too many") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("email_rate_limit_exceeded") ||
    lower.includes("429")
  ) {
    return "Please wait before requesting another reset email.";
  }
  return "Password reset could not be requested. Try again.";
}

const authActions = read("src/features/auth/components/auth-actions.tsx");
const forgotPassword = read("src/features/auth/components/forgot-password-form.tsx");

includes(authActions, "supabase.auth.signUp", "Signup confirmation email call must remain present");
includes(authActions, "const { data, error: signUpError } = await supabase.auth.signUp", "Signup must read Supabase signUp error");
assertBefore(
  authActions,
  "if (signUpError) throw signUpError;",
  "setStatus(`Confirm your email at ${maskEmail(normalizedEmail)}, then log in with your password.`);",
  "Signup success message must only appear after signUp reports no error",
);

includes(authActions, "supabase.auth.signInWithOtp", "Secondary email-link call must remain present");
includes(authActions, "const { error: signInError } = await supabase.auth.signInWithOtp", "Secondary email-link flow must read Supabase error");
assertBefore(
  authActions,
  "if (signInError) throw signInError;",
  "setStatus(`Email link sent to ${maskEmail(normalizedEmail)}.`);",
  "Secondary email-link success message must only appear after Supabase reports no error",
);

includes(forgotPassword, "supabase.auth.resetPasswordForEmail", "Recovery email call must remain present");
includes(forgotPassword, "const { error: resetError } = await supabase.auth.resetPasswordForEmail", "Recovery flow must read Supabase reset error");
assertBefore(
  forgotPassword,
  "if (resetError) throw resetError;",
  'setStatus("Password reset email sent. Open the link once, then set a new password.");',
  "Recovery success message must only appear after resetPasswordForEmail reports no error",
);

includes(authActions, "over_email_send_rate_limit", "Signup/auth email UI must recognize Supabase email send rate-limit code");
includes(authActions, "email_rate_limit_exceeded", "Signup/auth email UI must recognize alternate email rate-limit code");
includes(authActions, 'lower.includes("429")', "Signup/auth email UI must recognize HTTP 429 rate-limit responses");
includes(forgotPassword, "over_email_send_rate_limit", "Recovery UI must recognize Supabase email send rate-limit code");
includes(forgotPassword, "email_rate_limit_exceeded", "Recovery UI must recognize alternate email rate-limit code");
includes(forgotPassword, 'message.includes("429")', "Recovery UI must recognize HTTP 429 rate-limit responses");

excludes(authActions, "auth.resend", "No signup resend implementation should be added by this task");
excludes(forgotPassword, "auth.resend", "Recovery must not use signup resend");

assert.equal(
  safeAuthEmailError({ code: "over_email_send_rate_limit", status: 429 }),
  "Please wait before requesting another email.",
  "Signup/auth rate-limit code must map to safe error text",
);
assert.equal(
  safeAuthEmailError({ code: "email_rate_limit_exceeded", status: 429 }),
  "Please wait before requesting another email.",
  "Alternate signup/auth rate-limit code must map to safe error text",
);
assert.equal(
  safeRecoveryEmailError({ code: "over_email_send_rate_limit", status: 429 }),
  "Please wait before requesting another reset email.",
  "Recovery rate-limit code must map to safe reset error text",
);
assert.equal(
  safeRecoveryEmailError(new Error("Generic auth email send failure")),
  "Password reset could not be requested. Try again.",
  "Generic recovery send failures must not map to success",
);

console.log(JSON.stringify({
  result: "P0 auth email rate-limit false-success verifier passed",
  signupSuccessRequiresNoError: true,
  emailLinkSuccessRequiresNoError: true,
  recoverySuccessRequiresNoError: true,
  rateLimitShowsSafeError: true,
  realEmailSent: false,
}, null, 2));
