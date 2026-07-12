import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Button, Field, Input, Modal } from './ui';

// The Web BarcodeDetector API is not in TypeScript's DOM lib yet; declare the
// minimal surface we use. Supported in Chromium browsers / Android; when it's
// missing we fall back to manual tag entry so the feature still works.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts?: { formats?: string[] }): BarcodeDetectorLike;
    };
  }
}

/**
 * Camera QR scanner in a modal. On a successful decode it calls onDetect with
 * the raw QR value (a detail-page URL for our labels, but any string works).
 * Falls back to a manual text field if the browser lacks BarcodeDetector or
 * camera permission is denied.
 */
export function QrScanner({ onDetect, onClose }: { onDetect: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manual, setManual] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const Detector = window.BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setNote("Live scanning isn't supported in this browser — enter the tag manually.");
      setManual(true);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    const detector = new Detector({ formats: ['qr_code'] });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = async () => {
          if (cancelled) return;
          try {
            const codes = await detector.detect(video);
            const hit = codes.find((c) => c.rawValue);
            if (hit) {
              onDetect(hit.rawValue);
              return; // parent closes the scanner
            }
          } catch {
            /* transient decode error — keep scanning */
          }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch {
        setNote('Camera access was blocked — enter the tag manually.');
        setManual(true);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetect]);

  const submitManual = () => {
    const v = manualValue.trim();
    if (v) onDetect(v);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Scan asset QR"
      subtitle="Point the camera at the QR label on the physical asset."
      size="sm"
      footer={<Button variant="secondary" onClick={onClose}>Cancel</Button>}
    >
      {!manual ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-lg border border-surface-border bg-ink-950">
            <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-0 m-auto h-40 w-40 rounded-lg border-2 border-white/70" />
          </div>
          <button
            onClick={() => setManual(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-accent-600 transition-colors hover:text-accent-700"
          >
            <Keyboard className="h-3.5 w-3.5" /> Enter tag manually
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {note && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">{note}</p>}
          <Field label="Asset tag or QR value">
            <Input
              autoFocus
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }}
              placeholder="e.g. AF-0001"
            />
          </Field>
          <Button onClick={submitManual}>Find asset</Button>
        </div>
      )}
    </Modal>
  );
}
