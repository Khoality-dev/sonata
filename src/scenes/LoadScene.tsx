import { FileLoader } from '../components/FileLoader'

interface LoadSceneProps {
  onLoadFile: (file: File) => void
  loadError: string | null
}

export function LoadScene({ onLoadFile, loadError }: LoadSceneProps) {
  return (
    <div className="scene load-scene">
      <div className="welcome-card">
        <div className="step-pill">Step 1 of 3 · Choose a file</div>
        <h2>Pick a MIDI file</h2>
        <p>Drop in a <code>.mid</code> file. The next step lets you assign hands per track and choose Listen/Practice modes before you play.</p>
        <div className="welcome-actions">
          <FileLoader onLoadFile={onLoadFile} big label="Load .mid file" />
        </div>
        {loadError && <div className="error">Failed to load: {loadError}</div>}
        <p className="hint">Supports any standard SMF (.mid / .midi).</p>
      </div>
    </div>
  )
}
