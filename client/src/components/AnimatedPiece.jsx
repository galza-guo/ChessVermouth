import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { icons } from '../assets';

function AnimatedPiece({ piece, from, to }) {
  const fromSquare = document.querySelector(`[data-square=${from}]`);
  const toSquare = document.querySelector(`[data-square=${to}]`);

  if (!fromSquare || !toSquare) {
    return null;
  }

  const fromRect = fromSquare.getBoundingClientRect();
  const toRect = toSquare.getBoundingClientRect();
  const boardRect = document.getElementById('board').getBoundingClientRect();

  const [style, setStyle] = useState({
    position: 'absolute',
    left: fromRect.left - boardRect.left,
    top: fromRect.top - boardRect.top,
    width: fromRect.width,
    height: fromRect.height,
    transition: 'transform 200ms ease-in-out',
    zIndex: 50,
  });

  useEffect(() => {
    setStyle((s) => ({
      ...s,
      transform: `translate(${toRect.left - fromRect.left}px, ${toRect.top - fromRect.top}px)`,
    }));
  }, [from, to]);

  if (!piece) {
    return null;
  }

  return (
    <div style={style}>
      <img
        src={icons[`${piece.color}${piece.type}`]}
        className='m-auto h-[90%] w-[90%]'
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