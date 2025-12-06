import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import PropTypes from 'prop-types';


function AnimatedPiece({ piece, from, to, icons }) {
  const [style, setStyle] = useState(null);
  const hasAnimated = useRef(false);

  useLayoutEffect(() => {
    if (hasAnimated.current) return;
    
    const fromSquare = document.querySelector(`[data-square="${from}"]`);
    const toSquare = document.querySelector(`[data-square="${to}"]`);

    if (!fromSquare || !toSquare || !piece) {
      return;
    }

    const fromRect = fromSquare.getBoundingClientRect();
    const toRect = toSquare.getBoundingClientRect();

    // Set initial position using fixed coordinates (viewport-relative)
    setStyle({
      position: 'fixed',
      left: fromRect.left,
      top: fromRect.top,
      width: fromRect.width,
      height: fromRect.height,
      zIndex: 9999,
      pointerEvents: 'none',
      transition: 'none',
    });

    // Trigger animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setStyle((s) => ({
          ...s,
          left: toRect.left,
          top: toRect.top,
          transition: 'left 200ms ease-in-out, top 200ms ease-in-out',
        }));
        hasAnimated.current = true;
      });
    });
  }, [from, to, piece]);

  if (!style || !piece || !icons) {
    return null;
  }

  const iconKey = `${piece.color}${piece.type}`;
  const iconSrc = icons[iconKey];

  if (!iconSrc) {
    return null;
  }

  return (
    <div style={style}>
      <img
        src={iconSrc}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  );
}

AnimatedPiece.propTypes = {
  piece: PropTypes.object,
  from: PropTypes.string,
  to: PropTypes.string,
  icons: PropTypes.object,
};

export default AnimatedPiece;