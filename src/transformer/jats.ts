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
  Figure,
  Manuscript,
  Model,
  ObjectTypes,
} from '@manuscripts/manuscripts-json-schema'
import { DOMOutputSpec, DOMSerializer } from 'prosemirror-model'
import {
  FigureElementNode,
  ManuscriptFragment,
  ManuscriptMark,
  ManuscriptNode,
  ManuscriptSchema,
  Marks,
  Nodes,
  TableElementNode,
} from '../schema'
// import { serializeTableToHTML } from './html'
import { isNodeType } from './node-types'
import { hasObjectType } from './object-types'
import { xmlSerializer } from './serializer'

interface Attrs {
  [key: string]: string
}

type NodeSpecs = { [key in Nodes]: (node: ManuscriptNode) => DOMOutputSpec }

type MarkSpecs = {
  [key in Marks]: (mark: ManuscriptMark, inline: boolean) => DOMOutputSpec
}

const normalizeID = (id: string) => id.replace(/:/g, '_')

const nodes = (document: Document): NodeSpecs => ({
  bibliography_element: () => ['ref-list'], // TODO: remove
  bibliography_section: () => ['ref-list', 0],
  bullet_list: () => ['list', { 'list-type': 'bullet' }, 0],
  caption: () => ['caption', ['p', 0]],
  citation: node => {
    const xref = document.createElement('xref')
    xref.setAttribute('ref-type', 'bibr')
    xref.setAttribute('rid', normalizeID(node.attrs.rid))
    xref.innerHTML = node.attrs.contents

    return xref
  },
  cross_reference: node => {
    const xref = document.createElement('xref')
    xref.setAttribute('ref-type', 'fig')
    xref.setAttribute('rid', normalizeID(node.attrs.rid))
    xref.textContent = node.attrs.label

    return xref
  },
  doc: () => ['div', 0],
  equation: node => {
    const formula = document.createElement('disp-formula')

    const math = document.createElement('tex-math')
    math.textContent = node.attrs.TeXRepresentation
    formula.appendChild(math)

    return formula
  },
  equation_element: node => ['fig', { id: normalizeID(node.attrs.id) }, 0],
  figcaption: () => ['caption', ['p', 0]],
  figure_element: node => ['fig-group', { id: normalizeID(node.attrs.id) }, 0],
  footnote: node => ['fn', { id: normalizeID(node.attrs.id) }, 0],
  footnotes_element: node => ['fn-group', { id: normalizeID(node.attrs.id) }],
  hard_break: () => 'break',
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
  listing_element: node => ['fig', { id: normalizeID(node.attrs.id) }, 0],
  manuscript: node => ['article', { id: normalizeID(node.attrs.id) }, 0],
  ordered_list: () => ['list', { 'list-type': 'ordered' }, 0],
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
  section: node => ['sec', { id: normalizeID(node.attrs.id) }, 0],
  section_title: () => ['title', 0],
  table: node => ['table', { id: normalizeID(node.attrs.id) }, 0],
  // table: node => serializeTableToHTML(node as TableNode),
  table_element: node => ['table-wrap', { id: normalizeID(node.attrs.id) }, 0],
  table_cell: () => ['td', 0],
  tbody_row: () => ['tr', 0],
  text: node => node.text!,
  tfoot_row: () => ['tr', 0],
  thead_row: () => ['tr', 0],
  toc_element: node => ['div', { id: normalizeID(node.attrs.id) }],
  toc_section: node => ['sec', { id: normalizeID(node.attrs.id) }, 0],
})

const marks = (): MarkSpecs => ({
  bold: () => ['bold'],
  code: () => ['code', { position: 'anchor' }], // TODO: inline?
  italic: () => ['italic'],
  link: node => ['a', { href: node.attrs.href }],
  smallcaps: () => ['sc'],
  strikethrough: () => ['strike'],
  superscript: () => ['sup'],
  subscript: () => ['sub'],
  underline: () => ['underline'],
})

