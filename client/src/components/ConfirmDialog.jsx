import PropTypes from 'prop-types'

const ConfirmDialog = ({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) => {
  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onCancel?.()
  }

  return (
    <div className="promotion-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={onOverlayClick}>
      <div className="promotion-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="promotion-header">
          <h3 id="confirm-title">{title}</h3>
        </div>
        <div className="mb-4 text-zinc-200 text-sm leading-relaxed">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>
        <div className="promotion-footer flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>{cancelText}</button>
          <button className="btn-danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}

ConfirmDialog.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
}

export default ConfirmDialog

