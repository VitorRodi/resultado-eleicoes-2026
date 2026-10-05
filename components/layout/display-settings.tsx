"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Accessibility, Contrast, Type, Check } from "lucide-react";
const DisplayContext = createContext({
  largeText: false,
  mapPatterns: false,
  highContrast: false,
});
export const useDisplaySettings = () => useContext(DisplayContext);
export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState({
    largeText: false,
    mapPatterns: false,
    highContrast: false,
  });
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("eleicoes-2026:display:v1") || "{}",
        );
        setSettings({
          largeText: saved.largeText === true,
          mapPatterns: saved.mapPatterns === true,
          highContrast: saved.highContrast === true,
        });
      } catch {
        /* Use readable defaults. */
      }
    });
  }, []);
  function toggle(key: keyof typeof settings) {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    try {
      localStorage.setItem("eleicoes-2026:display:v1", JSON.stringify(next));
    } catch {
      /* Settings remain active during this visit. */
    }
  }
  return (
    <DisplayContext value={settings}>
      <div
        className="display-root"
        data-large-text={settings.largeText || undefined}
        data-high-contrast={settings.highContrast || undefined}
      >
        <div className="reader-bar">
          <span>Informação pública, mais fácil de acompanhar.</span>
          <details
            className="display-settings"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
                event.preventDefault();
              }
            }}
          >
            <summary>
              <Accessibility size={18} aria-hidden="true" />
              Acessibilidade
            </summary>
            <div
              className="display-settings-options"
              role="group"
              aria-label="Opções de acessibilidade"
            >
              <p>Ajuste a leitura para você.</p>
              {(
                [
                  { key: "largeText", label: "Texto maior", icon: Type },
                  {
                    key: "mapPatterns",
                    label: "Padrões no mapa",
                    icon: Contrast,
                  },
                  {
                    key: "highContrast",
                    label: "Mais contraste",
                    icon: Contrast,
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  aria-pressed={settings[option.key]}
                  onClick={() => toggle(option.key)}
                >
                  <option.icon size={18} aria-hidden="true" />
                  {option.label}
                  <Check
                    size={17}
                    className={
                      settings[option.key] ? "" : "setting-check-hidden"
                    }
                    aria-hidden="true"
                  />
                </button>
              ))}
              <small>Suas preferências ficam salvas neste navegador.</small>
            </div>
          </details>
        </div>
        {children}
      </div>
    </DisplayContext>
  );
}
