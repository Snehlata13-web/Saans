import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'

// Soft round sprite for particles
function useDot() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r; g.fillRect(0, 0, 64, 64)
    const t = new THREE.CanvasTexture(c)
    return t
  }, [])
}

function Smog({ color, density }) {
  const ref = useRef()
  const mat = useRef()
  const dot = useDot()
  const N = 2200
  const { pos, spd } = useMemo(() => {
    const pos = new Float32Array(N * 3), spd = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 34
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2
      spd[i] = 0.2 + Math.random() * 0.8
    }
    return { pos, spd }
  }, [])
  const target = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock, pointer }, dt) => {
    const a = ref.current.geometry.attributes.position
    const t = clock.elapsedTime
    const shown = Math.floor(N * density)
    ref.current.geometry.setDrawRange(0, shown)
    for (let i = 0; i < shown; i++) {
      a.array[i * 3] += dt * 0.25 * spd[i]
      a.array[i * 3 + 1] += Math.sin(t * 0.3 + i) * dt * 0.08
      if (a.array[i * 3] > 17) a.array[i * 3] = -17
    }
    a.needsUpdate = true
    ref.current.rotation.y += (pointer.x * 0.12 - ref.current.rotation.y) * 0.03
    ref.current.rotation.x += (-pointer.y * 0.08 - ref.current.rotation.x) * 0.03
    target.set(color)
    mat.current.color.lerp(target, 0.02)
  })
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} /></bufferGeometry>
      <pointsMaterial ref={mat} map={dot} size={0.12} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  )
}

export default function Backdrop({ color = '#2ee59d', aqi = 50 }) {
  const density = Math.min(1, 0.18 + (aqi || 0) / 260)
  return (
    <div className="backdrop">
      <Canvas camera={{ position: [0, 0, 9], fov: 60 }} dpr={1} gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}>
        <Smog color={color} density={density} />
        <Sparkles count={70} scale={[26, 14, 6]} size={3.5} speed={0.35} color="#ffc66b" opacity={0.9} />
      </Canvas>
    </div>
  )
}
