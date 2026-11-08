import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onConfirmCrop: (croppedDataUrl: string) => void;
  onConfirmOriginal: (originalDataUrl: string) => void;
  onCancel: () => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onConfirmCrop,
  onConfirmOriginal,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Rotation in 90-deg increments: 0, 90, 180, 270
  const [rotation, setRotation] = useState<number>(0);

  // Crop box in relative percentage (0 to 100)
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 8,
    y: 10,
    w: 84,
    h: 80,
  });

  // Active interaction drag state
  const dragModeRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; crop: typeof crop }>({
    clientX: 0,
    clientY: 0,
    crop: { x: 8, y: 10, w: 84, h: 80 },
  });

  // Reset when opening with new image
  useEffect(() => {
    if (isOpen) {
      setRotation(0);
      setCrop({ x: 8, y: 10, w: 84, h: 80 });
    }
  }, [isOpen, imageSrc]);

  const handlePointerDown = (mode: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    dragModeRef.current = mode;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      crop: { ...crop },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragModeRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dx = ((e.clientX - dragStartRef.current.clientX) / rect.width) * 100;
    const dy = ((e.clientY - dragStartRef.current.clientY) / rect.height) * 100;
    const init = dragStartRef.current.crop;
    const mode = dragModeRef.current;

    let newX = init.x;
    let newY = init.y;
    let newW = init.w;
    let newH = init.h;

    const MIN_SIZE = 15; // Minimum 15% width/height

    if (mode === 'move') {
      newX = Math.max(0, Math.min(100 - init.w, init.x + dx));
      newY = Math.max(0, Math.min(100 - init.h, init.y + dy));
    } else {
      if (mode.includes('n')) {
        const topY = Math.min(init.y + init.h - MIN_SIZE, Math.max(0, init.y + dy));
        newH = init.y + init.h - topY;
        newY = topY;
      }
      if (mode.includes('s')) {
        newH = Math.max(MIN_SIZE, Math.min(100 - init.y, init.h + dy));
      }
      if (mode.includes('w')) {
        const leftX = Math.min(init.x + init.w - MIN_SIZE, Math.max(0, init.x + dx));
        newW = init.x + init.w - leftX;
        newX = leftX;
      }
      if (mode.includes('e')) {
        newW = Math.max(MIN_SIZE, Math.min(100 - init.x, init.w + dx));
      }
    }

    setCrop({ x: newX, y: newY, w: newW, h: newH });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragModeRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    dragModeRef.current = null;
  };

  const rotateClockwise = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const performCropAndSubmit = () => {
    if (!imgRef.current) {
      onConfirmOriginal(imageSrc);
      return;
    }

    const sourceImg = new Image();
    sourceImg.crossOrigin = 'anonymous';
    sourceImg.onload = () => {
      // 1. Create temporary canvas for rotation
      const rotCanvas = document.createElement('canvas');
      const rotCtx = rotCanvas.getContext('2d');
      if (!rotCtx) {
        onConfirmOriginal(imageSrc);
        return;
      }

      const isRotated90or270 = rotation === 90 || rotation === 270;
      rotCanvas.width = isRotated90or270 ? sourceImg.height : sourceImg.width;
      rotCanvas.height = isRotated90or270 ? sourceImg.width : sourceImg.height;

      rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rotCtx.rotate((rotation * Math.PI) / 180);
      rotCtx.drawImage(sourceImg, -sourceImg.width / 2, -sourceImg.height / 2);

      // 2. Crop from rotated canvas
      const cropPxX = Math.round((crop.x / 100) * rotCanvas.width);
      const cropPxY = Math.round((crop.y / 100) * rotCanvas.height);
      const cropPxW = Math.round((crop.w / 100) * rotCanvas.width);
      const cropPxH = Math.round((crop.h / 100) * rotCanvas.height);

      const targetCanvas = document.createElement('canvas');
      targetCanvas.width = Math.max(1, cropPxW);
      targetCanvas.height = Math.max(1, cropPxH);
      const targetCtx = targetCanvas.getContext('2d');

      if (!targetCtx) {
        onConfirmOriginal(imageSrc);
        return;
      }

      targetCtx.drawImage(
        rotCanvas,
        cropPxX,
        cropPxY,
        cropPxW,
        cropPxH,
        0,
        0,
        cropPxW,
        cropPxH
      );

      const croppedBase64 = targetCanvas.toDataURL('image/jpeg', 0.92);
      onConfirmCrop(croppedBase64);
    };

    sourceImg.onerror = () => {
      onConfirmOriginal(imageSrc);
    };

    sourceImg.src = imageSrc;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 select-none animate-fadeIn">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between text-white pb-3 pt-1 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">crop</span>
          <span className="font-extrabold text-sm sm:text-base">Soruyu Kırp & Odakla</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Rotate 90 button */}
          <button
            type="button"
            onClick={rotateClockwise}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Fotoğrafı 90° Döndür"
          >
            <span className="material-symbols-outlined text-base">rotate_right</span>
            <span className="hidden sm:inline">Döndür</span>
          </button>

          {/* Close / Cancel */}
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white transition-all cursor-pointer"
            title="İptal Et / Yeniden Çek"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>

      {/* Main Image Cropping Work Area */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0 relative overflow-hidden">
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative max-w-full max-h-[65vh] flex items-center justify-center touch-none select-none rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        >
          {/* Base Image */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Kırpılacak Soru"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease-out',
            }}
            className="max-h-[65vh] max-w-full object-contain pointer-events-none block"
          />

          {/* Semi-transparent dark overlay around crop area */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6))`,
              clipPath: `polygon(
                0% 0%, 100% 0%, 100% 100%, 0% 100%,
                0% ${crop.y}%,
                ${crop.x}% ${crop.y}%,
                ${crop.x}% ${crop.y + crop.h}%,
                ${crop.x + crop.w}% ${crop.y + crop.h}%,
                ${crop.x + crop.w}% ${crop.y}%,
                0% ${crop.y}%
              )`,
            }}
          />

          {/* Interactive Crop Rectangle */}
          <div
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.w}%`,
              height: `${crop.h}%`,
            }}
            className="absolute border-2 border-primary shadow-[0_0_0_1px_rgba(255,255,255,0.7)] cursor-move touch-none"
            onPointerDown={(e) => handlePointerDown('move', e)}
          >
            {/* Grid Lines inside crop box for precise alignment */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-white" />
              <div className="border-r border-white" />
              <div />
            </div>

            {/* Corner Resize Handles */}
            {/* NW */}
            <div
              className="absolute -top-2.5 -left-2.5 w-6 h-6 bg-primary border-2 border-white rounded-full cursor-nwse-resize touch-none shadow-md"
              onPointerDown={(e) => handlePointerDown('nw', e)}
            />
            {/* NE */}
            <div
              className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-primary border-2 border-white rounded-full cursor-nesw-resize touch-none shadow-md"
              onPointerDown={(e) => handlePointerDown('ne', e)}
            />
            {/* SW */}
            <div
              className="absolute -bottom-2.5 -left-2.5 w-6 h-6 bg-primary border-2 border-white rounded-full cursor-nesw-resize touch-none shadow-md"
              onPointerDown={(e) => handlePointerDown('sw', e)}
            />
            {/* SE */}
            <div
              className="absolute -bottom-2.5 -right-2.5 w-6 h-6 bg-primary border-2 border-white rounded-full cursor-nwse-resize touch-none shadow-md"
              onPointerDown={(e) => handlePointerDown('se', e)}
            />

            {/* Center Drag Hint */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
              <span className="material-symbols-outlined text-white text-2xl drop-shadow">drag_pan</span>
            </div>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-center text-[11px] text-white/70 py-1">
        💡 Köşelerden tutup çekerek sadece sorunun olduğu alanı seçin.
      </p>

      {/* Bottom Action Buttons */}
      <div className="flex items-center gap-2.5 pt-2 border-t border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => onConfirmOriginal(imageSrc)}
          className="flex-1 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
        >
          <span className="material-symbols-outlined text-base">photo_library</span>
          <span>Tümünü Gönder</span>
        </button>

        <button
          type="button"
          onClick={performCropAndSubmit}
          className="flex-[2] py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-primary/30"
        >
          <span className="material-symbols-outlined text-lg">crop</span>
          <span>Kırp & Çözüme Başla</span>
        </button>
      </div>
    </div>
  );
};
