import styles from './SiteFooter.module.css'
import uthLogo from '../../assets/uth_logo.png'

function SiteFooter() {
  return (
    <footer className={styles.footer} id="contact">
      <div className={styles.footerInner}>
        <div className={styles.brandColumn}>
          <h2>Thông tin chung</h2>
          <a className={styles.brand} href="/" aria-label="UTH Online Judge - Trang chủ">
            <img src={uthLogo} alt="" />
          </a>
          <div className={styles.descriptionList}>
            <p>
              UTH Online Judge là nền tảng luyện tập lập trình, hỗ trợ sinh viên
              rèn luyện tư duy thuật toán và kỹ năng giải quyết vấn đề.
            </p>
            <p>
              Với sứ mệnh tạo môi trường học tập thực hành, chúng tôi kết nối
              người học với bài tập, kỳ thi và cộng đồng lập trình UTH.
            </p>
            <p>
              Tầm nhìn của nền tảng là trở thành không gian học lập trình hữu
              ích, nơi mỗi sinh viên có thể tự tin tiến bộ qua từng thử thách.
            </p>
          </div>
        </div>
        <div className={styles.footerColumn}>
          <h2>Thông tin liên hệ</h2>
          <a href="huynhlebaoes@gmail.com">Email: huynhlebaoes@gmail.com</a>
          <span>Đơn vị: UTH Online Judge</span>
          <span>
            Trường Đại học Giao thông Vận tải Thành phố Hồ Chí Minh
          </span>
          <a href="mailto:huynhlebaoes@gmail.com?subject=Ho%20tro%20UTH%20Online%20Judge">
            Gửi yêu cầu hỗ trợ
          </a>
        </div>
        <div className={styles.footerColumn}>
          <h2>Chính sách</h2>
          <span>Sử dụng nền tảng đúng mục đích học tập và rèn luyện.</span>
          <span>Tôn trọng quyền riêng tư và thông tin tài khoản cá nhân.</span>
          <span>
            Không chia sẻ lời giải hoặc nội dung vi phạm quy định học thuật.
          </span>
          <span>Bài đóng góp cần chính xác, rõ ràng và phù hợp cộng đồng.</span>
        </div>
        <div className={styles.footerColumn}>
          <h2>Hướng dẫn</h2>
          <a href="/problems">Tìm và luyện tập bài tập</a>
          <a href="/contests">Tham gia kỳ thi</a>
          <a href="/submissions">Xem trạng thái bài nộp</a>
          <a href="#community">Đọc tin tức và thảo luận</a>
          <a href="mailto:huynhlebaoes@gmail.com?subject=Bao%20loi%20UTH%20Online%20Judge">
            Báo lỗi hoặc cần trợ giúp
          </a>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p>&copy; 2026 UTH Online Judge. All rights reserved.</p>
      </div>
    </footer>
  )
}

export default SiteFooter
