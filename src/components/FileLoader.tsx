import { useRef } from 'react'

interface FileLoaderProps {
  onLoadFile: (file: File) => void
  label?: string
  big?: boolean
}

export function FileLoader({ onLoadFile, label = 'Load .mid', big }: FileLoaderProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        className={`btn primary${big ? ' big' : ''}`}
        onClick={() => fileRef.current?.click()}
      >
        {label}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".mid,.midi,audio/midi,audio/x-midi"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onLoadFile(f)
          e.target.value = ''
        }}
      />
    </>
  )
}
