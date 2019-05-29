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

import {
  Affiliation,
  BibliographyItem,
  Citation,
  Contributor,
  Model,
  ObjectTypes,
} from '@manuscripts/manuscripts-json-schema'
import { DOMOutputSpec, DOMSerializer } from 'prosemirror-model'
import { iterateChildren } from '../lib/utils'
import {
  ManuscriptFragment,
  ManuscriptMark,
  ManuscriptNode,
  ManuscriptNodeType,
  ManuscriptSchema,
  Marks,
  Nodes,
  TableElementNode,
} from '../schema'
import { generateAttachmentFilename } from './filename'
import { selectVersionIds, Version } from './jats-versions'
// import { serializeTableToHTML } from './html'
import { isExecutableNode, isNodeType } from './node-types'
import { hasObjectType } from './object-types'
import {
  findLatestManuscriptSubmission,
  findManuscript,
} from './project-bundle'
import { sectionCategorySuffix } from './section-category'
import { xmlSerializer } from './serializer'

interface Attrs {
  [key: string]: string
}

type NodeSpecs = { [key in Nodes]: (node: ManuscriptNode) => DOMOutputSpec }

type MarkSpecs = {
  [key in Marks]: (mark: ManuscriptMark, inline: boolean) => DOMOutputSpec
}

const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

const normalizeID = (id: string) => id.replace(/:/g, '_')

