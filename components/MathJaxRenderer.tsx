import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    MathJax: {
      // FIX: Unify MathJax type definition, making methods optional.
      typeset?: () => void;
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
    };
  }
}

interface MathJaxRendererProps {
  content: string;
}

const MathJaxRenderer: React.FC<MathJaxRendererProps> = ({ content }) => {
  const containerRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (containerRef.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([containerRef.current]).catch((err) =>
        console.error('MathJax typesetting failed:', err)
      );
    }
  }, [content]);

  return <p ref={containerRef}>{content}</p>;
};

export default MathJaxRenderer;
