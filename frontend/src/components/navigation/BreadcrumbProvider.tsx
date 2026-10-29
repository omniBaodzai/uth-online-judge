import { useMemo, useState, type ReactNode } from 'react'
import { BreadcrumbContext } from './breadcrumb-context'

// Cho trang con cung cấp dữ liệu động (mã bài tập) cho Breadcrumb dùng chung.
function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [problemCode, setProblemCode] = useState<string | null>(null)
  const value = useMemo(() => ({ problemCode, setProblemCode }), [problemCode])
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>
}

export default BreadcrumbProvider
