interface SealProps {
  /**
   * Simplified Chinese glyphs. Every glyph used must be in the Ma Shan Zheng
   * subset requested in index.html, or it falls back to a system font.
   */
  text: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'cinnabar' | 'ink' | 'ochre';
  className?: string;
}

const TONES = { cinnabar: '', ink: 'seal-ink', ochre: 'seal-ochre' } as const;

/** A carved seal stamp, the wuxia accent of the viewer page. Purely decorative, so screen readers skip it. */
export function Seal({ text, size = 'sm', tone = 'cinnabar', className = '' }: SealProps) {
  return (
    <span aria-hidden='true' className={`seal seal-${size} ${TONES[tone]} ${className}`}>
      {text}
    </span>
  );
}
