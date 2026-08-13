"use client";

import { useEffect, useRef } from "react";

export interface FieldEnv {
    width: number;
    height: number;
    t: number;
    mouse: { x: number; y: number; active: boolean };
}

export interface Field {
    draw: (ctx: CanvasRenderingContext2D, env: FieldEnv) => void;
}

export type FieldFactory = (width: number, height: number) => Field;

const FALLBACK_RGB: [number, number, number] = [217, 119, 26];

// Reads a color custom property off the live theme (e.g. "--primary") so
// every variant matches whichever theme (light/dark) is currently active,
// instead of a hardcoded color baked for one mode.
//
// CSS Color 4 lets getComputedStyle serialize a resolved color in whatever
// function preserves its gamut best (browsers commonly return oklch(...)-
// authored tokens back out as lab(...) or oklab(...), never guaranteed to
// be rgb(...)), so a format-specific regex on that string is fragile. This
// instead lets a real DOM element resolve `var(...)` against the cascade,
// then lets a canvas 2D context — which parses any valid CSS color syntax
// and always rasterizes to concrete sRGB bytes — do the actual conversion.
export function themeColor(varName: string = "--primary"): [number, number, number] {
    if (typeof document === "undefined") return FALLBACK_RGB;
    const probe = document.createElement("span");
    probe.style.color = `var(${varName})`;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    document.body.removeChild(probe);

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return FALLBACK_RGB;
    ctx.fillStyle = resolved;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
}

export function rgbAlpha([r, g, b]: [number, number, number], alpha: number): string {
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

// Reads a plain numeric custom property (not a color), e.g. a per-theme
// alpha or radius tuning value defined alongside a color token.
export function themeNumber(varName: string, fallback: number): number {
    if (typeof window === "undefined") return fallback;
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    const n = Number(raw);
    return raw !== "" && Number.isFinite(n) ? n : fallback;
}

// Drives one <canvas> element: sizing, pointer tracking, the animation
// loop, and a static single-frame render when the user prefers reduced
// motion. Pointer position is tracked at the window level (not scoped to
// the canvas element) because a decorative background canvas is often a
// sibling behind real interactive content — text, buttons — that would
// otherwise swallow pointermove before it ever reached the canvas.
export function useCanvasField(factory: FieldFactory, options?: { paused?: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const paused = options?.paused ?? false;

    useEffect(() => {
        const canvas = canvasRef.current;
        const parent = canvas?.parentElement;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !parent || !ctx) return;

        if (paused) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let width = 0;
        let height = 0;
        let field: Field | null = null;
        let raf = 0;
        let t = 0;
        const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };

        // Resizing only updates the canvas backing store and the bounds the
        // field draws/wraps against — it does NOT rebuild the field, so a
        // window drag doesn't repeatedly re-randomize every particle.
        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = parent!.clientWidth;
            height = parent!.clientHeight;
            canvas!.width = width * dpr;
            canvas!.height = height * dpr;
            ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (!field) field = factory(width, height);
            if (reduced) renderStatic();
        }

        // Theme colors/alpha/radius are baked into each particle at creation
        // time, so a theme change (unlike a resize) does need a full rebuild
        // to actually pick up the new values.
        function restyle() {
            if (width === 0 && height === 0) return;
            field = factory(width, height);
            if (reduced) renderStatic();
        }

        function renderStatic() {
            if (!field) return;
            ctx!.clearRect(0, 0, width, height);
            field.draw(ctx!, { width, height, t: 0, mouse });
        }

        function onMove(e: PointerEvent) {
            const rect = canvas!.getBoundingClientRect();
            mouse.tx = e.clientX - rect.left;
            mouse.ty = e.clientY - rect.top;
            mouse.active = true;
        }

        function frame() {
            mouse.x += (mouse.tx - mouse.x) * 0.1;
            mouse.y += (mouse.ty - mouse.y) * 0.1;
            t += 1 / 60;
            if (field) {
                ctx!.clearRect(0, 0, width, height);
                field.draw(ctx!, { width, height, t, mouse });
            }
            raf = requestAnimationFrame(frame);
        }

        const ro = new ResizeObserver(resize);
        ro.observe(parent);
        resize();
        window.addEventListener("pointermove", onMove);
        if (!reduced) raf = requestAnimationFrame(frame);

        // next-themes toggles a class on <html> for both manual switches and
        // system-preference changes (it has its own matchMedia listener
        // under the hood), so observing that one attribute covers both.
        const mo = new MutationObserver(restyle);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            mo.disconnect();
            window.removeEventListener("pointermove", onMove);
        };
    }, [factory, paused]);

    return canvasRef;
}
