import React, { useState, useRef, useEffect } from "react";
import {
  Palette,
  Highlighter,
  Check,
  X,
  Pipette,
  Plus
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE DOCS STYLE MULTI-LEVEL COLOR PALETTE & COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const GOOGLE_DOCS_PALETTE: { color: string; name: string }[][] = [
  // Row 0: Grayscale (10 steps from black to pure white)
  [
    { color: '#000000', name: 'Black' },
    { color: '#434343', name: 'Dark Charcoal' },
    { color: '#666666', name: 'Dark Gray' },
    { color: '#999999', name: 'Gray' },
    { color: '#b7b7b7', name: 'Medium Light Gray' },
    { color: '#cccccc', name: 'Light Gray' },
    { color: '#d9d9d9', name: 'Silver' },
    { color: '#efefef', name: 'Ghost White' },
    { color: '#f3f3f3', name: 'Off White' },
    { color: '#ffffff', name: 'Pure White' },
  ],
  // Row 1: Primary Hues
  [
    { color: '#980000', name: 'Berry Red' },
    { color: '#ff0000', name: 'Red' },
    { color: '#ff9900', name: 'Orange' },
    { color: '#ffff00', name: 'Yellow' },
    { color: '#00ff00', name: 'Green' },
    { color: '#00ffff', name: 'Cyan' },
    { color: '#4a86e8', name: 'Cornflower Blue' },
    { color: '#0000ff', name: 'Blue' },
    { color: '#9900ff', name: 'Purple' },
    { color: '#ff00ff', name: 'Magenta' },
  ],
  // Row 2: Level 1 (Lightest pastels)
  [
    { color: '#e6b8af', name: 'Light Berry 3' },
    { color: '#f4cccc', name: 'Light Red 3' },
    { color: '#fce5cd', name: 'Light Orange 3' },
    { color: '#fff2cc', name: 'Light Yellow 3' },
    { color: '#d9ead3', name: 'Light Green 3' },
    { color: '#d0e0e3', name: 'Light Cyan 3' },
    { color: '#c9daf8', name: 'Light Cornflower 3' },
    { color: '#cfe2f3', name: 'Light Blue 3' },
    { color: '#d9d2e9', name: 'Light Purple 3' },
    { color: '#ead1dc', name: 'Light Magenta 3' },
  ],
  // Row 3: Level 2 (Soft light tints)
  [
    { color: '#dd7e6b', name: 'Light Berry 2' },
    { color: '#ea9999', name: 'Light Red 2' },
    { color: '#f9cb9c', name: 'Light Orange 2' },
    { color: '#ffe599', name: 'Light Yellow 2' },
    { color: '#b6d7a8', name: 'Light Green 2' },
    { color: '#a2c4c9', name: 'Light Cyan 2' },
    { color: '#a4c2f4', name: 'Light Cornflower 2' },
    { color: '#9fc5e8', name: 'Light Blue 2' },
    { color: '#b4a7d6', name: 'Light Purple 2' },
    { color: '#d5a6bd', name: 'Light Magenta 2' },
  ],
  // Row 4: Level 3 (Medium light)
  [
    { color: '#cc4125', name: 'Medium Berry 1' },
    { color: '#e06666', name: 'Medium Red 1' },
    { color: '#f6b26b', name: 'Medium Orange 1' },
    { color: '#ffd966', name: 'Medium Yellow 1' },
    { color: '#93c47d', name: 'Medium Green 1' },
    { color: '#76a5af', name: 'Medium Cyan 1' },
    { color: '#6d9eeb', name: 'Medium Cornflower 1' },
    { color: '#6fa8dc', name: 'Medium Blue 1' },
    { color: '#8e7cc3', name: 'Medium Purple 1' },
    { color: '#c27ba0', name: 'Medium Magenta 1' },
  ],
  // Row 5: Level 4 (Vibrant / standard)
  [
    { color: '#a61c1c', name: 'Dark Berry 1' },
    { color: '#cc0000', name: 'Dark Red 1' },
    { color: '#e69138', name: 'Dark Orange 1' },
    { color: '#f1c232', name: 'Dark Yellow 1' },
    { color: '#6aa84f', name: 'Dark Green 1' },
    { color: '#45818e', name: 'Dark Cyan 1' },
    { color: '#3c78d8', name: 'Dark Cornflower 1' },
    { color: '#3d85c6', name: 'Dark Blue 1' },
    { color: '#674ea7', name: 'Dark Purple 1' },
    { color: '#a64d79', name: 'Dark Magenta 1' },
  ],
  // Row 6: Level 5 (Deep shades)
  [
    { color: '#852020', name: 'Dark Berry 2' },
    { color: '#990000', name: 'Dark Red 2' },
    { color: '#b45f06', name: 'Dark Orange 2' },
    { color: '#bf9000', name: 'Dark Yellow 2' },
    { color: '#38761d', name: 'Dark Green 2' },
    { color: '#134f5c', name: 'Dark Cyan 2' },
    { color: '#1155cc', name: 'Dark Cornflower 2' },
    { color: '#0b5394', name: 'Dark Blue 2' },
    { color: '#351c75', name: 'Dark Purple 2' },
    { color: '#741b47', name: 'Dark Magenta 2' },
  ],
  // Row 7: Level 6 (Deepest / Midnight / Navy shades)
  [
    { color: '#5b0f00', name: 'Dark Berry 3' },
    { color: '#660000', name: 'Dark Red 3' },
    { color: '#783f04', name: 'Dark Orange 3' },
    { color: '#7f6000', name: 'Dark Yellow 3' },
    { color: '#274e13', name: 'Dark Green 3' },
    { color: '#0c343d', name: 'Dark Cyan 3' },
    { color: '#1c4587', name: 'Dark Cornflower 3' },
    { color: '#073763', name: 'Dark Blue 3' },
    { color: '#20124d', name: 'Deep YAU Navy 3' },
    { color: '#4c1130', name: 'Dark Magenta 3' },
  ],
];

export const normalizeHex = (colorStr?: string): string => {
  if (!colorStr) return '';
  const str = colorStr.trim().toLowerCase();
  if (str === 'transparent' || str === 'none') return 'transparent';
  if (str.startsWith('#')) {
    if (str.length === 4) {
      return `#${str[1]}${str[1]}${str[2]}${str[2]}${str[3]}${str[3]}`;
    }
    return str;
  }
  const rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return str;
};

export const isLightColor = (colorStr: string): boolean => {
  const hex = normalizeHex(colorStr);
  if (!hex || !hex.startsWith('#') || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
};

function hsvToHex(h: number, s: number, v: number): string {
  s = Math.max(0, Math.min(100, s)) / 100;
  v = Math.max(0, Math.min(100, v)) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  if (clean.length !== 6) return { h: 210, s: 60, v: 80 };
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = h * 60;
  }
  return { h: Math.round((h + 360) % 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

interface CustomColorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor?: string;
  onSelect: (hex: string) => void;
  restoreSelection?: () => void;
}

export const CustomColorModal: React.FC<CustomColorModalProps> = ({
  isOpen,
  onClose,
  currentColor = '#2563EB',
  onSelect,
  restoreSelection,
}) => {
  const [h, setH] = useState(210);
  const [s, setS] = useState(60);
  const [v, setV] = useState(80);
  const [hexInput, setHexInput] = useState('#2563EB');
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      const validHex = (currentColor && currentColor !== 'transparent' && currentColor.startsWith('#'))
        ? currentColor
        : '#2563EB';
      const initialHsv = hexToHsv(validHex);
      setH(initialHsv.h);
      setS(initialHsv.s);
      setV(initialHsv.v);
      setHexInput(validHex.toUpperCase());
    }
  }, [isOpen, currentColor]);

  if (!isOpen) return null;

  const currentPickedHex = hsvToHex(h, s, v);

  const updateFromPosition = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const newS = Math.round((x / rect.width) * 100);
    const newV = Math.round((1 - y / rect.height) * 100);
    setS(newS);
    setV(newV);
    setHexInput(hsvToHex(h, newS, newV));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    updateFromPosition(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingRef.current) {
        updateFromPosition(moveEvent.clientX, moveEvent.clientY);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleHexChange = (val: string) => {
    setHexInput(val);
    let clean = val.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (clean.length === 7 && /^#[0-9A-Fa-f]{6}$/.test(clean)) {
      const parsed = hexToHsv(clean);
      setH(parsed.h);
      setS(parsed.s);
      setV(parsed.v);
    }
  };

  const handleSelect = () => {
    if (restoreSelection) restoreSelection();
    let finalColor = hexInput.trim();
    if (!finalColor.startsWith('#')) finalColor = `#${finalColor}`;
    if (!/^#[0-9A-Fa-f]{6}$/.test(finalColor)) {
      finalColor = currentPickedHex;
    }
    onSelect(finalColor);
    onClose();
  };

  const handleEyeDropper = async () => {
    try {
      if ('EyeDropper' in window) {
        // @ts-expect-error EyeDropper is supported in Chromium
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          const hex = result.sRGBHex.toUpperCase();
          setHexInput(hex);
          const parsed = hexToHsv(hex);
          setH(parsed.h);
          setS(parsed.s);
          setV(parsed.v);
        }
      }
    } catch {
      // User dismissed eyedropper
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-100"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-[290px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60">
          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-100">
            <Palette size={14} className="text-blue-600 dark:text-blue-400" />
            <span>Custom Color</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-3.5 flex flex-col gap-3">
          {/* 2D Saturation / Value Gradient Canvas */}
          <div
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            className="w-full h-[145px] rounded-lg relative cursor-crosshair overflow-hidden select-none border border-slate-200 dark:border-slate-700 shadow-inner"
            style={{ backgroundColor: `hsl(${h}, 100%, 50%)` }}
          >
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, #ffffff, transparent)' }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, #000000, transparent)' }}
            />
            {/* Color indicator ring */}
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${s}%`,
                top: `${100 - v}%`,
                backgroundColor: currentPickedHex,
              }}
            />
          </div>

          {/* Hue Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max="360"
              value={h}
              onChange={e => {
                const newH = parseInt(e.target.value, 10);
                setH(newH);
                setHexInput(hsvToHex(newH, s, v));
              }}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer"
              style={{
                background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
              }}
            />
          </div>

          {/* Color Preview & Hex Input Row */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            {/* Swatch Preview */}
            <div
              className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 shrink-0 shadow-xs relative overflow-hidden"
              style={{
                backgroundColor: currentPickedHex,
                boxShadow: currentPickedHex.toLowerCase() === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.15)' : undefined,
              }}
              title={`Preview: ${currentPickedHex}`}
            />

            {/* Hex Input */}
            <div className="flex-1">
              <input
                type="text"
                value={hexInput}
                onChange={e => handleHexChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSelect();
                  }
                }}
                placeholder="#000000"
                className="w-full h-8 px-2.5 font-mono text-xs uppercase font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Eyedropper Button */}
            {'EyeDropper' in window && (
              <button
                type="button"
                onClick={handleEyeDropper}
                title="Pick color from screen"
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              >
                <Pipette size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-3.5 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSelect}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <Check size={13} className="stroke-[3]" />
            <span>Select</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export interface GoogleDocsColorPickerPopoverProps {
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectColor: (color: string) => void;
  allowNone?: boolean;
  align?: 'left' | 'right';
  restoreSelection?: () => void;
  currentColor?: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const GoogleDocsColorPickerPopover: React.FC<GoogleDocsColorPickerPopoverProps> = ({
  title = 'Color',
  isOpen,
  onClose,
  onSelectColor,
  allowNone = false,
  align = 'left',
  restoreSelection,
  currentColor,
  triggerRef,
}) => {
  const [customColors, setCustomColors] = useState<string[]>([
    '#0a192f', '#1e3a8a', '#2563eb', '#059669', '#dc2626', '#ffffff'
  ]);
  const [activeColor, setActiveColor] = useState<string>(currentColor || '');
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentColor !== undefined) {
      setActiveColor(currentColor);
    }
  }, [currentColor, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (isCustomModalOpen) return;
      const target = e.target as Node;
      if (popoverRef.current && popoverRef.current.contains(target)) {
        return;
      }
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }
      onClose();
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick, true);
    }, 20);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick, true);
    };
  }, [isOpen, onClose, isCustomModalOpen, triggerRef]);

  if (!isOpen) return null;

  const applyColor = (color: string, shouldClose = false) => {
    if (restoreSelection) restoreSelection();
    setActiveColor(color);
    onSelectColor(color);
    if (shouldClose) {
      onClose();
    }
  };

  const addCustomColorAndApply = (color: string, shouldClose = false) => {
    const formatted = color.toLowerCase().trim();
    if (formatted && !customColors.includes(formatted)) {
      setCustomColors(prev => [formatted, ...prev.slice(0, 9)]);
    }
    applyColor(color, shouldClose);
  };

  const handleEyeDropper = async () => {
    try {
      if ('EyeDropper' in window) {
        // @ts-expect-error EyeDropper is supported in Chromium
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          addCustomColorAndApply(result.sRGBHex.toUpperCase(), false);
        }
      } else {
        setIsCustomModalOpen(true);
      }
    } catch {
      // User cancelled
    }
  };

  return (
    <>
      <div
        ref={popoverRef}
        onMouseDown={e => {
          e.preventDefault();
        }}
        className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1 p-2.5 bg-popover dark:bg-slate-900 text-popover-foreground dark:text-slate-100 border border-border dark:border-slate-800 rounded-xl shadow-2xl z-50 w-[242px] flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100`}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
            {title.toLowerCase().includes('highlight') ? (
              <Highlighter size={12} className="text-amber-500" />
            ) : (
              <Palette size={12} className="text-blue-500" />
            )}
            <span>{title}</span>
          </span>
          <div className="flex items-center gap-1.5">
            {/* Compact Selected Color Preview Pill */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
              title={`Selected: ${activeColor === 'transparent' ? 'None' : normalizeHex(activeColor).toUpperCase()}`}
            >
              <div
                className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0 relative overflow-hidden"
                style={{
                  backgroundColor: activeColor ? (activeColor === 'transparent' ? '#ffffff' : activeColor) : (allowNone ? '#ffffff' : '#000000'),
                  boxShadow: (activeColor?.toLowerCase() === '#ffffff' || activeColor === 'transparent') ? 'inset 0 0 0 1px rgba(0,0,0,0.15)' : undefined
                }}
              >
                {activeColor === 'transparent' && (
                  <div className="w-full h-0.5 bg-red-500 rotate-45 transform" />
                )}
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200">
                {activeColor === 'transparent'
                  ? 'None'
                  : (normalizeHex(activeColor).toUpperCase() || (allowNone ? 'None' : '#000000'))
                }
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-5 w-5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={11} />
            </button>
          </div>
        </div>

        {/* Optional "None / Transparent" for Highlight Color */}
        {allowNone && (
          <div className="pb-1 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => applyColor('transparent', false)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border flex items-center gap-1 transition-colors cursor-pointer w-full justify-between ${
                activeColor === 'transparent'
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 ring-1 ring-red-400'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title="Remove background color"
            >
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border border-red-500 relative flex items-center justify-center overflow-hidden">
                  <div className="w-full h-0.5 bg-red-500 rotate-45 transform" />
                </div>
                <span>None (Transparent)</span>
              </div>
              {activeColor === 'transparent' && <Check size={10} className="stroke-[3] text-red-600" />}
            </button>
          </div>
        )}

        {/* 10-Column Multi-Level Palette Grid */}
        <div className="grid grid-cols-10 gap-1 p-0.5 shrink-0 justify-center">
          {GOOGLE_DOCS_PALETTE.map((row, rIdx) =>
            row.map((item, cIdx) => {
              const isSelected = activeColor && normalizeHex(activeColor) === normalizeHex(item.color);
              return (
                <button
                  key={`${rIdx}-${cIdx}`}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => applyColor(item.color, false)}
                  title={item.name}
                  className={`w-[18px] h-[18px] rounded-full transition-transform cursor-pointer shadow-2xs hover:scale-125 flex items-center justify-center relative ${
                    isSelected
                      ? 'ring-2 ring-blue-600 ring-offset-1 scale-110 z-10 border-transparent shadow-xs'
                      : 'border border-slate-200 dark:border-slate-700/80 hover:z-20 hover:border-slate-800 dark:hover:border-slate-300'
                  }`}
                  style={{
                    backgroundColor: item.color,
                    boxShadow: item.color.toLowerCase() === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.15)' : undefined,
                  }}
                >
                  {isSelected && (
                    <Check
                      size={10}
                      className={`stroke-[3.5] ${isLightColor(item.color) ? 'text-slate-900' : 'text-white'}`}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* CUSTOM Section */}
        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            CUSTOM
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {customColors.map((hex, idx) => {
              const isSelected = activeColor && normalizeHex(activeColor) === normalizeHex(hex);
              return (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => applyColor(hex, false)}
                  title={hex}
                  className={`w-[18px] h-[18px] rounded-full transition-transform cursor-pointer shadow-2xs hover:scale-125 flex items-center justify-center relative ${
                    isSelected
                      ? 'ring-2 ring-blue-600 ring-offset-1 scale-110 z-10 border-transparent shadow-xs'
                      : 'border border-slate-200 dark:border-slate-700/80 hover:border-slate-800 dark:hover:border-slate-300'
                  }`}
                  style={{
                    backgroundColor: hex,
                    boxShadow: hex.toLowerCase() === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.15)' : undefined,
                  }}
                >
                  {isSelected && (
                    <Check
                      size={10}
                      className={`stroke-[3.5] ${isLightColor(hex) ? 'text-slate-900' : 'text-white'}`}
                    />
                  )}
                </button>
              );
            })}

            {/* Plus (+) Add Custom Color Button -> Opens Dedicated Custom Color Modal with Select Button */}
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setIsCustomModalOpen(true)}
              title="Add custom color"
              className="w-[18px] h-[18px] rounded-full border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-115 transition-all cursor-pointer"
            >
              <Plus size={10} />
            </button>

            {/* Pipette Eyedropper Button */}
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={handleEyeDropper}
              title="Pick color with eyedropper"
              className="w-[18px] h-[18px] rounded-full border border-slate-200 dark:border-slate-700 hover:border-primary flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-115 transition-all cursor-pointer"
            >
              <Pipette size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Custom Color Modal on '+' click */}
      <CustomColorModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        currentColor={activeColor}
        onSelect={color => {
          addCustomColorAndApply(color, false);
        }}
        restoreSelection={restoreSelection}
      />
    </>
  );
};

export default GoogleDocsColorPickerPopover;