const buildFront = (
  document: Document,
  manuscript: Manuscript,
  modelMap: Map<string, Model>
) => {
  const front = document.createElement('front')

  const journalMeta = document.createElement('journal-meta')
  front.appendChild(journalMeta)

  const journalID = document.createElement('journal-id')
  journalID.setAttribute('journal-id-type', 'publisher-id')
  journalMeta.appendChild(journalID)

  const journalTitleGroup = document.createElement('journal-title-group')
  journalMeta.appendChild(journalTitleGroup)

  const journalTitle = document.createElement('journal-title')
  journalTitleGroup.appendChild(journalTitle)

  const issn = document.createElement('issn')
  issn.setAttribute('pub-type', 'epub')
  journalMeta.appendChild(issn)

  const articleMeta = document.createElement('article-meta')
  front.appendChild(articleMeta)

  const titleGroup = document.createElement('title-group')
  articleMeta.appendChild(titleGroup)

  const articleTitle = document.createElement('article-title')
  articleTitle.textContent = manuscript.title! // TODO: serialize to JATS from title-editor
  titleGroup.appendChild(articleTitle)

  const contributors = Array.from(modelMap.values()).filter(
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

    const affiliations = Array.from(modelMap.values()).filter(
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

  const now = new Date()
  const isodate = now.toISOString().replace(/T.*/, '')
  const [isoyear, isomonth, isoday] = isodate.split('-')

  const pubDate = document.createElement('pub-date')
  pubDate.setAttribute('pub-type', 'epreprint')
  pubDate.setAttribute('date-type', 'preprint')
  pubDate.setAttribute('iso-8601-date', isodate)

  const pubDateDay = document.createElement('day')
  pubDateDay.textContent = isoday
  pubDate.appendChild(pubDateDay)

  const pubDateMonth = document.createElement('month')
  pubDateMonth.textContent = isomonth
  pubDate.appendChild(pubDateMonth)

  const pubDateYear = document.createElement('year')
  pubDateYear.textContent = isoyear
  pubDate.appendChild(pubDateYear)

  articleMeta.appendChild(pubDate)

  const elocationID = document.createElement('elocation-id')
  articleMeta.appendChild(elocationID)

  return front
}

const buildBody = (document: Document, fragment: ManuscriptFragment) => {
  const serializer = new DOMSerializer<ManuscriptSchema>(
    nodes(document),
    marks()
  )

  const content = serializer.serializeFragment(fragment, { document })

  const body = document.createElement('body')
  body.appendChild(content)

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

const fixBody = (
  document: Document,
  fragment: ManuscriptFragment,
  modelMap: Map<string, Model>
) => {
  const figures = Array.from(modelMap.values()).filter(
    hasObjectType<Figure>(ObjectTypes.Figure)
  )

  let figureIndex = 0

  // tslint:disable:cyclomatic-complexity
  fragment.descendants(node => {
    if (node.attrs.id) {
      // remove suppressed titles
      if (node.attrs.titleSuppressed) {
        const title = document.querySelector(
          `#${normalizeID(node.attrs.id)} > title`
        )

        if (title && title.parentNode) {
          title.parentNode.removeChild(title)
        }
      }

      // remove suppressed captions
      if (node.attrs.suppressCaption) {
        // TODO: need to query deeper?
        const caption = document.querySelector(
          `#${normalizeID(node.attrs.id)} > caption`
        )

        if (caption && caption.parentNode) {
          caption.parentNode.removeChild(caption)
        }
      }

      // move captions to the top of tables
      if (isNodeType<TableElementNode>(node, 'table_element')) {
        const tableElement = document.querySelector(
          `#${normalizeID(node.attrs.id)}`
        )

        if (tableElement) {
          for (const childNode of tableElement.childNodes) {
            if (childNode.nodeName === 'caption') {
              tableElement.insertBefore(childNode, tableElement.firstChild)
            }
          }
        }
      }

      // add figures to figure groups
      if (isNodeType<FigureElementNode>(node, 'figure_element')) {
        const figureElement = document.querySelector(
          `#${normalizeID(node.attrs.id)}`
        )

        if (figureElement) {
          const containedObjects = node.attrs.containedObjectIDs.map(
            containedObjectID =>
              figures.find(model => model._id === containedObjectID)
          )

          containedObjects.forEach(containedObject => {
            if (containedObject) {
              const fig = document.createElement('fig')
              fig.setAttribute('id', normalizeID(containedObject._id))

              const label = document.createElement('label')
              label.textContent = `Figure ${++figureIndex}` // TODO: label from settings
              fig.appendChild(label)

              const [mimeType, mimeSubType] = containedObject.contentType.split(
                '/'
              )

              const graphic = document.createElement('graphic')
              graphic.setAttribute('mimetype', mimeType)
              graphic.setAttribute('mime-subtype', mimeSubType)
              graphic.setAttributeNS(
                'http://www.w3.org/1999/xlink',
                'xlink:href',
                `Data/${normalizeID(containedObject._id)}`
              )
              fig.appendChild(graphic)

              figureElement.appendChild(fig)
            }
          })
        }
      }
    }
  })
}

export const serializeToJATS = (
  fragment: ManuscriptFragment,
  manuscript: Manuscript,
  modelMap: Map<string, Model>
) => {
  const doc = document.implementation.createDocument(
    null, // 'http://jats.nlm.nih.gov/publishing/1.1/JATS-journalpublishing1.dtd'
    'article',
    document.implementation.createDocumentType(
      'article',
      '-//NLM//DTD JATS (Z39.96) Journal Publishing DTD v1.1 20151215//EN',
      'http://jats.nlm.nih.gov/publishing/1.1/JATS-journalpublishing1.dtd'
    )
  )

  const article = doc.documentElement

  article.setAttributeNS(
    'http://www.w3.org/2000/xmlns/',
    'xmlns:xlink',
    'http://www.w3.org/1999/xlink'
  )

  // for PMC
  // article.setAttributeNS(
  //   'http://www.w3.org/2000/xmlns/',
  //   'xmlns:ali',
  //   'http://www.niso.org/schemas/ali/1.0/'
  // )

  const front = buildFront(doc, manuscript, modelMap)
  article.appendChild(front)

  const body = buildBody(doc, fragment)
  article.appendChild(body)

  const back = buildBack(doc, modelMap)
  article.appendChild(back)

  fixBody(doc, fragment, modelMap)

  return xmlSerializer.serializeToString(doc)
}
