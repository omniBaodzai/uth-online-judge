import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import NewsImageNodeView from './news-image-node-view'

export const NewsImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: 100 },
      align: { default: 'center' },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(NewsImageNodeView)
  },
}).configure({
  inline: false,
  allowBase64: false,
})
