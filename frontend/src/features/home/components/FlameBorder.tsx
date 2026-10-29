import { useEffect, useRef, useState } from 'react'
import styles from './FlameBorder.module.css'

// Vị trí (%) và nhịp của vài tia lửa nhỏ bay lên từ cạnh trên và hai bên.
const sparks = [
  { left: '12%', top: '0%', delay: '0s', duration: '2.6s' },
  { left: '34%', top: '0%', delay: '-1.1s', duration: '3.1s' },
  { left: '58%', top: '0%', delay: '-2.0s', duration: '2.8s' },
  { left: '83%', top: '0%', delay: '-0.6s', duration: '3.4s' },
  { left: '100%', top: '42%', delay: '-1.7s', duration: '3s' },
  { left: '0%', top: '60%', delay: '-2.4s', duration: '3.2s' },
]

function FlameBorder() {
  const rootRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(true)

  // Chỉ chạy animation khi phần tử nằm trong khung nhìn.
  useEffect(() => {
    const node = rootRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '40px',
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <span
      className={styles.fire}
      ref={rootRef}
      data-paused={visible ? undefined : 'true'}
      aria-hidden="true"
    >
      <span className={styles.heat} />
      <span className={styles.ring} />
      <span className={styles.ringCounter} />
      {sparks.map((spark, index) => (
        <i
          className={styles.spark}
          style={{
            left: spark.left,
            top: spark.top,
            animationDelay: spark.delay,
            animationDuration: spark.duration,
          }}
          key={index}
        />
      ))}
    </span>
  )
}

export default FlameBorder
