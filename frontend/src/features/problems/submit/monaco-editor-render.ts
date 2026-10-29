export type MonacoEditorRenderProps<Editor> = {
  language: string
  revision: number
  onChange: (value: string) => void
  onReady: (editor: Editor | null) => void
  ariaLabel?: string
}

export function areMonacoEditorRenderPropsEqual<Editor>(
  previous: Readonly<MonacoEditorRenderProps<Editor>>,
  next: Readonly<MonacoEditorRenderProps<Editor>>,
): boolean {
  return (
    previous.language === next.language &&
    previous.revision === next.revision &&
    previous.onChange === next.onChange &&
    previous.onReady === next.onReady &&
    previous.ariaLabel === next.ariaLabel
  )
}