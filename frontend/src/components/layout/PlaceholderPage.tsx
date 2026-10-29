import styles from './PlaceholderPage.module.css'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className={styles.main} id="main-content">
      <section className={styles.card} aria-labelledby="placeholder-title">
        <h1 id="placeholder-title">{title}</h1>
        <p>Nội dung đang được xây dựng. Vui lòng quay lại sau.</p>
      </section>
    </main>
  )
}

export default PlaceholderPage