const createSerializer = (document: Document) => {
  let serializer: DOMSerializer<ManuscriptSchema>

  const nodes: NodeSpecs = {
    bibliography_element: () => '',
    bibliography_section: node => [
      'ref-list',
      { id: normalizeID(node.attrs.id) },
      0,
    ],
    bullet_list: () => ['list', { 'list-type': 'bullet' }, 0],
    caption: () => ['caption', ['p', 0]],
    citation: node => {
      const xref = document.createElement('xref')
      xref.setAttribute('ref-type', 'bibr')
      xref.setAttribute('rid', normalizeID(node.attrs.rid))
      xref.textContent = node.attrs.contents.replace(/&amp;/g, '&') // TODO: decode all HTML entities?

      return xref
    },
    cross_reference: node => {
      const xref = document.createElement('xref')
      xref.setAttribute('ref-type', 'fig')
      xref.setAttribute('rid', normalizeID(node.attrs.rid))
      xref.textContent = node.attrs.label

      return xref
    },
    doc: () => '',
    equation: node => {
      const formula = document.createElement('disp-formula')

      const math = document.createElement('tex-math')
      math.textContent = node.attrs.TeXRepresentation
      formula.appendChild(math)

      return formula
    },
    equation_element: node =>
      createFigureElement(node, 'fig', node.type.schema.nodes.equation),
    figcaption: () => ['caption', ['p', 0]],
    figure: node => {
      const fig = document.createElement('fig')
      fig.setAttribute('id', normalizeID(node.attrs.id))

      if (node.attrs.label) {
        const label = document.createElement('label')
        label.textContent = node.attrs.label
        fig.appendChild(label)
      }

      const figcaptionNodeType = node.type.schema.nodes.figcaption

      node.forEach(childNode => {
        if (childNode.type === figcaptionNodeType) {
          fig.appendChild(serializer.serializeNode(childNode, { document }))
        }
      })

      const graphic = document.createElement('graphic')
      const filename = generateAttachmentFilename(
        node.attrs.id,
        node.attrs.contentType
      )
      graphic.setAttributeNS(
        XLINK_NAMESPACE,
        'xlink:href',
        `graphic/${filename}`
      )

      if (node.attrs.contentType) {
        const [mimeType, mimeSubType] = node.attrs.contentType.split('/')

        if (mimeType) {
          graphic.setAttribute('mimetype', mimeType)

          if (mimeSubType) {
            graphic.setAttribute('mime-subtype', mimeSubType)
          }
        }
      }

      fig.appendChild(graphic)

      return fig
    },
    figure_element: node =>
      createFigureElement(node, 'fig-group', node.type.schema.nodes.figure),
    footnote: node => ['fn', { id: normalizeID(node.attrs.id) }, 0],
    footnotes_element: node => ['fn-group', { id: normalizeID(node.attrs.id) }],
    hard_break: () => ['break'],
    inline_equation: node => {
      const formula = document.createElement('inline-formula')

      const math = document.createElement('tex-math')
      math.textContent = node.attrs.TeXRepresentation
      formula.appendChild(math)

      return formula
    },
    inline_footnote: node => {
      const xref = document.createElement('xref')
      xref.setAttribute('ref-type', 'fn')
      xref.setAttribute('rid', normalizeID(node.attrs.rid))
      xref.textContent = node.attrs.contents

      return xref
    },
    list_item: () => ['list-item', 0],
    listing: node => {
      const code = document.createElement('code')
      code.setAttribute('id', normalizeID(node.attrs.id))
      code.setAttribute('language', node.attrs.languageKey)
      code.textContent = node.attrs.contents

      return code
    },
    listing_element: node =>
      createFigureElement(node, 'fig', node.type.schema.nodes.listing),
    manuscript: node => ['article', { id: normalizeID(node.attrs.id) }, 0],
    ordered_list: () => ['list', { 'list-type': 'order' }, 0],
    paragraph: node => {
      const attrs: Attrs = {}

      if (node.attrs.id) {
        attrs.id = normalizeID(node.attrs.id)
      }

      return ['p', attrs, 0]
    },
    placeholder: () => {
      throw new Error('Placeholder!')
    },
    placeholder_element: () => {
      throw new Error('Placeholder element!')
    },
    section: node => {
      const attrs: { [key: string]: string } = {
        id: normalizeID(node.attrs.id),
      }

      if (node.attrs.category) {
        attrs['sec-type'] = sectionCategorySuffix(node.attrs.category)
      }

      return ['sec', attrs, 0]
    },
    section_title: () => ['title', 0],
    table: node => ['table', { id: normalizeID(node.attrs.id) }, 0],
    // table: node => serializeTableToHTML(node as TableNode),
    table_element: node =>
      createFigureElement(node, 'table-wrap', node.type.schema.nodes.table),
    table_cell: () => ['td', 0],
    table_row: () => ['tr', 0],
    text: node => node.text!,
    toc_element: node => ['div', { id: normalizeID(node.attrs.id) }],
    toc_section: node => ['sec', { id: normalizeID(node.attrs.id) }, 0],
  }

  const marks: MarkSpecs = {
    bold: () => ['bold'],
    code: () => ['code', { position: 'anchor' }], // TODO: inline?
    italic: () => ['italic'],
    link: node => ['a', { href: node.attrs.href }],
    smallcaps: () => ['sc'],
    strikethrough: () => ['strike'],
    superscript: () => ['sup'],
    subscript: () => ['sub'],
    underline: () => ['underline'],
  }

  serializer = new DOMSerializer<ManuscriptSchema>(nodes, marks)

  // tslint:disable-next-line:cyclomatic-complexity
  const createFigureElement = (
    node: ManuscriptNode,
    nodeName: string,
    contentNodeType: ManuscriptNodeType
  ) => {
    const element = document.createElement(nodeName)
    element.setAttribute('id', normalizeID(node.attrs.id))

    if (node.attrs.label) {
      const label = document.createElement('label')
      label.textContent = node.attrs.label
      element.appendChild(label)
    }

    const figcaptionNode = findChildNodeOfType(
      node,
      node.type.schema.nodes.figcaption
    )

    if (figcaptionNode) {
      element.appendChild(
        serializer.serializeNode(figcaptionNode, { document })
      )
    }

    node.forEach(childNode => {
      if (childNode.type === contentNodeType) {
        element.appendChild(serializer.serializeNode(childNode, { document }))
      }
    })

    if (isExecutableNode(node)) {
      const listingNode = findChildNodeOfType(
        node,
        node.type.schema.nodes.listing
      )

      if (listingNode) {
        const { contents, languageKey } = listingNode.attrs

        if (contents && languageKey) {
          const listing = document.createElement('fig')
          listing.setAttribute('specific-use', 'source')
          element.appendChild(listing)

          const code = document.createElement('code')
          code.setAttribute('executable', 'true')
          code.setAttribute('language', languageKey)
          code.textContent = contents
          listing.appendChild(code)

          // TODO: something more appropriate than "caption"?
          const caption = document.createElement('caption')
          listing.appendChild(caption)

          // TODO: real data
          const attachments: Array<{ id: string; type: string }> = []

          for (const attachment of attachments) {
            const p = document.createElement('p')
            caption.appendChild(p)

            const filename = generateAttachmentFilename(
              `${listingNode.attrs.id}:${attachment.id}`,
              attachment.type
            )

            const supp = document.createElement('supplementary-material')

            supp.setAttributeNS(
              XLINK_NAMESPACE,
              'xlink:href',
              `suppl/${filename}`
            )

            const [mimeType, mimeSubType] = attachment.type.split('/')

            if (mimeType) {
              supp.setAttribute('mimetype', mimeType)

              if (mimeSubType) {
                supp.setAttribute('mime-subtype', mimeSubType)
              }
            }

            // TODO: might need title, length, etc for data files

            p.appendChild(supp)
          }
        }
      }
    }

    return element
  }

  return serializer
}

