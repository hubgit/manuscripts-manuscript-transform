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

export interface FigureElementNode extends ManuscriptNode {
  attrs: {
    columns: number
    containedObjectIDs: string[]
    figureLayout: string
    figureStyle: string
    id: string
    label: string
    rows: number
    suppressCaption: boolean
  }
}

export const figureElement: NodeSpec = {
  content: 'figcaption',
  attrs: {
    columns: { default: 1 },
    containedObjectIDs: { default: [] },
    figureLayout: { default: '' },
    figureStyle: { default: '' },
    id: { default: '' },
    label: { default: '' },
    rows: { default: 1 },
    suppressCaption: { default: false },
  },
  selectable: false,
  group: 'block element',
  parseDOM: [
    {
      tag: 'figure',
      getAttrs: p => {
        const dom = p as HTMLElement

        return {
          id: dom.getAttribute('id'),
          figureStyle: dom.getAttribute('data-figure-style'),
          figureLayout: dom.getAttribute('data-figure-layout'),
        }
      },
      priority: 10, // make sure that figure.table etc get a chance to match first
    },
  ],
  toDOM: node => {
    const figureElementNode = node as FigureElementNode

    return [
      'figure',
      {
        id: figureElementNode.attrs.id,
        'data-figure-style': figureElementNode.attrs.figureStyle,
        'data-figure-layout': figureElementNode.attrs.figureLayout,
      },
      0,
    ]
  },
}
