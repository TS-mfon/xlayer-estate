"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function AssetCore({ progress }: { progress: number }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const marketRing = useRef<THREE.Mesh>(null);
  const nodes = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.08;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.08;
    if (ring.current) ring.current.rotation.z += delta * 0.3;
    if (marketRing.current) marketRing.current.rotation.x += delta * 0.18;
  });

  const visible = Math.max(0, Math.min(1, progress));
  const photoProgress = THREE.MathUtils.smoothstep(visible, 0.02, 0.2);
  const scanProgress = THREE.MathUtils.smoothstep(visible, 0.18, 0.4);
  const valuationProgress = THREE.MathUtils.smoothstep(visible, 0.38, 0.6);
  const tokenProgress = THREE.MathUtils.smoothstep(visible, 0.58, 0.8);
  const marketProgress = THREE.MathUtils.smoothstep(visible, 0.78, 0.96);
  return (
    <group ref={group} scale={0.85 + visible * 0.2}>
      <mesh>
        <icosahedronGeometry args={[1.15, 2]} />
        <meshPhysicalMaterial
          color="#9df8ff"
          emissive="#16b7d0"
          emissiveIntensity={1.4}
          metalness={0.4}
          roughness={0.18}
          transmission={0.55}
          transparent
          opacity={0.36 + visible * 0.4}
        />
      </mesh>
      <mesh position={[-2.25, 0.9, 0]} scale={[0.8 * photoProgress, 0.5 * photoProgress, 0.03]}>
        <boxGeometry />
        <meshPhysicalMaterial color="#07141f" emissive="#42dff5" emissiveIntensity={0.45} transparent opacity={0.25 + photoProgress * 0.65} />
      </mesh>
      <mesh position={[-1.25, -1.45, 0.25]} scale={[1.25 * scanProgress, 0.012, 0.012]}>
        <boxGeometry />
        <meshBasicMaterial color="#7df5ff" transparent opacity={scanProgress} />
      </mesh>
      <mesh position={[2.15, 1.05, 0]} scale={[0.72 * valuationProgress, 0.44 * valuationProgress, 0.03]}>
        <boxGeometry />
        <meshPhysicalMaterial color="#16122a" emissive="#795cff" emissiveIntensity={0.55} transparent opacity={0.2 + valuationProgress * 0.7} />
      </mesh>
      <mesh position={[1.95, -1.25, 0]} rotation={[0, 0, Math.PI / 4]} scale={0.52 * tokenProgress}>
        <octahedronGeometry />
        <meshPhysicalMaterial color="#adfff9" emissive="#22d4e5" emissiveIntensity={1.2} metalness={0.5} roughness={0.15} transparent opacity={tokenProgress} />
      </mesh>
      <mesh ref={marketRing} rotation={[Math.PI / 2, 0, 0]} scale={marketProgress}>
        <torusGeometry args={[2.15, 0.035, 16, 120]} />
        <meshBasicMaterial color="#8effbd" transparent opacity={marketProgress * 0.8} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.55, 0.012, 12, 96]} />
        <meshBasicMaterial color="#54e8ff" transparent opacity={0.7} />
      </mesh>
      {nodes.map((node) => {
        const angle = (node / nodes.length) * Math.PI * 2;
        const radius = 1.8 + (node % 3) * 0.17;
        const nodeProgress = Math.max(0, Math.min(1, visible * 1.3 - node / nodes.length));
        return (
          <mesh
            key={node}
            position={[Math.cos(angle) * radius, Math.sin(angle * 1.7) * 0.75, Math.sin(angle) * radius]}
            scale={0.04 + nodeProgress * 0.06}
          >
            <sphereGeometry args={[1, 12, 12]} />
            <meshBasicMaterial color="#b7fffb" transparent opacity={nodeProgress} />
          </mesh>
        );
      })}
      <Html center distanceFactor={7} style={{ pointerEvents: "none" }}>
        <div className="scene-core-label">PHOTO → AI → TOKEN → USDC</div>
      </Html>
    </group>
  );
}

export function SceneCanvas({ progress = 0.5 }: { progress?: number }) {
  return (
    <div className="scene-canvas" aria-hidden="true">
      <Canvas camera={{ position: [0, 0.15, 6.2], fov: 35 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.7} />
        <pointLight position={[3, 4, 4]} color="#4deaff" intensity={18} distance={10} />
        <pointLight position={[-4, -2, 2]} color="#695cff" intensity={10} distance={9} />
        <Float speed={0.8} rotationIntensity={0.1} floatIntensity={0.35}>
          <AssetCore progress={progress} />
        </Float>
        <Sparkles count={80} scale={8} size={1.2} speed={0.25} color="#8aeaff" />
      </Canvas>
    </div>
  );
}
