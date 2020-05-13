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

import {
  BibliographicName,
  Model,
  ObjectTypes,
} from '@manuscripts/manuscripts-json-schema'
import { DOMParser, ParseRule } from 'prosemirror-model'
import { ManuscriptNode, Marks, Nodes, schema } from '../schema'
import {
  buildAffiliation,
  buildAuxiliaryObjectReference,
  buildBibliographicDate,
  buildBibliographicName,
  buildBibliographyItem,
  buildCitation,
  buildContributor,
  buildManuscript,
} from './builders'
import { encode } from './encode'
import { generateID } from './id'
import { nodeTypesMap } from './node-types'
import { SectionCategory } from './section-category'

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
    tag: 'fig[fig-type=equation]',
    node: 'equation_element',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'fig[fig-type=listing]',
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
    context: 'figure_element/',
    getAttrs: node => {
      const element = node as HTMLElement

      const labelNode = element.querySelector('label')
      const graphicNode = element.querySelector('graphic')
      const mediaNode = element.querySelector('media')

      return {
        id: element.getAttribute('id'),
        label: labelNode?.textContent?.trim() ?? '',
        contentType: chooseContentType(graphicNode || undefined) || '',
        originalURL: graphicNode
          ? graphicNode.getAttributeNS(XLINK_NAMESPACE, 'href')
          : '',
        embedURL: mediaNode
          ? mediaNode.getAttributeNS(XLINK_NAMESPACE, 'href')
          : undefined,
      }
    },
  },
  {
    tag: 'fig-group',
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
  },
  {
    tag: 'sec',
    node: 'section', // TODO: id
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
        category: chooseSectionCategory(element),
      }
    },
  },
  {
    tag: 'label',
    context: 'section/',
    ignore: true, // TODO
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
    tag: 'xref[ref-type="bibr"]',
    node: 'citation',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        rid: element.getAttribute('rid'),
        contents: element.textContent, // TODO: innerHTML?
      }
    },
  },
  {
    tag: 'xref',
    node: 'cross_reference',
    getAttrs: node => {
      const element = node as HTMLElement

      return {
        rid: element.getAttribute('rid'),
        label: element.textContent,
      }
    },
  },
]

const chooseSectionCategoryFromTitle = (title: string | null) => {
  switch (title) {
    case 'Abstract':
      return 'MPSectionCategory:abstract'

    case 'Acknowledgements':
      return 'MPSectionCategory:acknowledgment'

    case 'Bibliography':
    case 'References':
      return 'MPSectionCategory:bibliography'
  }
}

const chooseSectionCategory = (
  section: Element
): SectionCategory | undefined => {
  const secType = section.getAttribute('sec-type')

  switch (secType) {
    case 'abstract':
      return 'MPSectionCategory:abstract'

    case 'acknowledgments':
      return 'MPSectionCategory:acknowledgment'

    case 'bibliography':
      return 'MPSectionCategory:bibliography'

    case 'keywords':
      return 'MPSectionCategory:keywords'

    case 'toc':
      return 'MPSectionCategory:toc'

    default:
      const titleNode = section.firstChild

      if (titleNode && titleNode.nodeName === 'title') {
        return chooseSectionCategoryFromTitle(titleNode.textContent)
      }

      return undefined
  }
}

// metadata
// address, addr-line, aff, article-title, city,

export const jatsRules = [...marks, ...nodes]

// wrap single figures in fig-group
export const wrapFigures = (body: Element) => {
  const doc = body.ownerDocument as Document

  const figures = body.querySelectorAll('sec > fig')

  for (const figure of figures) {
    const figType = figure.getAttribute('fig-type')

    // only wrap actual figures
    if (figType && figType !== 'figure') {
      continue
    }

    const section = figure.parentNode as Element

    const figGroup = doc.createElement('fig-group')
    section.insertBefore(figGroup, figure)
    // TODO: move id from figure?

    // move caption into fig-group
    const figCaption = figure.querySelector('caption')
    if (figCaption) {
      figGroup.appendChild(figCaption)
    }

    const graphics = figure.querySelectorAll('graphic')

    if (graphics.length > 1) {
      // TODO: copy attributes?
      section.removeChild(figure)

      // split multiple graphics into separate sub-figures
      for (const graphic of graphics) {
        const figure = doc.createElement('figure')
        figure.appendChild(graphic)
        figGroup.appendChild(figure)
      }
    } else {
      // move single- or no-graphic figure into fig-group
      figGroup.appendChild(figure)
    }
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

// unwrap paragraphs in captions
export const unwrapParagraphsInCaptions = (body: Element) => {
  const captions = body.querySelectorAll('caption')

  for (const caption of captions) {
    const paragraphNodes = caption.querySelectorAll('p')

    paragraphNodes.forEach(paragraphNode => {
      if (paragraphNode.parentNode) {
        while (paragraphNode.firstChild) {
          paragraphNode.parentNode.insertBefore(
            paragraphNode.firstChild,
            paragraphNode
          )
        }

        paragraphNode.parentNode.removeChild(paragraphNode)
      }
    })
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
        if (replacements.has(previousRID)) {
          node.attrs.rid = replacements.get(previousRID)
        } else {
          // tslint:disable-next-line:no-console
          // console.warn(`Missing replacement for ${previousRID}`)
        }
      }
    }
  })
}

