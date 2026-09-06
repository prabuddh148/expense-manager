import React from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../theme';

type Props = {
  size?: number;
  /** Solid mark on a coloured plate, or just the glyph. */
  variant?: 'plate' | 'glyph';
  /** Overrides the plate colour; the glyph always contrasts with it. */
  color?: string;
  glyphColor?: string;
};

/**
 * The app mark: a wallet whose flap doubles as a rising trend line, with a rupee
 * counter-form cut into it. Drawn as SVG so one component serves the splash screen,
 * headers and the auth screens at any size without extra raster assets.
 */
export function Logo({ size = 96, variant = 'plate', color, glyphColor }: Props) {
  const { colors } = useTheme();

  const plate = color ?? colors.primary;
  const glyph = glyphColor ?? '#FFFFFF';
  const radius = size * 0.26;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="logoPlate" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={plate} stopOpacity={1} />
          <Stop offset="1" stopColor={plate} stopOpacity={0.82} />
        </LinearGradient>
      </Defs>

      {variant === 'plate' ? (
        <Rect
          x={0}
          y={0}
          width={100}
          height={100}
          rx={(radius / size) * 100}
          fill="url(#logoPlate)"
        />
      ) : null}

      {/* Wallet body. */}
      <Path
        d="M24 36h44a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H32a8 8 0 0 1-8-8V36z"
        fill={variant === 'plate' ? glyph : plate}
        opacity={variant === 'plate' ? 0.16 : 0.16}
      />
      <Path
        d="M24 36h44a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H32a8 8 0 0 1-8-8V36z"
        stroke={variant === 'plate' ? glyph : plate}
        strokeWidth={4.5}
        strokeLinejoin="round"
        fill="none"
      />

      {/* Card slot on the wallet edge. */}
      <Path
        d="M60 52h16v14H60a7 7 0 0 1 0-14z"
        stroke={variant === 'plate' ? glyph : plate}
        strokeWidth={4.5}
        strokeLinejoin="round"
        fill="none"
      />

      {/* The flap read as a rising trend line. */}
      <Path
        d="M28 34l14-12 12 9 18-15"
        stroke={variant === 'plate' ? glyph : plate}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M64 16h10v10"
        stroke={variant === 'plate' ? glyph : plate}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
