import PropTypes from 'prop-types'

function formatWhen(iso) {
  try {
    const d = new Date(iso)
    const now = Date.now()
    const diffMs = Math.max(0, now - d.getTime())
    const dayMs = 24 * 60 * 60 * 1000
    if (diffMs < dayMs) {
      const seconds = Math.floor(diffMs / 1000)
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      const parts = []
      if (hours > 0) parts.push(`${hours}h`)
      if (minutes > 0) parts.push(`${minutes}min`)
      parts.push(`${secs}sec ago`)
      return parts.join(' ')
    }
    return d.toLocaleString()
  } catch (_) { return iso || '' }
}

const ResumeDialog = ({ game, onResume, onDiscard, onStartNew }) => {
  if (!game) return null
  const { id, createdAt, updatedAt, moves, clocks } = game
  return (
    <div className="promotion-overlay" role="dialog" aria-modal="true" aria-labelledby="resume-title">
      <div className="promotion-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="promotion-header">
          <h3 id="resume-title">Unfinished Game Found</h3>
        </div>
        <div className="mb-4 text-zinc-200 text-sm leading-relaxed space-y-2">
          <p>Started: {formatWhen(createdAt)} | Last Played: {formatWhen(updatedAt)}</p>
          <p>Moves: {moves} | Time: {Math.floor((clocks?.whiteMs||0)/60000)}m W / {Math.floor((clocks?.blackMs||0)/60000)}m B</p>
          <p className='text-zinc-400'>Resume to continue; or discard to remove it from this device&apos;s server.</p>
          <p className='text-xs text-zinc-500'>Game ID: <span className='font-mono'>{id}</span></p>
        </div>
        <div className="promotion-footer flex justify-end gap-2">
          <button className="btn-secondary" onClick={onStartNew}>Start New</button>
          <button className="btn-danger" onClick={onDiscard}>Discard</button>
          <button className="btn-primary" onClick={onResume}>Resume</button>
        </div>
      </div>
    </div>
  )
}

ResumeDialog.propTypes = {
  game: PropTypes.shape({ id: PropTypes.string, createdAt: PropTypes.string, updatedAt: PropTypes.string, moves: PropTypes.number, clocks: PropTypes.object }),
  onResume: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
  onStartNew: PropTypes.func.isRequired,
}

export default ResumeDialog
