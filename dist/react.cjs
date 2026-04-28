"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/react.tsx
var react_exports = {};
__export(react_exports, {
  UserProfileDropdown: () => UserProfileDropdown,
  WatsonAuthDebugPanel: () => WatsonAuthDebugPanel,
  useWatsonUser: () => useWatsonUser
});
module.exports = __toCommonJS(react_exports);

// src/Logout.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function UserProfileDropdown({ userName }) {
  const [isOpen, setIsOpen] = (0, import_react.useState)(false);
  const [isLoading, setIsLoading] = (0, import_react.useState)(false);
  const [dropdownPosition, setDropdownPosition] = (0, import_react.useState)({ top: 0, right: 0 });
  const buttonRef = (0, import_react.useRef)(null);
  const dropdownRef = (0, import_react.useRef)(null);
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
  (0, import_react.useEffect)(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "relative", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        ref: buttonRef,
        onClick: handleToggle,
        className: "flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800 transition-colors cursor-pointer",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "svg",
            {
              className: "w-8 h-8 text-gray-300",
              fill: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" })
            }
          ),
          userName && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "text-gray-300 text-sm", children: userName }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "svg",
            {
              className: `w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`,
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
            }
          )
        ]
      }
    ),
    isOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        ref: dropdownRef,
        style: { top: dropdownPosition.top, right: dropdownPosition.right },
        className: "fixed w-48 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            onClick: handleLogout,
            disabled: isLoading,
            className: "w-full flex items-center gap-2 px-4 py-2 text-left text-gray-300 hover:bg-gray-700 rounded-md transition-colors cursor-pointer disabled:opacity-50",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "svg",
                {
                  className: "w-4 h-4",
                  fill: "none",
                  stroke: "currentColor",
                  viewBox: "0 0 24 24",
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" })
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
var import_react2 = require("react");
function useWatsonUser(options = {}) {
  const { endpoint = "/api/me", auto = true } = options;
  const [user, setUser] = (0, import_react2.useState)(null);
  const [isLoading, setIsLoading] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)(null);
  const refresh = (0, import_react2.useMemo)(() => {
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
  (0, import_react2.useEffect)(() => {
    if (!auto) return;
    void refresh();
  }, [auto, refresh]);
  return { user, isLoading, error, refresh };
}

// src/debugPanel.tsx
var import_react3 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
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
  const [seconds, setSeconds] = (0, import_react3.useState)(null);
  (0, import_react3.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: {
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "7px", gap: "16px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "#64748b", fontSize: "11px", flexShrink: 0 }, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "#e2e8f0", fontSize: "11px", textAlign: "right", wordBreak: "break-all" }, children })
  ] });
}
function WatsonAuthDebugPanel() {
  const [event, setEvent] = (0, import_react3.useState)(null);
  const [open, setOpen] = (0, import_react3.useState)(true);
  const countdown = useCountdown(event?.tokenExpiresAt);
  const refresh = (0, import_react3.useCallback)(() => setEvent(readDebugCookie()), []);
  (0, import_react3.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { position: "fixed", bottom: "16px", right: "16px", zIndex: 9999, fontFamily: "monospace" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
    background: "#0f172a",
    color: "#e2e8f0",
    borderRadius: "8px",
    padding: open ? "12px 16px 14px" : "9px 14px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
    minWidth: "260px",
    border: "1px solid #1e293b"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        onClick: () => setOpen((o) => !o),
        style: { display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "#60a5fa", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }, children: "WatsonAuth Debug" }),
          event && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Badge, { action: event.action }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "#475569", fontSize: "10px", marginLeft: "6px" }, children: open ? "\u25BC" : "\u25B2" })
        ]
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { marginTop: "4px" }, children: !event ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { color: "#475569", fontSize: "11px", marginTop: "8px" }, children: "No requests intercepted yet" }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Row, { label: "path", children: event.path }),
      event.reason && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Row, { label: "reason", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "#fca5a5" }, children: event.reason }) }),
      event.userId && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Row, { label: "user", children: event.userId }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Row, { label: "token expires in", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: expiryColor, fontWeight: 600 }, children: countdown !== null ? `${countdown}s` : "\u2014" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Row, { label: "last refresh", children: lastRefresh })
    ] }) })
  ] }) });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  UserProfileDropdown,
  WatsonAuthDebugPanel,
  useWatsonUser
});
//# sourceMappingURL=react.cjs.map