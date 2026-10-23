import { useEffect, useState } from 'react'
import styles from './FloatingActions.module.css'

const EDGE_TOLERANCE_PX = 4

function readScrollState() {
  const root = document.documentElement
  const maxScroll = root.scrollHeight - window.innerHeight
  return {
    canScrollUp: window.scrollY > EDGE_TOLERANCE_PX,
    canScrollDown: maxScroll > EDGE_TOLERANCE_PX && window.scrollY < maxScroll - EDGE_TOLERANCE_PX,
  }
}

function scrollSmoothly(top: number) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' })
}

function ArrowIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === 'up' ? <path d="m6 14 6-6 6 6" /> : <path d="m6 10 6 6 6-6" />}
    </svg>
  )
}

function ScrollControls() {
  const [state, setState] = useState(readScrollState)

  useEffect(() => {
    const update = () => setState((previous) => {
      const next = readScrollState()
      return previous.canScrollUp === next.canScrollUp && previous.canScrollDown === next.canScrollDown ? previous : next
    })
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // Nội dung tải bất đồng bộ làm đổi chiều cao trang mà không có sự kiện scroll.
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [])

  return (
    <>
      {state.canScrollUp && (
        <button className={styles.fab} type="button" aria-label="Cuộn lên đầu trang" title="Lên đầu trang" onClick={() => scrollSmoothly(0)}>
          <ArrowIcon direction="up" />
        </button>
      )}
      {state.canScrollDown && (
        <button className={styles.fab} type="button" aria-label="Cuộn xuống cuối trang" title="Xuống cuối trang" onClick={() => scrollSmoothly(document.documentElement.scrollHeight)}>
          <ArrowIcon direction="down" />
        </button>
      )}
    </>
  )
}

export default ScrollControls
