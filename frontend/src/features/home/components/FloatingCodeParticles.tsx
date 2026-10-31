import type { CSSProperties } from 'react'
import styles from './FloatingCodeParticles.module.css'

type FloatingCodeParticlesProps = {
  count?: number
  maxOpacity?: number
  speed?: number
}

type ParticleStyle = CSSProperties & {
  '--particle-x': string
  '--particle-opacity': number
  '--particle-duration': string
  '--particle-delay': string
  '--particle-drift-mid': string
  '--particle-drift-end': string
  '--particle-rotate-start': string
  '--particle-rotate-mid': string
  '--particle-rotate-end': string
}

const particleConfigs = [
  { character: '{ }', x: 7, opacity: 0.72, duration: 18, delay: -6, driftMid: 18, driftEnd: 8, rotateStart: -8, rotateMid: 4, rotateEnd: 10 },
  { character: '</>', x: 15, opacity: 0.9, duration: 21, delay: -13, driftMid: -22, driftEnd: -9, rotateStart: 5, rotateMid: -7, rotateEnd: 3 },
  { character: '0', x: 23, opacity: 0.64, duration: 14, delay: -4, driftMid: 14, driftEnd: -5, rotateStart: -4, rotateMid: 8, rotateEnd: -6 },
  { character: '1', x: 31, opacity: 0.78, duration: 19, delay: -15, driftMid: -16, driftEnd: 7, rotateStart: 7, rotateMid: -3, rotateEnd: -9 },
  { character: '{ }', x: 39, opacity: 0.58, duration: 16, delay: -8, driftMid: 24, driftEnd: 10, rotateStart: -6, rotateMid: 9, rotateEnd: 4 },
  { character: '</>', x: 47, opacity: 0.82, duration: 22, delay: -17, driftMid: -18, driftEnd: -6, rotateStart: 4, rotateMid: -9, rotateEnd: 8 },
  { character: '0', x: 55, opacity: 0.7, duration: 13, delay: -3, driftMid: 12, driftEnd: -8, rotateStart: -9, rotateMid: 5, rotateEnd: -2 },
  { character: '1', x: 63, opacity: 1, duration: 20, delay: -12, driftMid: -25, driftEnd: -11, rotateStart: 3, rotateMid: -5, rotateEnd: 9 },
  { character: '{ }', x: 71, opacity: 0.66, duration: 15, delay: -9, driftMid: 20, driftEnd: 6, rotateStart: -5, rotateMid: 7, rotateEnd: -8 },
  { character: '</>', x: 79, opacity: 0.86, duration: 18, delay: -14, driftMid: -14, driftEnd: 9, rotateStart: 8, rotateMid: -4, rotateEnd: 5 },
  { character: '0', x: 87, opacity: 0.74, duration: 12, delay: -5, driftMid: 16, driftEnd: -4, rotateStart: -7, rotateMid: 6, rotateEnd: -3 },
  { character: '1', x: 95, opacity: 0.62, duration: 17, delay: -11, driftMid: -20, driftEnd: -7, rotateStart: 6, rotateMid: -8, rotateEnd: 2 },
  { character: '{ }', x: 11, opacity: 0.8, duration: 22, delay: -19, driftMid: -12, driftEnd: 8, rotateStart: -3, rotateMid: 8, rotateEnd: -7 },
  { character: '</>', x: 35, opacity: 0.68, duration: 16, delay: -2, driftMid: 22, driftEnd: -6, rotateStart: 9, rotateMid: -6, rotateEnd: 4 },
  { character: '0', x: 67, opacity: 0.92, duration: 20, delay: -16, driftMid: -17, driftEnd: 5, rotateStart: -8, rotateMid: 3, rotateEnd: 7 },
  { character: '1', x: 91, opacity: 0.76, duration: 14, delay: -7, driftMid: 13, driftEnd: -10, rotateStart: 5, rotateMid: -9, rotateEnd: -4 },
] as const

function FloatingCodeParticles({
  count = 16,
  maxOpacity = 0.35,
  speed = 1,
}: FloatingCodeParticlesProps) {
  const safeCount = Number.isFinite(count)
    ? Math.min(Math.max(Math.floor(count), 0), particleConfigs.length)
    : particleConfigs.length
  const safeOpacity = Number.isFinite(maxOpacity)
    ? Math.min(Math.max(maxOpacity, 0), 0.35)
    : 0.35
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1

  return (
    <div className={styles.particles} aria-hidden="true">
      {particleConfigs.slice(0, safeCount).map((particle, index) => {
        const style: ParticleStyle = {
          '--particle-x': `${particle.x}%`,
          '--particle-opacity': safeOpacity * particle.opacity,
          '--particle-duration': `${particle.duration / safeSpeed}s`,
          '--particle-delay': `${particle.delay}s`,
          '--particle-drift-mid': `${particle.driftMid}px`,
          '--particle-drift-end': `${particle.driftEnd}px`,
          '--particle-rotate-start': `${particle.rotateStart}deg`,
          '--particle-rotate-mid': `${particle.rotateMid}deg`,
          '--particle-rotate-end': `${particle.rotateEnd}deg`,
        }

        return (
          <span className={styles.particle} key={`${particle.character}-${index}`} style={style}>
            {particle.character}
          </span>
        )
      })}
    </div>
  )
}

export default FloatingCodeParticles
