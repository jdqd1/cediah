"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileWidgetProps = {
  onError: () => void;
  onTokenChange: (token: string | null) => void;
  resetKey: number;
  siteKey: string;
};

type TurnstileApi = {
  remove: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      sitekey: string;
      theme: "auto";
    },
  ) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({
  onError,
  onTokenChange,
  resetKey,
  siteKey,
}: TurnstileWidgetProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const onErrorRef = useRef(onError);
  const onTokenChangeRef = useRef(onTokenChange);

  useEffect(() => {
    onErrorRef.current = onError;
    onTokenChangeRef.current = onTokenChange;
  }, [onError, onTokenChange]);

  useEffect(() => {
    const api = window.turnstile;
    const container = containerRef.current;
    if (!scriptReady || !api || !container || widgetIdRef.current) return;

    widgetIdRef.current = api.render(container, {
      callback: (token) => onTokenChangeRef.current(token),
      "error-callback": () => {
        onTokenChangeRef.current(null);
        onErrorRef.current();
      },
      "expired-callback": () => onTokenChangeRef.current(null),
      sitekey: siteKey,
      theme: "auto",
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = undefined;
    };
  }, [scriptReady, siteKey]);

  useEffect(() => {
    if (resetKey > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onTokenChangeRef.current(null);
    }
  }, [resetKey]);

  return (
    <div className="turnstile-container">
      <Script
        id="cloudflare-turnstile"
        onError={() => onErrorRef.current()}
        onReady={() => setScriptReady(true)}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&hl=es"
        strategy="afterInteractive"
      />
      <div
        aria-label="Verificación de seguridad"
        className="turnstile-widget"
        ref={containerRef}
      />
    </div>
  );
}
