import { useRef } from 'react';
import toast from 'react-hot-toast';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Download } from 'lucide-react';
import { Asset } from '../lib/types';
import { Button } from './ui';

/** Scannable QR for an asset, with copy + PNG download affordances. */
export function AssetQr({ asset, size = 128 }: { asset: Asset; size?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const label = asset.qrCode ?? asset.assetTag;
  // The QR encodes a deep link to this asset's detail page, so scanning the
  // printed label with any phone camera opens the asset directly. The
  // human-readable token below is still shown/copied for manual search.
  const value = `${window.location.origin}/assets/${asset.id}`;

  const copy = async () => {
    await navigator.clipboard.writeText(label);
    toast.success('Asset tag copied');
  };

  const download = () => {
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${asset.assetTag}-qr.png`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={wrapRef} className="rounded-lg border border-surface-border bg-white p-3">
        <QRCodeCanvas value={value} size={size} marginSize={1} />
      </div>
      <p className="font-mono text-[13px] tabular-nums text-ink-800">{label}</p>
      {!asset.qrCode && (
        <p className="text-xs text-ink-400">No QR code stored yet — showing the asset tag instead.</p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={copy}><Copy className="h-3.5 w-3.5" /> Copy value</Button>
        <Button variant="secondary" size="sm" onClick={download}><Download className="h-3.5 w-3.5" /> Download PNG</Button>
      </div>
    </div>
  );
}
