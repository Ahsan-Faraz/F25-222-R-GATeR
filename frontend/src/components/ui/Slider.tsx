import React, { ChangeEvent } from 'react';

/** Stitch primary fill track + surface-container-high remainder */

interface SliderProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
}

export default function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.1,
  showValue = true,
}: SliderProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between items-center">
          <label className="text-xs text-on-surface-variant uppercase tracking-wider">{label}</label>
          {showValue && (
            <span className="text-sm font-mono text-on-surface">{value.toFixed(2)}</span>
          )}
        </div>
      )}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="slider-input w-full"
          style={{
            background: `linear-gradient(to right, #c3f5ff 0%, #c3f5ff ${percentage}%, #2a2a2b ${percentage}%, #2a2a2b 100%)`,
          }}
        />
      </div>
    </div>
  );
}