const findChildNodeOfType = (
  node: ManuscriptNode,
  nodeType: ManuscriptNodeType
) => {
  for (const child of iterateChildren(node)) {
    if (child.type === nodeType) {
      return child
    }
  }
}

const buildContributors = (
  document: Document,
  modelMap: Map<string, Model>,
  articleMeta: Node
) => {
  const models = Array.from(modelMap.values())

  const contributors = models.filter(
    hasObjectType<Contributor>(ObjectTypes.Contributor)
  )

  if (contributors && contributors.length) {
    const contribGroup = document.createElement('contrib-group')
    contribGroup.setAttribute('content-type', 'authors')
    articleMeta.appendChild(contribGroup)

    contributors.sort((a, b) => Number(a.priority) - Number(b.priority))

    contributors.forEach(contributor => {
      const contrib = document.createElement('contrib')
      contrib.setAttribute('contrib-type', 'author')
      contrib.setAttribute('id', normalizeID(contributor._id))

      if (contributor.isCorresponding) {
        contrib.setAttribute('corresp', 'yes')
      }

      const name = document.createElement('name')
      contrib.appendChild(name)

      if (contributor.bibliographicName.family) {
        const surname = document.createElement('surname')
        surname.textContent = contributor.bibliographicName.family
        name.appendChild(surname)
      }

      if (contributor.bibliographicName.given) {
        const givenNames = document.createElement('given-names')
        givenNames.textContent = contributor.bibliographicName.given
        name.appendChild(givenNames)
      }

      if (contributor.email) {
        const email = document.createElement('email')
        email.textContent = contributor.email
        contrib.appendChild(email)
      }

      if (contributor.affiliations) {
        contributor.affiliations.forEach(rid => {
          const xref = document.createElement('xref')
          xref.setAttribute('ref-type', 'aff')
          xref.setAttribute('rid', normalizeID(rid))
          contrib.appendChild(xref)
        })
      }

      contribGroup.appendChild(contrib)
    })

    const affiliationRIDs: string[] = []

    contributors.forEach(contributor => {
      if (contributor.affiliations) {
        affiliationRIDs.push(...contributor.affiliations)
      }
    })

    const affiliations = models.filter(
      hasObjectType<Affiliation>(ObjectTypes.Affiliation)
    )

    if (affiliations) {
      const usedAffiliations = affiliations.filter(
        affiliation => affiliationRIDs.indexOf(affiliation._id) !== -1
      )

      usedAffiliations.sort(
        (a, b) =>
          affiliationRIDs.indexOf(a._id) - affiliationRIDs.indexOf(b._id)
      )

      usedAffiliations.forEach(affiliation => {
        const aff = document.createElement('aff')
        aff.setAttribute('id', normalizeID(affiliation._id))

        if (affiliation.institution) {
          const institution = document.createElement('institution')
          institution.textContent = affiliation.institution
          aff.appendChild(institution)
        }

        if (affiliation.addressLine1) {
          const addressLine = document.createElement('addr-line')
          addressLine.textContent = affiliation.addressLine1
          aff.appendChild(addressLine)
        }

        if (affiliation.addressLine2) {
          const addressLine = document.createElement('addr-line')
          addressLine.textContent = affiliation.addressLine2
          aff.appendChild(addressLine)
        }

        if (affiliation.addressLine3) {
          const addressLine = document.createElement('addr-line')
          addressLine.textContent = affiliation.addressLine3
          aff.appendChild(addressLine)
        }

        if (affiliation.city) {
          const city = document.createElement('city')
          city.textContent = affiliation.city
          aff.appendChild(city)
        }

        if (affiliation.country) {
          const country = document.createElement('country')
          country.textContent = affiliation.country
          aff.appendChild(country)
        }

        articleMeta.appendChild(aff)
      })
    }
  }
}

