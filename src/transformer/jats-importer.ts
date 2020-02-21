/*!
 * © 2020 Atypon Systems LLC
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

import { Model, ObjectTypes } from '@manuscripts/manuscripts-json-schema'
import { DOMParser, ParseRule } from 'prosemirror-model'
import { ManuscriptNode, Marks, Nodes, schema } from '../schema'
import {
  buildBibliographicName,
  buildContributor,
  buildManuscript,
} from './builders'
import { encode } from './encode'
import { generateID } from './id'
import { nodeTypesMap } from './node-types'

// TODO: remove element.getAttribute('id') and rewrite cross-references?

// https://jats.nlm.nih.gov/articleauthoring/tag-library/1.2/

const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

export type MarkRule = ParseRule & { mark: Marks | null }

const marks: MarkRule[] = [
  {
    tag: 'bold',
    mark: 'bold',
  },
  {
    tag: 'code',
    mark: 'code',
  },
  {
    tag: 'italic',
    mark: 'italic',
  },
  {
    tag: 'sc',
    mark: 'smallcaps',
  },
  {
    tag: 'strike',
    mark: 'strikethrough',
  },
  {
    tag: 'styled-content',
    mark: 'styled',
    getAttrs: node => ({
      style: (node as Element).getAttribute('style'),
    }),
  },
  {
    tag: 'sub',
    mark: 'subscript',
  },
  {
    tag: 'sup',
    mark: 'superscript',
  },
  {
    tag: 'underline',
    mark: 'underline',
  },
]

export type NodeRule = ParseRule & { node?: Nodes | null }

const nodes: NodeRule[] = [
  {
    tag: 'abstract',
    node: 'section',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
        category: 'MPSectionCategory:abstract',
      }
    },
  },
  {
    tag: 'attrib',
    node: 'attribution',
  },
  {
    tag: 'back',
    ignore: true,
  },
  {
    tag: 'body',
    node: 'manuscript',
  },
  {
    tag: 'break',
    node: 'hard_break',
  },
  {
    tag: 'caption',
    node: 'figcaption',
    context: 'figure/',
  },
  {
    tag: 'caption',
    node: 'figcaption',
    context: 'figure_element/',
  },
  {
    tag: 'caption',
    node: 'figcaption',
    context: 'table_element/',
  },
  {
    tag: 'code',
    node: 'listing',
    context: 'listing_element/',
    // preserveWhitespace: 'full',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
        language: element.getAttribute('language') ?? '',
        contents: element.textContent?.trim() ?? '',
      }
    },
  },
  {
    tag: 'disp-formula',
    node: 'equation',
    getAttrs: node => {
      const element = node as HTMLElement

      const TeXRepresentation =
        element.querySelector('tex-math')?.textContent?.trim() ?? ''

      return {
        id: element.getAttribute('id'),
        TeXRepresentation,
      }
    },
  },
  {
    tag: 'disp-quote[content-type=quote]',
    node: 'blockquote_element',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'disp-quote[content-type=pullquote]',
    node: 'pullquote_element',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'ext-link',
    node: 'link',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        href: element.getAttributeNS(XLINK_NAMESPACE, 'href') || '',
        title: element.getAttributeNS(XLINK_NAMESPACE, 'title') || '',
      }
    },
  },
  {
    tag: 'fig[id^=MPEquationElement_]',
    node: 'equation_element',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'fig[id^=MPListingElement_]',
    node: 'listing_element',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'fig',
    node: 'figure',
    getAttrs: node => {
      const element = node as HTMLElement

      const labelNode = element.querySelector('label')
      const graphicNode = element.querySelector('graphic')
      const mediaNode = element.querySelector('media')

      return {
        id: element.getAttribute('id'),
        label: labelNode?.textContent?.trim() ?? '',
        contentType: graphicNode
          ? [
              graphicNode.getAttribute('mimetype'),
              graphicNode.getAttribute('mime-subtype'),
            ].join('/')
          : '',
        // TODO: src from attachment
        embedURL: mediaNode
          ? mediaNode.getAttributeNS(XLINK_NAMESPACE, 'href')
          : undefined,
      }
    },
  },
  {
    tag: 'figure-group',
    node: 'figure_element',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'fn',
    node: 'footnote',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
        contents: element.textContent,
      }
    },
  },
  {
    tag: 'front',
    ignore: true,
  },
  {
    tag: 'inline-formula',
    node: 'inline_equation',
    getAttrs: node => {
      const element = node as HTMLElement

      const TeXRepresentation =
        element.querySelector('tex-math')?.textContent?.trim() ?? ''

      // TODO: call convertToSVG to get SVGRepresentation?

      return {
        id: element.getAttribute('id'),
        TeXRepresentation,
      }
    },
  },
  {
    tag: 'list[list-type=bullet]',
    node: 'bullet_list',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'list[list-type=order]',
    node: 'ordered_list',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'list-item',
    node: 'list_item',
  },
  // {
  //   tag: 'math',
  //   namespace: 'http://www.w3.org/1998/Math/MathML',
  //   node: 'equation',
  // },
  {
    tag: 'p',
    node: 'paragraph',
    context: 'section/',
    priority: 100,
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'p',
    node: 'paragraph',
    priority: 90,
  },
  {
    tag: 'sec',
    node: 'section', // TODO: id
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
        // category: TODO: guess category from section title
      }
    },
  },
  {
    tag: 'table',
    node: 'table',
    // TODO: count thead and tfoot rows
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'table-wrap',
    node: 'table_element',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'tbody',
    skip: true,
  },
  {
    tag: 'tfoot',
    skip: true,
  },
  {
    tag: 'thead',
    skip: true,
  },
  {
    tag: 'title',
    node: 'section_title',
    context: 'section/',
  },
  {
    tag: 'tr',
    node: 'table_row',
  },
  {
    tag: 'td',
    node: 'table_cell',
  },
  {
    tag: 'th',
    node: 'table_cell',
  },
  {
    tag: 'xref',
    node: 'cross_reference',
    priority: 90,
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        rid: element.getAttribute('rid'),
        label: element.textContent,
      }
    },
  },
  {
    tag: 'xref[ref-type="bibr"]',
    node: 'citation',
    priority: 100,
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        rid: element.getAttribute('rid'),
        contents: element.textContent, // TODO: innerHTML?
      }
    },
  },
]

// metadata
// address, addr-line, aff, article-title, city,

export const jatsRules = [...marks, ...nodes]

// wrap single figures in fig-group
export const wrapFigures = (body: Element) => {
  const doc = body.ownerDocument as Document

  const figures = body.querySelectorAll('section > fig')

  for (const figure of figures) {
    const section = figure.parentNode as Element

    const figGroup = doc.createElement('fig-group')
    section.insertBefore(figGroup, figure)

    // move caption into fig-group
    const figCaption = figure.querySelector('figcaption')
    if (figCaption) {
      figGroup.appendChild(figCaption)
    }

    // move figure into fig-group
    figGroup.appendChild(figure)
  }
}

// move captions to the end of their containers
export const moveCaptionsToEnd = (body: Element) => {
  const captions = body.querySelectorAll('caption')

  for (const caption of captions) {
    if (caption.parentNode) {
      caption.parentNode.appendChild(caption)
    }
  }
}

// add/rewrite ids
export const rewriteIDs = (output: ManuscriptNode) => {
  const replacements = new Map<string, string>()

  output.descendants(node => {
    // nodes that need an id
    if ('id' in node.attrs) {
      const objectType = nodeTypesMap.get(node.type)

      if (!objectType) {
        return
        // throw new Error(`Unknown object type for node type ${node.type.name}`)
      }

      const nextID = generateID(objectType)

      const previousID = node.attrs.id

      if (previousID) {
        if (replacements.has(previousID)) {
          throw new Error(`ID ${previousID} exists twice!`)
          // TODO: warn and ignore instead?
        }

        replacements.set(previousID, nextID)
      }

      node.attrs.id = nextID
    }
  })

  // replace cross-reference rids

  output.descendants(node => {
    // nodes that have an rid
    if ('rid' in node.attrs) {
      const previousRID = node.attrs.rid

      if (previousRID) {
        node.attrs.rid = replacements.get(previousRID) // TODO: warn if undefined?
      }
    }
  })
}

export const parseJATSBody = (doc: Document) => {
  const body = doc.querySelector('body')

  if (!body) {
    throw new Error('No body element found!')
  }

  // fix up the document
  wrapFigures(body)
  moveCaptionsToEnd(body)

  const output = new DOMParser(schema, jatsRules).parse(body)

  rewriteIDs(output)

  return output
}

export const parseJATSFront = (doc: Document) => {
  const front = doc.querySelector('front')

  if (!front) {
    throw new Error('No front element found!')
  }

  const modelMap = new Map<string, Model>()

  const addModel = <T extends Model>(data: Partial<T>) => {
    data._id = generateID(data.objectType as ObjectTypes)

    modelMap.set(data._id, data as T)
  }

  // manuscript

  const titleNode = front.querySelector(
    'article-meta > title-group > article-title'
  )

  addModel(buildManuscript(titleNode?.innerHTML))

  // contributors

  const authorNodes = front.querySelectorAll(
    'article-meta > contrib-group > contrib[contrib-type=author]'
  )

  authorNodes.forEach((authorNode, priority) => {
    const name = buildBibliographicName({})

    const givenNamesNode = authorNode.querySelector('name > given-names')

    if (givenNamesNode) {
      name.given = givenNamesNode.textContent
    }

    const surnameNode = authorNode.querySelector('name > surname')

    if (surnameNode) {
      name.family = surnameNode.textContent
    }

    addModel(buildContributor(name, 'author', priority))
  })

  return modelMap
}

export const parseJATSArticle = (doc: Document): Model[] => {
  const front = parseJATSFront(doc)

  const node = parseJATSBody(doc)
  const body = encode(node.firstChild!)

  return [...front.values(), ...body.values()]
}
