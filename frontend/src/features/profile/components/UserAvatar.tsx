import { useState } from 'react'
import styles from './UserAvatar.module.css'

type UserAvatarProps = {
  source: string | null
  username: string
  size?: 'small' | 'large'
  label?: string
}

function UserAvatar({ source, username, size = 'small', label }: UserAvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const initial = [...username.trim()][0]?.toLocaleUpperCase('vi') ?? '?'
  const imageFailed = source !== null && failedSource === source

  return (
    <span
      className={`${styles.avatar} ${size === 'large' ? styles.large : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {source && !imageFailed ? (
        <img
          src={source}
          alt=""
          onError={() => setFailedSource(source)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  )
}

export default UserAvatar
