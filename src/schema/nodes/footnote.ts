/*!
 * © 2019 Atypon Systems LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NodeSpec } from 'prosemirror-model'
import { ManuscriptNode } from '../types'

type Kind = 'footnote' | 'endnote'

const placeholderText: { [key in Kind]: string } = {
  endnote: 'Endnote',
  footnote: 'Footnote',
}

interface Attrs {
  id: string
  contents: string
  kind: Kind
}

export interface FootnoteNode extends ManuscriptNode {
  attrs: Attrs
}

export const footnote: NodeSpec = {
  group: 'block',
  content: 'inline*',
  attrs: {
    id: { default: '' },
    contents: { default: '' },
    kind: { default: '' },
  },
  parseDOM: [
    {
      tag: 'div.footnote-contents',
      getAttrs: p => {
        const dom = p as HTMLDivElement

        const inner = dom.querySelector('p')

        return {
          id: dom.getAttribute('id'),
          contents: inner ? inner.innerHTML : '',
        }
      },
    },
  ],
  toDOM: node => {
    const footnoteNode = node as FootnoteNode

    return [
      'div',
      {
        class: 'footnote-contents',
      },
      [
        'div',
        {
          class: 'footnote-text',
        },
        [
          // TODO: multiple paragraphs?
          'p',
          {
            'placeholder-text': placeholderText[footnoteNode.attrs.kind],
          },
          0,
        ],
      ],
    ]
  },
}
