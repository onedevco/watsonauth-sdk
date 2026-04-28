// src/Logout.tsx
import { useState, useRef, useEffect } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function UserProfileDropdown({ userName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const handleLogout = async () => {
    setIsLoading(true);
    await logout();
  };
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
    setIsOpen(!isOpen);
  };
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "relative", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        ref: buttonRef,
        onClick: handleToggle,
        className: "flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800 transition-colors cursor-pointer",
        children: [
          /* @__PURE__ */ jsx(
            "svg",
            {
              className: "w-8 h-8 text-gray-300",
              fill: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" })
            }
          ),
          userName && /* @__PURE__ */ jsx("span", { className: "text-gray-300 text-sm", children: userName }),
          /* @__PURE__ */ jsx(
            "svg",
            {
              className: `w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`,
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
            }
          )
        ]
      }
    ),
    isOpen && /* @__PURE__ */ jsx(
      "div",
      {
        ref: dropdownRef,
        style: { top: dropdownPosition.top, right: dropdownPosition.right },
        className: "fixed w-48 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50",
        children: /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: handleLogout,
            disabled: isLoading,
            className: "w-full flex items-center gap-2 px-4 py-2 text-left text-gray-300 hover:bg-gray-700 rounded-md transition-colors cursor-pointer disabled:opacity-50",
            children: [
              /* @__PURE__ */ jsx(
                "svg",
                {
                  className: "w-4 h-4",
                  fill: "none",
                  stroke: "currentColor",
                  viewBox: "0 0 24 24",
                  children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" })
                }
              ),
              isLoading ? "Logging out..." : "Logout"
            ]
          }
        )
      }
    )
  ] });
}
async function logout() {
  await fetch("/api/logout", {
    method: "POST"
  });
  localStorage.removeItem("access_token");
  window.location.href = "/";
}

// src/useWatsonUser.ts
import { useEffect as useEffect2, useMemo, useState as useState2 } from "react";
function useWatsonUser(options = {}) {
  const { endpoint = "/api/me", auto = true } = options;
  const [user, setUser] = useState2(null);
  const [isLoading, setIsLoading] = useState2(false);
  const [error, setError] = useState2(null);
  const refresh = useMemo(() => {
    return async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(endpoint, {
          credentials: "include"
        });
        if (!response.ok) {
          setUser(null);
          return;
        }
        const data = await response.json();
        setUser(data.user ?? null);
      } catch (err) {
        setUser(null);
        setError(err instanceof Error ? err : new Error("Failed to load user"));
      } finally {
        setIsLoading(false);
      }
    };
  }, [endpoint]);
  useEffect2(() => {
    if (!auto) return;
    void refresh();
  }, [auto, refresh]);
  return { user, isLoading, error, refresh };
}

// src/debugPanel.tsx
import { useState as useState3, useEffect as useEffect3, useCallback } from "react";
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function readDebugCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/watson_auth_debug=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}
function useCountdown(expiresAt) {
  const [seconds, setSeconds] = useState3(null);
  useEffect3(() => {
    if (!expiresAt) {
      setSeconds(null);
      return;
    }
    const tick = () => setSeconds(Math.floor(expiresAt - Date.now() / 1e3));
    tick();
    const id = setInterval(tick, 1e3);
    return () => clearInterval(id);
  }, [expiresAt]);
  return seconds;
}
var ACTION_COLORS = {
  allow: { bg: "#0f3460", text: "#93c5fd" },
  refresh: { bg: "#14532d", text: "#86efac" },
  redirect: { bg: "#7f1d1d", text: "#fca5a5" }
};
function Badge({ action }) {
  const colors = ACTION_COLORS[action] ?? { bg: "#1e293b", text: "#94a3b8" };
  return /* @__PURE__ */ jsx2("span", { style: {
    display: "inline-block",
    padding: "1px 7px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 700,
    background: colors.bg,
    color: colors.text,
    letterSpacing: "0.03em"
  }, children: action });
}
function Row({ label, children }) {
  return /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "7px", gap: "16px" }, children: [
    /* @__PURE__ */ jsx2("span", { style: { color: "#64748b", fontSize: "11px", flexShrink: 0 }, children: label }),
    /* @__PURE__ */ jsx2("span", { style: { color: "#e2e8f0", fontSize: "11px", textAlign: "right", wordBreak: "break-all" }, children })
  ] });
}
function WatsonAuthDebugPanel() {
  const [event, setEvent] = useState3(null);
  const [open, setOpen] = useState3(true);
  const countdown = useCountdown(event?.tokenExpiresAt);
  const refresh = useCallback(() => setEvent(readDebugCookie()), []);
  useEffect3(() => {
    refresh();
    const id = setInterval(refresh, 2e3);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  const expiryColor = countdown === null ? "#94a3b8" : countdown < 30 ? "#f87171" : countdown < 120 ? "#fbbf24" : "#86efac";
  const lastRefresh = event?.refreshedAt ? new Date(event.refreshedAt).toLocaleTimeString() : "\u2014";
  return /* @__PURE__ */ jsx2("div", { style: { position: "fixed", bottom: "16px", right: "16px", zIndex: 9999, fontFamily: "monospace" }, children: /* @__PURE__ */ jsxs2("div", { style: {
    background: "#0f172a",
    color: "#e2e8f0",
    borderRadius: "8px",
    padding: open ? "12px 16px 14px" : "9px 14px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
    minWidth: "260px",
    border: "1px solid #1e293b"
  }, children: [
    /* @__PURE__ */ jsxs2(
      "div",
      {
        onClick: () => setOpen((o) => !o),
        style: { display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" },
        children: [
          /* @__PURE__ */ jsx2("span", { style: { color: "#60a5fa", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }, children: "WatsonAuth Debug" }),
          event && /* @__PURE__ */ jsx2(Badge, { action: event.action }),
          /* @__PURE__ */ jsx2("span", { style: { color: "#475569", fontSize: "10px", marginLeft: "6px" }, children: open ? "\u25BC" : "\u25B2" })
        ]
      }
    ),
    open && /* @__PURE__ */ jsx2("div", { style: { marginTop: "4px" }, children: !event ? /* @__PURE__ */ jsx2("div", { style: { color: "#475569", fontSize: "11px", marginTop: "8px" }, children: "No requests intercepted yet" }) : /* @__PURE__ */ jsxs2(Fragment, { children: [
      /* @__PURE__ */ jsx2(Row, { label: "path", children: event.path }),
      event.reason && /* @__PURE__ */ jsx2(Row, { label: "reason", children: /* @__PURE__ */ jsx2("span", { style: { color: "#fca5a5" }, children: event.reason }) }),
      event.userId && /* @__PURE__ */ jsx2(Row, { label: "user", children: event.userId }),
      /* @__PURE__ */ jsx2(Row, { label: "token expires in", children: /* @__PURE__ */ jsx2("span", { style: { color: expiryColor, fontWeight: 600 }, children: countdown !== null ? `${countdown}s` : "\u2014" }) }),
      /* @__PURE__ */ jsx2(Row, { label: "last refresh", children: lastRefresh })
    ] }) })
  ] }) });
}
export {
  UserProfileDropdown,
  WatsonAuthDebugPanel,
  useWatsonUser
};
//# sourceMappingURL=react.js.map