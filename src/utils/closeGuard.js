// Keep the decision logic independent of native dialogs so races and failures
// can be regression-tested without closing a real window or writing files.
export function createCloseGuard({ isDirty, snapshot, save, waitForPendingSaves, choose, close, reportError }) {
  let pending = false
  return async function onCloseRequested(event) {
    event.preventDefault()
    if (pending) return
    pending = true
    try {
      await waitForPendingSaves()
      if (isDirty()) {
        const before = snapshot()
        const choice = await choose()
        const after = snapshot()
        if (before.documentId !== after.documentId || before.content !== after.content) return
        if (choice === 'save') {
          if (!await save() || isDirty()) return
        } else if (choice !== 'discard') {
          return
        }
      }
      await close()
    } catch (error) {
      reportError(error)
    } finally {
      pending = false
    }
  }
}
