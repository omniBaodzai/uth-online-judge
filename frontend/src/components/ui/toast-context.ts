import { createContext, useContext } from 'react'

export type ToastApi = { showToast: (message: string) => void }

export const ToastContext = createContext<ToastApi>({ showToast: () => undefined })

export function useToast(): ToastApi {
  return useContext(ToastContext)
}
