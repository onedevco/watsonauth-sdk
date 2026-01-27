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
export {
  UserProfileDropdown,
  useWatsonUser
};
//# sourceMappingURL=react.js.map