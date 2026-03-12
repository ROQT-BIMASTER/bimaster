

## Problems Identified

There are **two distinct issues** the user is experiencing:

### 1. Recording stops when navigating away from the page
The `MeetingRecorder` component uses `MediaRecorder` with browser's `getUserMedia`. When the user navigates to another page in the SPA, React unmounts the component and the `useEffect` cleanup (line 29-34) explicitly stops all tracks. This is by design in the current code -- but it means the recording is lost if the user hasn't clicked "Parar" first.

### 2. AI analysis error on the recording
This likely stems from the recording being incomplete/corrupted (because navigation stopped it abruptly), or the meeting status being stuck in "recording" without a valid `audio_url`.

## Plan

### Task 1: Persist recording across page navigation
- Move the `MediaRecorder` logic out of the component lifecycle into a **global singleton** (e.g., a context or a module-level ref) so that navigating away doesn't destroy the recording session.
- Create a `MeetingRecordingContext` provider that:
  - Holds `MediaRecorder`, stream, chunks, and timer refs at app level
  - Exposes `startRecording(meetingId)`, `stopRecording()`, `pauseRecording()`, `resumeRecording()`, `uploadRecording()` methods
  - Tracks `isRecording`, `isPaused`, `duration`, `activeMeetingId` state
- Wrap the app with this provider inside `DashboardLayout` or `App.tsx`

### Task 2: Show a persistent recording indicator
- Add a floating "recording bar" component (fixed at bottom or top) visible on **all pages** while a recording is active
- Shows timer, pause/stop buttons, and meeting name
- Clicking it navigates back to the meeting detail page
- This prevents accidental loss -- user always sees the recording is active

### Task 3: Auto-save on accidental navigation (safety net)
- Add a `beforeunload` event listener to warn the user if they try to close the browser tab while recording
- On route change detection (via `react-router`), if recording is active:
  - Auto-stop the recording
  - Auto-upload the chunks collected so far
  - Show a toast: "Gravação salva automaticamente"

### Task 4: Fix stuck meeting status recovery
- When the meeting has `status: "recording"` but no `audio_url` and the user returns, show a clear message: "A gravação anterior foi interrompida" and reset status to `draft` so they can try again or upload a file
- This is a minor fix in `ReuniaoDetalhe.tsx`

### Technical Details

**Files to create:**
- `src/contexts/MeetingRecordingContext.tsx` -- global recording state manager

**Files to modify:**
- `src/components/meetings/MeetingRecorder.tsx` -- consume context instead of local state
- `src/components/dashboard/DashboardLayout.tsx` -- add floating recording indicator
- `src/pages/ReuniaoDetalhe.tsx` -- handle stuck "recording" status recovery
- `src/App.tsx` or layout wrapper -- add the `MeetingRecordingProvider`