// tslint:disable-next-line:cyclomatic-complexity
const buildFront = (
  document: Document,
  modelMap: Map<string, Model>,
  doi?: string,
  id?: string
) => {
  const manuscript = findManuscript(modelMap)

  const submission = findLatestManuscriptSubmission(modelMap, manuscript)

  const front = document.createElement('front')

  const journalMeta = document.createElement('journal-meta')
  front.appendChild(journalMeta)

  const journalID = document.createElement('journal-id')
  journalID.setAttribute('journal-id-type', 'publisher-id')
  if (submission && submission.journalCode) {
    journalID.textContent = submission.journalCode
  }
  journalMeta.appendChild(journalID)

  const journalTitleGroup = document.createElement('journal-title-group')
  journalMeta.appendChild(journalTitleGroup)

  const journalTitle = document.createElement('journal-title')
  if (submission && submission.journalTitle) {
    journalTitle.textContent = submission.journalTitle
  }
  journalTitleGroup.appendChild(journalTitle)

  const issn = document.createElement('issn')
  issn.setAttribute('pub-type', 'epub')
  if (submission && submission.issn) {
    issn.textContent = submission.issn
  }
  journalMeta.appendChild(issn)

  const articleMeta = document.createElement('article-meta')
  front.appendChild(articleMeta)

  if (id) {
    const articleID = document.createElement('article-id')
    articleID.setAttribute('pub-id-type', 'publisher-id')
    articleID.textContent = id
    articleMeta.appendChild(articleID)
  }

  if (doi) {
    const articleID = document.createElement('article-id')
    articleID.setAttribute('pub-id-type', 'doi')
    articleID.textContent = doi
    articleMeta.appendChild(articleID)
  }

  const titleGroup = document.createElement('title-group')
  articleMeta.appendChild(titleGroup)

  const articleTitle = document.createElement('article-title')
  articleTitle.textContent = manuscript.title! // TODO: serialize to JATS from title-editor
  titleGroup.appendChild(articleTitle)

  buildContributors(document, modelMap, articleMeta)

  // const now = new Date()
  // const isodate = now.toISOString().replace(/T.*/, '')
  // const [isoyear, isomonth, isoday] = isodate.split('-')
  //
  // const pubDate = document.createElement('pub-date')
  // pubDate.setAttribute('pub-type', 'epreprint')
  // pubDate.setAttribute('date-type', 'preprint')
  // pubDate.setAttribute('iso-8601-date', isodate)
  //
  // const pubDateDay = document.createElement('day')
  // pubDateDay.textContent = isoday
  // pubDate.appendChild(pubDateDay)
  //
  // const pubDateMonth = document.createElement('month')
  // pubDateMonth.textContent = isomonth
  // pubDate.appendChild(pubDateMonth)
  //
  // const pubDateYear = document.createElement('year')
  // pubDateYear.textContent = isoyear
  // pubDate.appendChild(pubDateYear)
  //
  // articleMeta.appendChild(pubDate)
  //
  // const elocationID = document.createElement('elocation-id')
  // articleMeta.appendChild(elocationID)

  return front
}

const buildBody = (document: Document, fragment: ManuscriptFragment) => {
  const serializer = createSerializer(document)

  const content = serializer.serializeFragment(fragment, { document })

  const body = document.createElement('body')
  body.appendChild(content)

  fixBody(body, document, fragment)

  return body
}

