import React, { useEffect, useRef, useState, useMemo } from 'react';

interface IsolatedEmailPreviewProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
  autoHeight?: boolean;
  minHeight?: number | string;
  maxHeight?: number | string;
  title?: string;
  canvasBackground?: string;
}

export const IsolatedEmailPreview: React.FC<IsolatedEmailPreviewProps> = ({
  html,
  className = '',
  style = {},
  autoHeight = true,
  minHeight = 80,
  maxHeight,
  title = 'Email Preview',
  canvasBackground = 'transparent',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(
    typeof minHeight === 'number' ? minHeight : 200
  );

  // Build the self-contained HTML document
  const srcDoc = useMemo(() => {
    const raw = html || '<div style="color:#94a3b8;font-family:sans-serif;font-size:12px;padding:12px;">No email content</div>';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <base target="_blank" />
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background-color: ${canvasBackground};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      word-break: break-word;
      overflow-x: hidden;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    /* Sleek slim modern scrollbars inside the iframe */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.4);
      border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(100, 116, 139, 0.6);
    }
  </style>
</head>
<body>
  ${raw}
</body>
</html>`;
  }, [html, canvasBackground]);

  // Handle dynamic height calculation
  const updateHeight = () => {
    if (!autoHeight || !iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc) return;
      const body = doc.body;
      const htmlEl = doc.documentElement;
      if (body && htmlEl) {
        const height = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          htmlEl.clientHeight,
          htmlEl.scrollHeight
        );
        if (height > 0) {
          setContentHeight(height);
        }
      }
    } catch {
      // Ignored if cross-origin or sandbox limits
    }
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !autoHeight) return;

    let resizeObserver: ResizeObserver | null = null;

    const handleLoad = () => {
      updateHeight();
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.body && typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            updateHeight();
          });
          resizeObserver.observe(doc.body);
        }
      } catch {
        // Fallback
      }
    };

    iframe.addEventListener('load', handleLoad);

    // Initial check in case it's already loaded
    updateHeight();

    return () => {
      iframe.removeEventListener('load', handleLoad);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [srcDoc, autoHeight]);

  // Compute final inline styles
  const iframeStyle: React.CSSProperties = {
    width: '100%',
    border: 'none',
    display: 'block',
    background: 'transparent',
    ...(autoHeight ? { height: `${contentHeight}px` } : { height: '100%' }),
    ...(minHeight ? { minHeight } : {}),
    ...(maxHeight ? { maxHeight } : {}),
    ...style,
  };

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      title={title}
      className={className}
      style={iframeStyle}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  );
};

export default IsolatedEmailPreview;
