'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

/* Client-only: los shaders WebGL no corren en SSR. */
const Grainient = dynamic(() => import('@/components/brand/Grainient'), { ssr: false })

/* El fondo estándar del portal (GRAINIENT_PRESET + tono abi), portado tal
   cual: misma forma del gradiente, mismos colores de la sub-marca. */
const PRESET = {
  timeSpeed: 0.3,
  colorBalance: 0.01,
  warpStrength: 1.0,
  warpFrequency: 5.4,
  warpSpeed: 2.3,
  warpAmplitude: 50.0,
  blendAngle: -8,
  blendSoftness: 0.05,
  rotationAmount: 500.0,
  noiseScale: 2.2,
  grainAmount: 0.15,
  grainScale: 4.3,
  grainAnimated: false,
  contrast: 1.5,
  gamma: 1.0,
  saturation: 1.05,
  centerX: 0.0,
  centerY: 0.0,
  zoom: 0.9,
  color1: '#5a580e',
  color2: '#e3dc2c',
  color3: '#424003',
} as const

export function TenantStage({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative min-h-[100dvh] bg-black">
      <div
        aria-hidden
        className={`fixed inset-0 z-0 bg-black transition-opacity duration-1000 ease-out ${shown ? 'opacity-100' : 'opacity-0'}`}
      >
        <Grainient {...PRESET} onReady={() => setShown(true)} />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  )
}
