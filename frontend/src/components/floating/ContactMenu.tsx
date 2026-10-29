import { useEffect, useRef, useState } from 'react'
import { CONTACT_ORGANIZATION, contactLinks } from '../../config/contact'
import styles from './FloatingActions.module.css'

function ContactMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    function closeOnOutsidePress(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutsidePress)
    }
  }, [open])

  return (
    <div className={styles.contact} ref={rootRef}>
      {open && (
        <div className={styles.contactMenu} id="floating-contact-menu" role="dialog" aria-label="Thông tin liên hệ">
          <div className={styles.contactHead}>
            <strong>Liên hệ</strong>
            <button type="button" aria-label="Đóng menu liên hệ" onClick={() => { setOpen(false); buttonRef.current?.focus() }}>×</button>
          </div>
          <p className={styles.contactOrg}>{CONTACT_ORGANIZATION}</p>
          <ul>
            {contactLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} onClick={() => setOpen(false)}>
                  <span>{link.label}</span>
                  <small>{link.description}</small>
                </a>
              </li>
            ))}
            <li>
              <a href="#contact" onClick={() => setOpen(false)}>
                <span>Xem thông tin liên hệ</span>
                <small>Cuộn tới chân trang</small>
              </a>
            </li>
          </ul>
        </div>
      )}
      <button
        ref={buttonRef}
        className={styles.contactButton}
        type="button"
        aria-expanded={open}
        aria-controls="floating-contact-menu"
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.8A8 8 0 1 1 21 12Z" />
        </svg>
        Liên hệ
      </button>
    </div>
  )
}

export default ContactMenu
