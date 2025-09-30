import PropTypes from 'prop-types'
import { wq, wr, wb, wn, bq, br, bb, bn } from '../assets'

const PromotionDialog = ({ square, color, onPromote, onCancel }) => {
  const pieces = [
    { type: 'q', name: 'Queen', icon: color === 'w' ? wq : bq },
    { type: 'r', name: 'Rook', icon: color === 'w' ? wr : br },
    { type: 'b', name: 'Bishop', icon: color === 'w' ? wb : bb },
    { type: 'n', name: 'Knight', icon: color === 'w' ? wn : bn }
  ]

  const handlePieceClick = (pieceType) => {
    onPromote(pieceType)
  }

  return (
    <div className="promotion-overlay">
      <div className="promotion-dialog">
        <div className="promotion-header">
          <h3>Pawn Promotion</h3>
          <p>Choose a piece to promote your pawn at {square}:</p>
        </div>
        
        <div className="promotion-options">
          {pieces.map((piece) => (
            <button
              key={piece.type}
              className="promotion-piece"
              onClick={() => handlePieceClick(piece.type)}
              title={`Promote to ${piece.name}`}
            >
              <img src={piece.icon} alt={piece.name} className="piece-icon" />
              <span className="piece-name">{piece.name}</span>
            </button>
          ))}
        </div>
        
        <div className="promotion-footer">
          <button className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

PromotionDialog.propTypes = {
  square: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  onPromote: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
}

export default PromotionDialog