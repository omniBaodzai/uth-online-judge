import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2, Lock, type LucideIcon } from 'lucide-react'
import styles from '../pages/OrganizationDetailPage.module.css'

export type OrganizationTabStateKind = 'empty' | 'private' | 'loading' | 'error'

type Props = {
  kind: OrganizationTabStateKind
  icon: LucideIcon
  emptyText?: string
  errorText?: string
  children?: ReactNode
}

function OrganizationTabState({ kind, icon: EmptyIcon, emptyText, errorText, children }: Props) {
  const { t } = useTranslation('pages')
  const view = {
    empty: { Icon: EmptyIcon, title: t('organizationTabNoDataTitle'), text: emptyText },
    private: { Icon: Lock, title: t('organizationTabPrivateTitle'), text: t('organizationTabPrivateText') },
    loading: { Icon: Loader2, title: t('organizationTabLoading'), text: undefined },
    error: { Icon: AlertCircle, title: t('organizationTabErrorTitle'), text: errorText ?? t('organizationTabErrorText') },
  }[kind]

  return (
    <section
      className={`${styles.card} ${styles.placeholder}`}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-busy={kind === 'loading'}
      data-state={kind}
    >
      <span className={styles.placeholderIcon}>
        <view.Icon size={24} aria-hidden="true" className={kind === 'loading' ? styles.spin : undefined} />
      </span>
      <h2>{view.title}</h2>
      {view.text && <p>{view.text}</p>}
      {children}
    </section>
  )
}

export default OrganizationTabState
