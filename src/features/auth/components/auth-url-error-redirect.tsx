"use client";

import { useEffect } from "react";

function authErrorParams(params: URLSearchParams) {
  const error = params.get("error");
  const errorCode = params.get("error_code");
  if (!error && !errorCode) return null;
  if (errorCode === "otp_expired") return "callback_expired";
  if (error === "access_denied") return "callback";
  return null;
}

export function AuthUrlErrorRedirect() {
  useEffect(() => {
    const searchError = authErrorParams(new URLSearchParams(window.location.search));
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const hashError = authErrorParams(new URLSearchParams(hash));
    const error = searchError ?? hashError;
    if (!error) return;
    window.location.replace(`/auth/sign-in?error=${encodeURIComponent(error)}`);
  }, []);

  return null;
}
