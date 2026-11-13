import ScrollControls from './ScrollControls'
import { AiAssistantWidget } from '../../features/ai-assistant/AiAssistantWidget'
import styles from './FloatingActions.module.css'

function FloatingActions() {
  return (
    <div className={styles.dock}>
      <AiAssistantWidget />
      <ScrollControls />
    </div>
  )
}

export default FloatingActions
