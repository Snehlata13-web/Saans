import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

// A breathing "air sample" — particle density scales with live PM2.5
function Particles({ count, color }) {
  const ref = useRef()
  const { pos, seed } = useMemo(() => {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = 1.25 * Math.cbrt(Math.random())
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1)
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], i * 3)
      seed[i] = Math.random() * 100
    }
    return { pos, seed }
  }, [count])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const a = ref.current.geometry.attributes.position
    for (let i = 0; i < count; i++) {
      const s = seed[i]
      a.array[i * 3] = pos[i * 3] + Math.sin(t * 0.6 + s) * 0.06
      a.array[i * 3 + 1] = pos[i * 3 + 1] + Math.cos(t * 0.5 + s * 1.3) * 0.06
      a.array[i * 3 + 2] = pos[i * 3 + 2] + Math.sin(t * 0.4 + s * 0.7) * 0.06
    }
    a.needsUpdate = true
    ref.current.rotation.y = t * 0.08
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos.slice(), 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color={color} transparent opacity={0.95} sizeAttenuation toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  )
}

function Breather({ color, pm }) {
  const g = useRef()
  useFrame(({ clock }) => {
    // 4s inhale / 4s exhale
    const s = 1 + Math.sin((clock.elapsedTime * Math.PI) / 4) * 0.07
    g.current.scale.setScalar(s)
  })
  const count = Math.round(Math.min(2600, Math.max(40, (pm || 0) * 14)))
  return (
    <group ref={g}>
      <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.6}>
        <mesh>
          <sphereGeometry args={[1.45, 64, 64]} />
          <MeshDistortMaterial color={color} distort={0.18} speed={1.6} transparent opacity={0.13} roughness={0.1} metalness={0.2} emissive={color} emissiveIntensity={0.25} />
        </mesh>
        <mesh>
          <torusGeometry args={[1.75, 0.008, 16, 160]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.3, 0.3, 0]}>
          <torusGeometry args={[1.95, 0.005, 16, 160]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
        </mesh>
        <Particles key={count} count={count} color={color} />
      </Float>
    </group>
  )
}

export default function BreathOrb({ color = '#2ee59d', pm = 10, height = 340 }) {
  return (
    <div style={{ height, width: '100%' }}>
      <Canvas camera={{ position: [0, 0, 5.2], fov: 45 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[3, 3, 4]} intensity={40} color={color} />
        <pointLight position={[-4, -2, 2]} intensity={20} color="#ff9f1c" />
        <Breather color={color} pm={pm} />
        <Sparkles count={40} scale={6} size={2} speed={0.3} color="#ffd27a" />
      </Canvas>
    </div>
  )
}
