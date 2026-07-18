type CrashAlertModalProps = {
  open: boolean
  onClose: () => void
}

export function CrashAlertModal({ open, onClose }: CrashAlertModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-red-300/50 bg-slate-950 p-5 shadow-glass">
        <h3 className="text-lg font-bold text-red-300">낙차 감지 경고</h3>
        <p className="mt-2 text-sm text-slate-200">
          가속도 센서에서 강한 충격이 감지되었습니다. 라이더 상태를 확인하고 필요 시 주변에 도움을 요청하세요.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white"
        >
          확인
        </button>
      </div>
    </div>
  )
}
