"use client";

import { usePathname } from "next/navigation";
import { FieldFactory, rgbAlpha, themeColor, themeNumber, useCanvasField } from "@/components/canvas/useCanvasField";

// A dense field of tiny dots drifting upward like embers, gently pulled in
// toward the cursor instead of dodging it. Color/alpha/radius come from the
// --ember* tokens in globals.css, which carry the light/dark split so this
// component itself stays theme-agnostic (same pattern as --primary).
function emberDrift(): FieldFactory {
    const COUNT = 340;
    const SPEED = 0.08;
    const ANGLE = (270 * Math.PI) / 180; // straight up

    return (width, height) => {
        const accent = themeColor("--ember");
        const alphaBase = themeNumber("--ember-alpha-base", 0.15);
        const alphaSpread = themeNumber("--ember-alpha-spread", 0.25);
        const radiusBase = themeNumber("--ember-radius-base", 0.6);
        const vx0 = Math.cos(ANGLE) * SPEED;
        const vy0 = Math.sin(ANGLE) * SPEED;
        const dots = Array.from({ length: COUNT }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: vx0 * (0.7 + Math.random() * 0.6),
            vy: vy0 * (0.7 + Math.random() * 0.6),
            r: radiusBase + Math.random() * 1.0,
            baseAlpha: alphaBase + Math.random() * alphaSpread,
        }));

        return {
            draw(ctx, { width, height, mouse }) {
                for (const p of dots) {
                    p.x += p.vx;
                    p.y += p.vy;
                    if (mouse.active) {
                        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
                        if (d < 90 && d > 1) {
                            const strength = ((90 - d) / 90) * 1.4;
                            const ang = Math.atan2(p.y - mouse.y, p.x - mouse.x);
                            p.x -= Math.cos(ang) * strength;
                            p.y -= Math.sin(ang) * strength;
                        }
                    }
                    if (p.x < -10) p.x = width + 10;
                    if (p.x > width + 10) p.x = -10;
                    if (p.y < -10) p.y = height + 10;
                    if (p.y > height + 10) p.y = -10;

                    const md = mouse.active ? Math.hypot(p.x - mouse.x, p.y - mouse.y) : 9999;
                    const glow = Math.max(0, 1 - md / 150);
                    ctx.beginPath();
                    ctx.fillStyle = rgbAlpha(accent, p.baseAlpha + glow * 0.5);
                    ctx.arc(p.x, p.y, p.r + glow, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
        };
    };
}

const FACTORY = emberDrift();

export default function EmberField() {
    const pathname = usePathname();
    // Paused on the dashboard and on individual posts (write, edit, read) —
    // all sustained-attention pages where drifting motion competes with the
    // content instead of just sitting behind it. The public listing at
    // /posts itself stays animated. "/posts/" (trailing slash) excludes the
    // bare listing route while covering /posts/add, /posts/[slug], and
    // /posts/[slug]/edit in one check.
    const paused = pathname?.startsWith("/dashboard") || pathname?.startsWith("/posts/") || false;
    const canvasRef = useCanvasField(FACTORY, { paused });
    return (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
            <canvas ref={canvasRef} className="block h-full w-full" />
        </div>
    );
}
