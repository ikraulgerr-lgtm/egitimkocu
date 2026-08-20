import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { normalizeLatexMath } from '../lib/mathUtils';

interface FormattedMathTextProps {
  text: string | undefined | null;
  className?: string;
  block?: boolean;
}

/**
 * Renders inline math, block math, and rich structured formatting
 * (bold text, section callouts, bullet lists, clean paragraph breaks).
 */
export const FormattedMathText: React.FC<FormattedMathTextProps> = ({ text, className = '', block = false }) => {
  if (!text) return null;

  try {
    const rawText = normalizeLatexMath(String(text));

    // If block mode explicitly requested or string starts/ends with $$ or \[
    if (block || /^\$\$.*\$\$$/s.test(rawText.trim()) || /^\\\[.*\\\]$/s.test(rawText.trim())) {
      const cleanMath = rawText.trim().replace(/^\$\$|\$\$$|^\\\[|\\\]$/g, '').trim();
      return (
        <div className={`my-2 overflow-x-auto ${className}`}>
          <BlockMath math={cleanMath} renderError={() => <span>{rawText}</span>} />
        </div>
      );
    }

    // Render LaTeX math inside a string fragment safely
    const renderMathContent = (content: string, keyPrefix: string): React.ReactNode => {
      try {
        const hasLatex = /\\(?:frac|cdot|times|div|sqrt|sum|int|lim|vec|alpha|beta|theta|pi|le|ge|neq|approx|pm)|[\$]/i.test(content);
        if (!hasLatex) return content;

        const mathRegex = /(\$\$.*?\$\$|\$.*?\$|\\(?:frac|sqrt)\{[^{}]*\}\{[^{}]*\}|\\(?:frac|sqrt)\{[^{}]*\}|\\(?:cdot|times|div|pm|le|ge|neq)\b)/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = mathRegex.exec(content)) !== null) {
          if (match.index > lastIndex) {
            parts.push(content.substring(lastIndex, match.index));
          }
          const matchedStr = match[0];
          let formula = matchedStr;
          if (formula.startsWith('$$') && formula.endsWith('$$')) {
            formula = formula.slice(2, -2).trim();
          } else if (formula.startsWith('$') && formula.endsWith('$')) {
            formula = formula.slice(1, -1).trim();
          }

          parts.push(
            <InlineMath key={`${keyPrefix}_m_${match.index}`} math={formula} renderError={() => <span>{matchedStr}</span>} />
          );
          lastIndex = match.index + Math.max(1, matchedStr.length);
        }

        if (lastIndex < content.length) {
          parts.push(content.substring(lastIndex));
        }
        return parts.length > 0 ? parts : content;
      } catch {
        return content;
      }
    };

    // Render bolding (**text**) and math
    const renderFormattedLine = (lineStr: string, keyPrefix: string): React.ReactNode => {
      try {
        if (!lineStr.includes('**')) {
          return renderMathContent(lineStr, keyPrefix);
        }

        const boldParts = lineStr.split(/(\*\*.*?\*\*)/g);

        return boldParts.map((part, idx) => {
          const isBold = part.startsWith('**') && part.endsWith('**') && part.length > 4;
          const content = isBold ? part.slice(2, -2) : part;
          const mathNode = renderMathContent(content, `${keyPrefix}_${idx}`);

          if (isBold) {
            return (
              <strong key={`${keyPrefix}_bold_${idx}`} className="font-black text-primary dark:text-indigo-300">
                {mathNode}
              </strong>
            );
          }
          return <React.Fragment key={`${keyPrefix}_text_${idx}`}>{mathNode}</React.Fragment>;
        });
      } catch {
        return lineStr;
      }
    };

    // Split into lines for structured layout
    const lines = rawText.split(/\r?\n/);

    return (
      <div className={`space-y-2 leading-relaxed break-words [word-break:break-word] overflow-hidden min-w-0 max-w-full ${className}`}>
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={`empty_${lIdx}`} className="h-1" />;
          }

          // Section Headers (### or emoji headers 🎯, 📌, ✍️, 💡, 🔍, ✅, 👉, Adım)
          if (
            trimmed.startsWith('#') ||
            /^(?:🎯|📌|✍️|💡|🔍|✅|👉|ADIM\s+\d+|Adım\s+\d+|Adım:\s*)/i.test(trimmed)
          ) {
            const headerClean = trimmed.replace(/^#+\s*/, '');
            return (
              <div
                key={`h_${lIdx}`}
                className="font-black text-sm sm:text-base text-primary dark:text-indigo-300 mt-3 mb-1.5 flex items-center gap-1.5 bg-primary/10 dark:bg-primary/20 px-3.5 py-2 rounded-xl border-l-4 border-primary shadow-2xs break-words [word-break:break-word] min-w-0 max-w-full overflow-hidden"
              >
                {renderFormattedLine(headerClean, `h_${lIdx}`)}
              </div>
            );
          }

          // Bullet list item (- item, * item, 1. item)
          if (/^[-*•]\s+/.test(trimmed) || /^\d+[\.\)]\s+/.test(trimmed)) {
            const isNumbered = /^\d+[\.\)]\s+/.test(trimmed);
            const numMatch = trimmed.match(/^(\d+)[\.\)]\s+/);
            const listContent = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+[\.\)]\s+/, '');

            return (
              <div key={`li_${lIdx}`} className="flex items-start gap-2.5 pl-1.5 sm:pl-2 my-1 text-sm sm:text-base min-w-0 max-w-full overflow-hidden">
                <span className="font-extrabold text-primary shrink-0 select-none mt-0.5 text-sm sm:text-base">
                  {isNumbered ? `${numMatch?.[1]}.` : '•'}
                </span>
                <div className="flex-1 text-text-main font-medium leading-relaxed break-words [word-break:break-word] min-w-0 max-w-full overflow-hidden">
                  {renderFormattedLine(listContent, `li_${lIdx}`)}
                </div>
              </div>
            );
          }

          // Normal paragraph line
          return (
            <p key={`p_${lIdx}`} className="text-sm sm:text-base leading-relaxed text-text-main font-medium break-words [word-break:break-word] min-w-0 max-w-full overflow-hidden">
              {renderFormattedLine(trimmed, `p_${lIdx}`)}
            </p>
          );
        })}
      </div>
    );
  } catch (err) {
    console.error('FormattedMathText render fallback error:', err);
    return <span className={className}>{String(text)}</span>;
  }
};