// tslint:disable:cyclomatic-complexity
const buildBack = (document: Document, modelMap: Map<string, Model>) => {
  const back = document.createElement('back')

  const values = Array.from(modelMap.values())

  const citations = values.filter(hasObjectType<Citation>(ObjectTypes.Citation))

  const bibliographyItems = values.filter(
    hasObjectType<BibliographyItem>(ObjectTypes.BibliographyItem)
  )

  const bibliographyItemIDsSet: Set<string> = new Set()

  const xrefs = document.querySelectorAll('xref[ref-type=bibr]')

  for (const xref of xrefs) {
    const rid = xref.getAttribute('rid')

    const citation = citations.find(
      citation => normalizeID(citation._id) === rid
    )

    if (citation) {
      const bibliographyItemIDs = citation.embeddedCitationItems.map(
        citationItem => citationItem.bibliographyItem
      )

      // NOTE: https://www.ncbi.nlm.nih.gov/pmc/pmcdoc/tagging-guidelines/article/tags.html#el-xref
      xref.setAttribute('rid', bibliographyItemIDs.map(normalizeID).join(' '))

      for (const bibliographyItemID of bibliographyItemIDs) {
        bibliographyItemIDsSet.add(bibliographyItemID)
      }
    }
  }

  const refList = document.querySelector('ref-list')

  if (refList) {
    back.appendChild(refList)

    for (const bibliographyItemID of bibliographyItemIDsSet) {
      const bibliographyItem = bibliographyItems.find(
        bibliographyItem => bibliographyItem._id === bibliographyItemID
      )

      if (bibliographyItem) {
        const ref = document.createElement('ref')
        ref.setAttribute('id', normalizeID(bibliographyItem._id))

        const citation = document.createElement('element-citation')

        citation.setAttribute('publication-type', 'journal')
        // TODO: add citation elements depending on publication type
        // citation.setAttribute('publication-type', bibliographyItem.type)

        if (bibliographyItem.author) {
          bibliographyItem.author.forEach(author => {
            const name = document.createElement('name')

            if (author.family) {
              const node = document.createElement('surname')
              node.textContent = author.family
              name.appendChild(node)
            }

            if (author.given) {
              const node = document.createElement('given-names')
              node.textContent = author.given
              name.appendChild(node)
            }

            citation.appendChild(name)
          })
        }

        if (bibliographyItem.title) {
          const node = document.createElement('article-title')
          node.textContent = bibliographyItem.title
          citation.appendChild(node)
        }

        if (bibliographyItem.source) {
          const node = document.createElement('source')
          node.textContent = bibliographyItem.source
          citation.appendChild(node)
        }

        if (bibliographyItem.volume) {
          const node = document.createElement('volume')
          node.textContent = String(bibliographyItem.volume)
          citation.appendChild(node)
        }

        if (bibliographyItem.issue) {
          const node = document.createElement('issue')
          node.textContent = String(bibliographyItem.issue)
          citation.appendChild(node)
        }

        // TODO: use bibliographyItem.page?
        if (bibliographyItem['page-first']) {
          const node = document.createElement('fpage')
          node.textContent = String(bibliographyItem['page-first'])
          citation.appendChild(node)
        }

        if (bibliographyItem.issued) {
          const { 'date-parts': dateParts } = bibliographyItem.issued

          if (dateParts && dateParts.length) {
            const [[year, month, day]] = dateParts

            if (year) {
              const node = document.createElement('year')
              node.textContent = String(year)
              citation.appendChild(node)
            }

            if (month) {
              const node = document.createElement('month')
              node.textContent = String(month)
              citation.appendChild(node)
            }

            if (day) {
              const node = document.createElement('day')
              node.textContent = String(day)
              citation.appendChild(node)
            }
          }
        }

        ref.appendChild(citation)
        refList.appendChild(ref)
      }
    }
  }

  return back
}

const fixTable = (
  table: ChildNode,
  document: Document,
  node: ManuscriptNode
) => {
  const rows = Array.from(table.childNodes)

  const theadRows = rows.splice(0, 1)
  const tfootRows = rows.splice(-1, 1)

  // thead
  if (node.attrs.suppressHeader) {
    for (const row of theadRows) {
      table.removeChild(row)
    }
  } else {
    const thead = document.createElement('thead')

    for (const row of theadRows) {
      thead.appendChild(row)
    }

    table.appendChild(thead)
  }

  // tfoot
  if (node.attrs.suppressFooter) {
    for (const row of tfootRows) {
      table.removeChild(row)
    }
  } else {
    const tfoot = document.createElement('tfoot')

    for (const row of tfootRows) {
      tfoot.appendChild(row)
    }

    table.appendChild(tfoot)
  }

  // tbody
  const tbody = document.createElement('tbody')

  for (const row of rows) {
    tbody.appendChild(row)
  }

  table.appendChild(tbody)
}

