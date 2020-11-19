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
  // Journal,
  Manuscript,
  Model,
  // ObjectTypes,
} from '@manuscripts/manuscripts-json-schema'
import mime from 'mime'
import { DOMParser, ParseRule } from 'prosemirror-model'

import { ManuscriptNode, Marks, Nodes, schema } from '../schema'
import {
  Build,
  buildAffiliation,
  buildAuxiliaryObjectReference,
  buildBibliographicDate,
  buildBibliographicName,
  buildBibliographyItem,
  buildCitation,
  buildContributor,
  buildKeyword,
  buildManuscript,
} from './builders'
import { createNewBundle, createParentBundle } from './bundles'
import { loadBundlesMap, loadIssnBundleIndex } from './bundles-data'
import { encode } from './encode'
import { generateID } from './id'
import { Journal, parseJournalMeta, TypedValue } from './jats-journal-meta'
import { AddModel, addModelToMap } from './model-map'
import { nodeTypesMap } from './node-types'
import { chooseSectionCategory } from './section-category'

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
    getAttrs: (node) => ({
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
    getAttrs: (node) => {
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
    getAttrs: (node) => {
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
    getAttrs: (node) => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'disp-quote[content-type=pullquote]',
    node: 'pullquote_element',
    getAttrs: (node) => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'ext-link',
    node: 'link',
    getAttrs: (node) => {
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
    getAttrs: (node) => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'fig[fig-type=listing]',
    node: 'listing_element',
    getAttrs: (node) => {
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
    getAttrs: (node) => {
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
    getAttrs: (node) => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'fn',
    node: 'footnote',
    getAttrs: (node) => {
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
    getAttrs: (node) => {
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
    getAttrs: (node) => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'list[list-type=order]',
    node: 'ordered_list',
    getAttrs: (node) => {
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
    getAttrs: (node) => {
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
    getAttrs: (node) => {
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
    tag: 'label',
    context: 'figure/',
    ignore: true, // TODO
  },
  {
    tag: 'table',
    node: 'table',
    // TODO: count thead and tfoot rows
    getAttrs: (node) => {
      const element = node as HTMLElement

      return {
        id: element.getAttribute('id'),
      }
    },
  },
  {
    tag: 'table-wrap',
    node: 'table_element',
    getAttrs: (node) => {
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
    getAttrs: (node) => {
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
    getAttrs: (node) => {
      const element = node as HTMLElement

      return {
        rid: element.getAttribute('rid'),
        label: element.textContent,
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

    paragraphNodes.forEach((paragraphNode) => {
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

  output.descendants((node) => {
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

  output.descendants((node) => {
    // nodes that have an rid
    if ('rid' in node.attrs) {
      const previousRID = node.attrs.rid

      if (previousRID) {
        if (replacements.has(previousRID)) {
          node.attrs.rid = replacements.get(previousRID)
        } else {
          // console.warn(`Missing replacement for ${previousRID}`)
        }
      }
    }
  })
}

const moveSectionsToBody = (doc: Document) => {
  const body = doc.querySelector('body')

  if (body) {
    // move abstract from front to body
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

    // move sections from back to body
    for (const section of doc.querySelectorAll('back > sec')) {
      body.appendChild(section)
    }

    // move acknowledg(e)ments from back to body section
    const ack = doc.querySelector('back > ack')

    if (ack) {
      const section = doc.createElement('sec')
      section.setAttribute('sec-type', 'acknowledgments')

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

    // move bibliography from back to body section
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

      // TODO: generate bibliography?

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

// JATS to HTML conversion
const jatsToHtmlElementMap = new Map<string, string>([
  ['bold', 'b'],
  ['italic', 'i'],
  ['sc', 'style'], // TODO: style
  ['sub', 'sub'],
  ['sup', 'sup'],
])

const renameNodes = (
  node: Node,
  container: Node,
  nodeNameMap: Map<string, string>
) => {
  if (node.childNodes) {
    const document = container.ownerDocument as Document

    node.childNodes.forEach((childNode) => {
      switch (childNode.nodeType) {
        case Node.ELEMENT_NODE: {
          const newNodeName = nodeNameMap.get(childNode.nodeName)

          if (newNodeName) {
            const newNode = document.createElement(newNodeName)
            renameNodes(childNode, newNode, nodeNameMap)
            container.appendChild(newNode)
          } else {
            console.warn(`Unhandled node name: ${newNodeName}`)
            container.appendChild(childNode.cloneNode())
          }
          break
        }

        case Node.TEXT_NODE:
        default: {
          container.appendChild(childNode.cloneNode())
          break
        }
      }
    })
  }
}

const buildJournal = (journalMeta: Element | null): Partial<Journal> | null => {
  if (!journalMeta) {
    return null
  }

  return {
    ...parseJournalMeta(journalMeta),
    // objectType: ObjectTypes.Journal,
    // _id: generateID(ObjectTypes.Journal),
  }
}

const chooseBundle = async (
  issns: TypedValue[]
): Promise<string | undefined> => {
  const issnBundleIndex = await loadIssnBundleIndex()

  for (const { value: issn } of issns) {
    const normalizedIssn = issn.toUpperCase().replace(/[^0-9X]/g, '')

    if (normalizedIssn in issnBundleIndex) {
      return issnBundleIndex[normalizedIssn]
    }
  }
}

export const parseJATSFront = async (
  doc: Document,
  addModel: AddModel
): Promise<void> => {
  const front = doc.querySelector('front')

  if (!front) {
    throw new Error('No front element found!')
  }

  // manuscript

  const manuscript = buildManuscript() as Build<Manuscript> & {
    keywordIDs?: string[]
  }

  // journal metadata

  const journalMeta = doc.querySelector('front > journal-meta')

  const journal = buildJournal(journalMeta)

  // if (journal) {
  //   addModel<Journal>(journal) // TODO: store read-only Journal object for display?
  // }

  // manuscript bundle (CSL style)
  if (journal && journal.issns) {
    const bundleID = await chooseBundle(journal.issns)

    if (bundleID) {
      const bundlesMap = await loadBundlesMap()

      const bundle = createNewBundle(bundleID, bundlesMap)

      if (bundle) {
        const parentBundle = createParentBundle(bundle, bundlesMap)
        if (parentBundle) {
          addModel(parentBundle)
          // TODO: attach CSL style as attachment?
        }

        addModel(bundle)
        // TODO: attach CSL style as attachment?

        manuscript.bundle = bundle._id
      }

      // TODO: choose template using bundle identifier?
    }
  }

  const articleMeta = front.querySelector('article-meta')

  if (articleMeta) {
    // manuscript titles
    manuscript.title = htmlFromJatsNode(
      doc,
      articleMeta.querySelector('title-group > article-title')
    )

    manuscript.subtitle = htmlFromJatsNode(
      doc,
      articleMeta.querySelector('title-group > subtitle')
    )

    manuscript.runningTitle = htmlFromJatsNode(
      doc,
      articleMeta.querySelector(
        'title-group > alt-title[alt-title-type="right-running"]'
      )
    )

    // manuscript keywords
    const keywordGroupNode =
      articleMeta.querySelector(
        'article-meta > kwd-group[kwd-group-type="author"]'
      ) || articleMeta.querySelector('article-meta > kwd-group')

    if (keywordGroupNode) {
      manuscript.keywordIDs = []

      const keywordNodes = keywordGroupNode.querySelectorAll('kwd')

      let keywordPriority = 1

      for (const keywordNode of keywordNodes) {
        if (keywordNode.textContent) {
          const keyword = buildKeyword(keywordNode.textContent)
          keyword.priority = keywordPriority
          keywordPriority++

          addModel(keyword)

          manuscript.keywordIDs.push(keyword._id)
        }
      }
    }
  }

  addModel<Manuscript>(manuscript)

  // affiliations
  const affiliationIDs = new Map<string, string>()

  const affiliationNodes = front.querySelectorAll(
    'article-meta > contrib-group > aff'
  )

  affiliationNodes.forEach((affiliationNode, priority) => {
    const affiliation = buildAffiliation('', priority)

    for (const node of affiliationNode.querySelectorAll('institution')) {
      const content = node.textContent

      if (!content) {
        continue
      }

      const contentType = node.getAttribute('content-type')

      switch (contentType) {
        case null:
          affiliation.institution = content
          break

        case 'dept':
          affiliation.department = content
          break
      }
    }

    affiliation.addressLine1 =
      affiliationNode.querySelector('addr-line:nth-of-type(1)')?.textContent ||
      undefined
    affiliation.addressLine2 =
      affiliationNode.querySelector('addr-line:nth-of-type(2)')?.textContent ||
      undefined
    affiliation.addressLine3 =
      affiliationNode.querySelector('addr-line:nth-of-type(3)')?.textContent ||
      undefined

    // affiliation.postCode =
    //   affiliationNode.querySelector('postal-code')?.textContent || undefined
    // affiliation.city =
    //   affiliationNode.querySelector('city')?.textContent || undefined
    affiliation.country =
      affiliationNode.querySelector('country')?.textContent || undefined

    const id = affiliationNode.getAttribute('id')

    if (id) {
      affiliationIDs.set(id, affiliation._id)
    }

    addModel(affiliation)
  })

  // contributors

  // TODO: handle missing contrib-type?
  const authorNodes = front.querySelectorAll(
    'article-meta > contrib-group > contrib[contrib-type="author"]'
  )

  authorNodes.forEach((authorNode, priority) => {
    const name = buildBibliographicName({})

    const given = authorNode.querySelector('name > given-names')?.textContent

    if (given) {
      name.given = given
    }

    const surname = authorNode.querySelector('name > surname')?.textContent

    if (surname) {
      name.family = surname
    }

    const contributor = buildContributor(name, 'author', priority)

    const corresponding = authorNode.getAttribute('corresp') === 'yes'

    if (corresponding) {
      contributor.isCorresponding = corresponding
    }

    const orcid = authorNode.querySelector(
      'contrib-id[contrib-id-type="orcid"]'
    )?.textContent

    if (orcid) {
      contributor.ORCIDIdentifier = orcid
    }

    const xrefNode = authorNode.querySelector('xref[ref-type="aff"]')

    if (xrefNode) {
      const rid = xrefNode.getAttribute('rid')

      if (rid) {
        const rids = rid
          .split(/\s+/)
          .filter((id) => affiliationIDs.has(id))
          .map((id) => affiliationIDs.get(id)) as string[]

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

    const href = graphicNode.getAttributeNS(XLINK_NAMESPACE, 'href')

    if (href) {
      return mime.getType(href) || undefined
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

const htmlFromJatsNode = (
  doc: Document,
  element: Element | null
): string | undefined => {
  if (element) {
    const template = doc.createElement('template')

    renameNodes(element, template, jatsToHtmlElementMap)

    return template.innerHTML
  }
}

export const parseJATSBack = (doc: Document, addModel: AddModel): void => {
  const back = doc.querySelector('back')

  if (!back) {
    return
  }

  // TODO: appendices (app-group/app)
  // TODO: footnotes (fn-group/fn)
  // TODO: notes (notes)

  // references

  const referenceIDs = new Map<string, string>()

  const referenceNodes = doc.querySelectorAll('ref-list > ref')

  referenceNodes.forEach((referenceNode) => {
    const publicationType = referenceNode.getAttribute('publication-type')

    const bibliographyItem = buildBibliographyItem({
      type: chooseBibliographyItemType(publicationType),
    })

    const titleNode = referenceNode.querySelector('article-title')

    if (titleNode) {
      bibliographyItem.title = htmlFromJatsNode(doc, titleNode)
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

    const doi = referenceNode.querySelector('pub-id[pub-id-type="doi"]')
      ?.textContent

    if (doi) {
      bibliographyItem.DOI = doi
    }

    const pmid = referenceNode.querySelector('pub-id[pub-id-type="pmid"]')
      ?.textContent

    if (pmid) {
      bibliographyItem.PMID = pmid
    }

    const pmcid = referenceNode.querySelector('pub-id[pub-id-type="pmcid"]')
      ?.textContent

    if (pmcid) {
      bibliographyItem.PMCID = pmcid
    }

    // TODO: handle missing person-group-type?
    // TODO: handle contrib-group nested inside collab
    // TODO: handle collab name
    const authorNodes = [
      ...referenceNode.querySelectorAll(
        'person-group[person-group-type="author"] > *'
      ),
    ]

    const authors: BibliographicName[] = []

    authorNodes.forEach((authorNode) => {
      const name = buildBibliographicName({})

      const given = authorNode.querySelector('given-names')?.textContent

      if (given) {
        name.given = given
      }

      const family = authorNode.querySelector('surname')?.textContent

      if (family) {
        name.family = family
      }

      const suffix = authorNode.querySelector('suffix')?.textContent

      if (suffix) {
        name.suffix = suffix
      }

      authors.push(name)
    })

    if (authors.length) {
      bibliographyItem.author = authors
    }

    // TODO: handle `etal`?

    addModel(bibliographyItem)

    const id = referenceNode.getAttribute('id')

    if (id) {
      referenceIDs.set(id, bibliographyItem._id)
    }
  })

  const crossReferenceNodes = doc.querySelectorAll('body xref')

  crossReferenceNodes.forEach((crossReferenceNode) => {
    const rid = crossReferenceNode.getAttribute('rid')

    if (rid) {
      const refType = crossReferenceNode.getAttribute('ref-type')

      switch (refType) {
        case 'bibr':
          {
            const rids = rid
              .split(/\s+/)
              .filter((id) => referenceIDs.has(id))
              .map((id) => referenceIDs.get(id)) as string[]

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

export const parseJATSArticle = async (doc: Document): Promise<Model[]> => {
  const modelMap = new Map<string, Model>()
  const addModel = addModelToMap(modelMap)

  await parseJATSFront(doc, addModel)
  parseJATSBack(doc, addModel)

  const node = parseJATSBody(doc)

  if (!node.firstChild) {
    throw new Error('No content was parsed from the article body')
  }

  const bodyMap = encode(node.firstChild)

  // TODO: use ISSN from journal-meta to choose a template

  return [...modelMap.values(), ...bodyMap.values()]
}
