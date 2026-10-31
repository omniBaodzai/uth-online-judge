import { Link } from 'react-router-dom'
import styles from './HeroBanner.module.css'
import FloatingCodeParticles from './FloatingCodeParticles'
import PlatformStats from './PlatformStats'
import heroBackground from '../../../assets/uth_banner.jpg'

function HeroBanner() {
  return (
    <section
      className={styles.hero}
      style={{ backgroundImage: `url("${heroBackground}")` }}
      aria-labelledby="hero-title"
    >
      <FloatingCodeParticles />
      <div className={styles.heroContent}>
        <h1 className={styles.title} id="hero-title">
          Viết code hôm nay,
          <span>tự tin bứt phá ngày mai</span>
        </h1>
        <p className={styles.description}>
          UTH Online Judge là nền tảng luyện tập viết mã từ Zero đến Hero, giúp sinh viên từng bước rèn luyện tư duy thuật toán, nâng cao kỹ năng giải quyết vấn đề và chinh phục những thử thách lập trình. 
        </p>
        <div className={styles.actions}>
          <Link className={styles.primaryAction} to="/problems">
            Khám phá bài tập
            
          </Link>
          <Link className={styles.secondaryAction} to="/contests">
            Tham gia kỳ thi
          </Link>
        </div>
      </div>
      <PlatformStats />
    </section>
  )
}

export default HeroBanner