const fixBody = (
  body: Element,
  document: Document,
  fragment: ManuscriptFragment
) => {
  fragment.descendants(node => {
    if (node.attrs.id) {
      // remove suppressed titles
      if (node.attrs.titleSuppressed) {
        const title = body.querySelector(
          `#${normalizeID(node.attrs.id)} > title`
        )

        if (title && title.parentNode) {
          title.parentNode.removeChild(title)
        }
      }

      // remove suppressed captions
      if (node.attrs.suppressCaption) {
        // TODO: need to query deeper?
        const caption = body.querySelector(
          `#${normalizeID(node.attrs.id)} > caption`
        )

        if (caption && caption.parentNode) {
          caption.parentNode.removeChild(caption)
        }
      }

      // move captions to the top of tables
      if (isNodeType<TableElementNode>(node, 'table_element')) {
        const tableElement = body.querySelector(
          `#${normalizeID(node.attrs.id)}`
        )

        if (tableElement) {
          for (const childNode of tableElement.childNodes) {
            switch (childNode.nodeName) {
              case 'caption': {
                if (node.attrs.suppressCaption) {
                  tableElement.removeChild(childNode)
                } else {
                  tableElement.insertBefore(childNode, tableElement.firstChild)
                }
                break
              }

              case 'table': {
                fixTable(childNode, document, node)
                break
              }
            }
          }
        }
      }
    }
  })
}

const moveAbstract = (
  document: Document,
  front: HTMLElement,
  body: HTMLElement
) => {
  const sections = body.querySelectorAll(':scope > sec')

  const abstractSection = Array.from(sections).find(section => {
    if (section.getAttribute('sec-type') === 'abstract') {
      return true
    }

    const sectionTitle = section.querySelector(':scope > title')

    if (!sectionTitle) {
      return false
    }

    return sectionTitle.textContent === 'Abstract'
  })

  if (abstractSection && abstractSection.parentNode) {
    const abstractNode = document.createElement('abstract')

    // TODO: ensure that abstract section schema is valid
    while (abstractSection.firstChild) {
      abstractNode.appendChild(abstractSection.firstChild)
    }

    abstractSection.parentNode.removeChild(abstractSection)

    const articleMeta = front.querySelector(':scope > article-meta')

    if (articleMeta) {
      insertAbstractNode(articleMeta, abstractNode)
    }
  }
}

// siblings from https://jats.nlm.nih.gov/archiving/tag-library/1.2/element/article-meta.html
const insertAbstractNode = (articleMeta: Element, abstractNode: Element) => {
  const siblings = [
    'kwd-group',
    'funding-group',
    'support-group',
    'conference',
    'counts',
    'custom-meta-group',
  ]

  for (const sibling of siblings) {
    const siblingNode = articleMeta.querySelector(`:scope > ${sibling}`)

    if (siblingNode) {
      articleMeta.insertBefore(abstractNode, siblingNode)
      return
    }
  }

  articleMeta.appendChild(abstractNode)
}

export const serializeToJATS = (
  fragment: ManuscriptFragment,
  modelMap: Map<string, Model>,
  version: Version = '1.2',
  doi?: string,
  id?: string
): string => {
  const versionIds = selectVersionIds(version)

  const doc = document.implementation.createDocument(
    null,
    'article',
    document.implementation.createDocumentType(
      'article',
      versionIds.publicId,
      versionIds.systemId
    )
  )

  const article = doc.documentElement

  article.setAttributeNS(
    'http://www.w3.org/2000/xmlns/',
    'xmlns:xlink',
    XLINK_NAMESPACE
  )

  const front = buildFront(doc, modelMap, doi, id)
  article.appendChild(front)

  const body = buildBody(doc, fragment)
  article.appendChild(body)

  const back = buildBack(doc, modelMap)
  article.appendChild(back)

  moveAbstract(doc, front, body)

  return xmlSerializer.serializeToString(doc)
}
