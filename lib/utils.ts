import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function applyPolyfills(ctx: CanvasRenderingContext2D) {
  if (!ctx.roundRect) {
    ctx.roundRect = function (x: number, y: number, w: number, h: number, r: number) {
      if (typeof r === 'number') {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
      } else {
        this.rect(x, y, w, h);
      }
    };
  }
}