// tslint:disable-next-line:cyclomatic-complexity
const moveSectionsToBody = (doc: Document) => {
  const body = doc.querySelector('body')

  if (body) {
    const abstractNode = doc.querySelector('front > article-meta > abstract')

    if (abstractNode) {
      const section = doc.createElement('sec')
      section.setAttribute('sec-type', 'abstract')

      const title = doc.createElement('title')
      title.textContent = 'Abstract'
      section.appendChild(title)

      while (abstractNode.firstChild) {
        section.appendChild(abstractNode.firstChild)
      }

      if (abstractNode.parentNode) {
        abstractNode.parentNode.removeChild(abstractNode)
      }

      body.insertBefore(section, body.firstChild)
    }

    const ack = doc.querySelector('back > ack')

    if (ack) {
      const section = doc.createElement('sec')
      section.setAttribute('sec-type', 'acknowledgements')

      const titleNode = ack.querySelector('title')

      if (titleNode) {
        section.appendChild(titleNode)
      } else {
        const title = doc.createElement('title')
        title.textContent = 'Acknowledgements'
        section.appendChild(title)
      }

      while (ack.firstChild) {
        section.appendChild(ack.firstChild)
      }

      if (ack.parentNode) {
        ack.parentNode.removeChild(ack)
      }

      body.appendChild(section)
    }

    const refList = doc.querySelector('back > ref-list')

    if (refList) {
      const section = doc.createElement('sec')
      section.setAttribute('sec-type', 'bibliography')

      const titleNode = refList.querySelector('title')

      if (titleNode) {
        section.appendChild(titleNode)
      } else {
        const title = doc.createElement('title')
        title.textContent = 'Bibliography'
        section.appendChild(title)
      }

      body.appendChild(section)
    }
  }
}

const ensureSection = (body: Element) => {
  const doc = body.ownerDocument as Document

  if (!body.querySelector('sec')) {
    const section = doc.createElement('sec')

    while (body.firstChild) {
      section.appendChild(body.firstChild)
    }

    body.appendChild(section)
  }
}

export const parseJATSBody = (doc: Document): ManuscriptNode => {
  const body = doc.querySelector('body')

  if (!body) {
    throw new Error('No body element found!')
  }

  // fix up the document
  ensureSection(body)
  moveSectionsToBody(doc)
  wrapFigures(body)
  moveCaptionsToEnd(body)
  unwrapParagraphsInCaptions(body)

  const parser = new DOMParser(schema, jatsRules)
  const output = parser.parse(body)

  rewriteIDs(output)

  return output
}

type AddModel = <T extends Model>(data: Partial<T>) => void

export const parseJATSFront = (doc: Document, addModel: AddModel): void => {
  const front = doc.querySelector('front')

  if (!front) {
    throw new Error('No front element found!')
  }

  // manuscript

  const titleNode = front.querySelector(
    'article-meta > title-group > article-title'
  )

  addModel(buildManuscript(titleNode?.innerHTML))

  // affiliations
  const affiliationIDs = new Map<string, string>()

  const affiliationNodes = front.querySelectorAll(
    'article-meta > contrib-group > aff'
  )

  affiliationNodes.forEach((affiliationNode, priority) => {
    const institution = affiliationNode.textContent // TODO: read structured affiliation

    const affiliation = buildAffiliation(institution || '', priority)

    const id = affiliationNode.getAttribute('id')

    if (id) {
      affiliationIDs.set(id, affiliation._id)
    }

    addModel(affiliation)
  })

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

    const contributor = buildContributor(name, 'author', priority)

    const xrefNode = authorNode.querySelector('xref[ref-type="aff"]')

    if (xrefNode) {
      const rid = xrefNode.getAttribute('rid')

      if (rid) {
        const rids = rid
          .split(/\S+/)
          .filter(id => affiliationIDs.has(id))
          .map(id => affiliationIDs.get(id)) as string[]

        if (rids.length) {
          contributor.affiliations = rids
        }
      }
    }

    addModel(contributor)
  })
}

