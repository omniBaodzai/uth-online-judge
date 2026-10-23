import ContactMenu from './ContactMenu'
import ScrollControls from './ScrollControls'
import styles from './FloatingActions.module.css'

function FloatingActions() {
  return (
    <div className={styles.dock}>
      <ContactMenu />
      <ScrollControls />
    </div>
  )
}

export default FloatingActions