const chooseContentType = (graphicNode?: Element): string | undefined => {
  if (graphicNode) {
    const mimetype = graphicNode.getAttribute('mimetype')
    const subtype = graphicNode.getAttribute('mime-subtype')

    if (mimetype && subtype) {
      return [mimetype, subtype].join('/')
    }
  }
}

const chooseBibliographyItemType = (publicationType: string | null) => {
  switch (publicationType) {
    case 'book':
    case 'thesis':
      return publicationType

    case 'journal':
    default:
      return 'article-journal'
  }
}

export const parseJATSBack = (doc: Document, addModel: AddModel): void => {
  const back = doc.querySelector('back')

  if (!back) {
    return
  }

  // references

  const referenceIDs = new Map<string, string>()

  const referenceNodes = doc.querySelectorAll('ref-list > ref')

  // tslint:disable-next-line:cyclomatic-complexity
  referenceNodes.forEach(referenceNode => {
    const publicationType = referenceNode.getAttribute('publication-type')

    const bibliographyItem = buildBibliographyItem({
      type: chooseBibliographyItemType(publicationType),
    })

    const title = referenceNode.querySelector('article-title')?.textContent

    if (title) {
      bibliographyItem.title = title
    }

    const source = referenceNode.querySelector('source')?.textContent

    if (source) {
      bibliographyItem['container-title'] = source
    }

    const volume = referenceNode.querySelector('volume')?.textContent

    if (volume) {
      bibliographyItem.volume = volume
    }

    const fpage = referenceNode.querySelector('fpage')?.textContent
    const lpage = referenceNode.querySelector('lpage')?.textContent

    if (fpage) {
      bibliographyItem.page = lpage ? `${fpage}-${lpage}` : fpage
    }

    const year = referenceNode.querySelector('year')?.textContent

    if (year) {
      bibliographyItem.issued = buildBibliographicDate({
        'date-parts': [[year]],
      })
    }

    const authorNodes = referenceNode.querySelectorAll(
      'person-group[person-group-type="author"]'
    )

    const authors: BibliographicName[] = []

    authorNodes.forEach((authorNode, priority) => {
      const name = buildBibliographicName({})

      const given = authorNode.querySelector('given-names')?.textContent

      if (given) {
        name.given = given
      }

      const family = authorNode.querySelector('surname')?.textContent

      if (family) {
        name.family = family
      }

      authors.push(name)
    })

    if (authors.length) {
      bibliographyItem.author = authors
    }

    addModel(bibliographyItem)

    const id = referenceNode.getAttribute('id')

    if (id) {
      referenceIDs.set(id, bibliographyItem._id)
    }
  })

  const crossReferenceNodes = doc.querySelectorAll('body xref')

  crossReferenceNodes.forEach(crossReferenceNode => {
    const rid = crossReferenceNode.getAttribute('rid')

    if (rid) {
      const refType = crossReferenceNode.getAttribute('ref-type')

      switch (refType) {
        case 'bibr':
          {
            const rids = rid
              .split(/\s+/)
              .filter(id => referenceIDs.has(id))
              .map(id => referenceIDs.get(id)) as string[]

            if (rids.length) {
              const citation = buildCitation('', rids) // TODO: closest id

              addModel(citation)

              crossReferenceNode.setAttribute('rid', citation._id)
            } else {
              crossReferenceNode.removeAttribute('rid')
            }
          }
          break

        default:
          {
            const auxiliaryObjectReference = buildAuxiliaryObjectReference(
              '', // TODO: closest id
              rid // TODO: new figure id
            )

            addModel(auxiliaryObjectReference)

            crossReferenceNode.setAttribute('rid', auxiliaryObjectReference._id)
          }
          break
      }
    }
  })
}

export const addModelToMap = (modelMap: Map<string, Model>): AddModel => <
  T extends Model
>(
  data: Partial<T>
) => {
  data._id = generateID(data.objectType as ObjectTypes)

  modelMap.set(data._id, data as T)
}

export const parseJATSArticle = (doc: Document): Model[] => {
  const modelMap = new Map<string, Model>()
  const addModel = addModelToMap(modelMap)

  parseJATSFront(doc, addModel)
  parseJATSBack(doc, addModel)

  const node = parseJATSBody(doc)
  const bodyMap = encode(node.firstChild!)

  return [...modelMap.values(), ...bodyMap.values()]
}
