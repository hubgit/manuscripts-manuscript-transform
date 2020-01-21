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
  AuxiliaryObjectReference,
  BibliographyItem,
  Citation,
  Contributor,
  Footnote,
  Keyword,
  Model,
  ObjectTypes,
} from '@manuscripts/manuscripts-json-schema'
import debug from 'debug'
import { DOMOutputSpec, DOMParser, DOMSerializer } from 'prosemirror-model'
import { nodeFromHTML, textFromHTML } from '../lib/html'
import { iterateChildren } from '../lib/utils'
import {
  FigureElementNode,
  ManuscriptFragment,
  ManuscriptMark,
  ManuscriptNode,
  ManuscriptNodeType,
  ManuscriptSchema,
  Marks,
  Nodes,
  schema,
  TableElementNode,
} from '../schema'
import { generateAttachmentFilename } from './filename'
import { selectVersionIds, Version } from './jats-versions'
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

const warn = debug('manuscripts-transform')

const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

const normalizeID = (id: string) => id.replace(/:/g, '_')

const parser = DOMParser.fromSchema(schema)

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

export class JATSTransformer {
  private document: Document
  private modelMap: Map<string, Model>
  private models: Model[]
  private serializer: DOMSerializer<ManuscriptSchema>

  public serializeToJATS = (
    fragment: ManuscriptFragment,
    modelMap: Map<string, Model>,
    version: Version = '1.2',
    doi?: string,
    id?: string,
    frontMatterOnly: boolean = false
  ) => {
    this.modelMap = modelMap
    this.models = Array.from(this.modelMap.values())

    this.createSerializer()

    const versionIds = selectVersionIds(version)

    this.document = document.implementation.createDocument(
      null,
      'article',
      document.implementation.createDocumentType(
        'article',
        versionIds.publicId,
        versionIds.systemId
      )
    )

    const article = this.document.documentElement

    article.setAttributeNS(
      'http://www.w3.org/2000/xmlns/',
      'xmlns:xlink',
      XLINK_NAMESPACE
    )

    const front = this.buildFront(doi, id)
    article.appendChild(front)

    if (!frontMatterOnly) {
      const body = this.buildBody(fragment)
      article.appendChild(body)

      const back = this.buildBack()
      article.appendChild(back)

      this.moveAbstract(front, body)
    }

    return xmlSerializer.serializeToString(this.document)
  }

  private serializeFragment = (fragment: ManuscriptFragment) =>
    this.serializer.serializeFragment(fragment, {
      document: this.document,
    })

  private serializeNode = (node: ManuscriptNode) =>
    this.serializer.serializeNode(node, {
      document: this.document,
    })

  private validateContributor = (contributor: Contributor) => {
    if (!contributor.bibliographicName) {
      throw new Error(`${contributor._id} has no bibliographicName`)
    }

    const { family, given } = contributor.bibliographicName

    if (!family && !given) {
      throw new Error(`${contributor._id} has neither family nor given name`)
    }
  }

  private buildContributors = (articleMeta: Node) => {
    const contributors = this.models.filter(
      hasObjectType<Contributor>(ObjectTypes.Contributor)
    )

    if (contributors && contributors.length) {
      const contribGroup = this.document.createElement('contrib-group')
      contribGroup.setAttribute('content-type', 'authors')
      articleMeta.appendChild(contribGroup)

      contributors.sort((a, b) => Number(a.priority) - Number(b.priority))

      contributors.forEach(contributor => {
        try {
          this.validateContributor(contributor)
        } catch (error) {
          warn(error.message)
          return
        }

        const contrib = this.document.createElement('contrib')
        contrib.setAttribute('contrib-type', 'author')
        contrib.setAttribute('id', normalizeID(contributor._id))

        if (contributor.isCorresponding) {
          contrib.setAttribute('corresp', 'yes')
        }

        const name = this.document.createElement('name')
        contrib.appendChild(name)

        if (contributor.bibliographicName.family) {
          const surname = this.document.createElement('surname')
          surname.textContent = contributor.bibliographicName.family
          name.appendChild(surname)
        }

        if (contributor.bibliographicName.given) {
          const givenNames = this.document.createElement('given-names')
          givenNames.textContent = contributor.bibliographicName.given
          name.appendChild(givenNames)
        }

        if (contributor.email) {
          const email = this.document.createElement('email')
          email.textContent = contributor.email
          contrib.appendChild(email)
        }

        if (contributor.affiliations) {
          contributor.affiliations.forEach(rid => {
            const xref = this.document.createElement('xref')
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

      const affiliations = this.models.filter(
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
          const aff = this.document.createElement('aff')
          aff.setAttribute('id', normalizeID(affiliation._id))

          if (affiliation.institution) {
            const institution = this.document.createElement('institution')
            institution.textContent = affiliation.institution
            aff.appendChild(institution)
          }

          if (affiliation.addressLine1) {
            const addressLine = this.document.createElement('addr-line')
            addressLine.textContent = affiliation.addressLine1
            aff.appendChild(addressLine)
          }

          if (affiliation.addressLine2) {
            const addressLine = this.document.createElement('addr-line')
            addressLine.textContent = affiliation.addressLine2
            aff.appendChild(addressLine)
          }

          if (affiliation.addressLine3) {
            const addressLine = this.document.createElement('addr-line')
            addressLine.textContent = affiliation.addressLine3
            aff.appendChild(addressLine)
          }

          if (affiliation.city) {
            const city = this.document.createElement('city')
            city.textContent = affiliation.city
            aff.appendChild(city)
          }

          if (affiliation.country) {
            const country = this.document.createElement('country')
            country.textContent = affiliation.country
            aff.appendChild(country)
          }

          articleMeta.appendChild(aff)
        })
      }
    }
  }

  private buildKeywords(articleMeta: Node, keywordIDs: string[]) {
    const keywords = keywordIDs
      .map(id => this.modelMap.get(id) as Keyword | undefined)
      .filter(model => model && model.name) as Keyword[]

    if (keywords.length) {
      const kwdGroup = this.document.createElement('kwd-group')
      kwdGroup.setAttribute('kwd-group-type', 'author')
      articleMeta.appendChild(kwdGroup)

      for (const keyword of keywords) {
        const kwd = this.document.createElement('kwd')
        kwd.textContent = keyword.name
        kwdGroup.appendChild(kwd)
      }
    }
  }

  // tslint:disable-next-line:cyclomatic-complexity
  private buildFront = (doi?: string, id?: string) => {
    const manuscript = findManuscript(this.modelMap)

    const submission = findLatestManuscriptSubmission(this.modelMap, manuscript)

    const front = this.document.createElement('front')

    if (submission) {
      const journalMeta = this.document.createElement('journal-meta')
      front.appendChild(journalMeta)

      if (submission.journalCode) {
        const journalID = this.document.createElement('journal-id')
        journalID.setAttribute('journal-id-type', 'publisher-id')
        journalID.textContent = submission.journalCode
        journalMeta.appendChild(journalID)
      }

      if (submission.journalTitle) {
        const journalTitleGroup = this.document.createElement(
          'journal-title-group'
        )
        journalMeta.appendChild(journalTitleGroup)

        const journalTitle = this.document.createElement('journal-title')
        journalTitle.textContent = submission.journalTitle
        journalTitleGroup.appendChild(journalTitle)
      }

      if (submission.issn) {
        const issn = this.document.createElement('issn')
        issn.setAttribute('pub-type', 'epub')
        issn.textContent = submission.issn
        journalMeta.appendChild(issn)
      }
    }

    const articleMeta = this.document.createElement('article-meta')
    front.appendChild(articleMeta)

    if (id) {
      const articleID = this.document.createElement('article-id')
      articleID.setAttribute('pub-id-type', 'publisher-id')
      articleID.textContent = id
      articleMeta.appendChild(articleID)
    }

    if (doi) {
      const articleID = this.document.createElement('article-id')
      articleID.setAttribute('pub-id-type', 'doi')
      articleID.textContent = doi
      articleMeta.appendChild(articleID)
    }

    const titleGroup = this.document.createElement('title-group')
    articleMeta.appendChild(titleGroup)

    if (manuscript.title) {
      const htmlTitleNode = nodeFromHTML(`<h1>${manuscript.title}</h1>`)

      if (htmlTitleNode) {
        // TODO: parse and serialize with title schema
        const titleNode = parser.parse(htmlTitleNode, {
          topNode: schema.nodes.section_title.create(),
        })

        const jatsTitleNode = this.serializeNode(titleNode)

        const articleTitle = this.document.createElement('article-title')
        while (jatsTitleNode.firstChild) {
          articleTitle.appendChild(jatsTitleNode.firstChild)
        }
        titleGroup.appendChild(articleTitle)
      }
    }

    this.buildContributors(articleMeta)

    if (manuscript.keywordIDs) {
      this.buildKeywords(articleMeta, manuscript.keywordIDs)
    }

    return front
  }

  private buildBody = (fragment: ManuscriptFragment) => {
    const content = this.serializeFragment(fragment)

    const body = this.document.createElement('body')
    body.appendChild(content)

    this.fixBody(body, fragment)

    return body
  }

  // tslint:disable:cyclomatic-complexity
  private buildBack = () => {
    const back = this.document.createElement('back')

    // footnotes element
    const footnotesElement = this.document.querySelector('fn-group')

    if (footnotesElement) {
      // move fn-group from body to back
      back.appendChild(footnotesElement)

      const footnoteIDsSet: Set<string> = new Set()

      const xrefs = this.document.querySelectorAll('xref[ref-type=fn][rid]')

      for (const xref of xrefs) {
        const attribute = xref.getAttribute('rid')

        if (attribute) {
          for (const rid of attribute.split(/\s+/)) {
            footnoteIDsSet.add(rid)
          }
        }
      }

      const footnotes = this.models.filter(
        hasObjectType<Footnote>(ObjectTypes.Footnote)
      )

      for (const footnoteID of footnoteIDsSet) {
        const footnote = footnotes.find(
          footnote => normalizeID(footnote._id) === footnoteID
        )

        if (footnote) {
          const fn = this.document.createElement('fn')
          fn.setAttribute('id', normalizeID(footnote._id))

          const p = this.document.createElement('p')
          // TODO: convert markup to JATS?
          // p.innerHTML = footnote.contents

          if (footnote.contents) {
            const text = textFromHTML(footnote.contents)

            if (text !== null && text.length) {
              p.textContent = text
            }
          }

          fn.appendChild(p)

          footnotesElement.appendChild(fn)
        }
      }
    }

    // bibliography element
    let refList = this.document.querySelector('ref-list')

    if (!refList) {
      warn('No bibliography element, creating a ref-list anyway')
      refList = this.document.createElement('ref-list')
    }

    // move ref-list from body to back
    back.appendChild(refList)

    const bibliographyItems = this.models.filter(
      hasObjectType<BibliographyItem>(ObjectTypes.BibliographyItem)
    )

    const bibliographyItemIDsSet: Set<string> = new Set()

    const xrefs = this.document.querySelectorAll('xref[ref-type=bibr][rid]')

    for (const xref of xrefs) {
      const attribute = xref.getAttribute('rid')

      if (attribute) {
        for (const rid of attribute.split(/\s+/)) {
          bibliographyItemIDsSet.add(rid)
        }
      }
    }

    for (const bibliographyItemID of bibliographyItemIDsSet) {
      const bibliographyItem = bibliographyItems.find(
        bibliographyItem =>
          normalizeID(bibliographyItem._id) === bibliographyItemID
      )

      if (bibliographyItem) {
        const ref = this.document.createElement('ref')
        ref.setAttribute('id', normalizeID(bibliographyItem._id))

        const citation = this.document.createElement('element-citation')

        // TODO: add citation elements depending on publication type

        if (bibliographyItem.type) {
          switch (bibliographyItem.type) {
            case 'article':
            case 'article-journal':
              citation.setAttribute('publication-type', 'journal')
              break

            default:
              citation.setAttribute('publication-type', bibliographyItem.type)
              break
          }
        } else {
          citation.setAttribute('publication-type', 'journal')
        }

        if (bibliographyItem.author) {
          bibliographyItem.author.forEach(author => {
            const name = this.document.createElement('name')

            if (author.family) {
              const node = this.document.createElement('surname')
              node.textContent = author.family
              name.appendChild(node)
            }

            if (author.given) {
              const node = this.document.createElement('given-names')
              node.textContent = author.given
              name.appendChild(node)
            }

            citation.appendChild(name)
          })
        }

        if (bibliographyItem.title) {
          const node = this.document.createElement('article-title')
          node.textContent = bibliographyItem.title
          citation.appendChild(node)
        }

        if (bibliographyItem['container-title']) {
          const node = this.document.createElement('source')
          node.textContent = bibliographyItem['container-title']
          citation.appendChild(node)
        }

        if (bibliographyItem.volume) {
          const node = this.document.createElement('volume')
          node.textContent = String(bibliographyItem.volume)
          citation.appendChild(node)
        }

        if (bibliographyItem.issue) {
          const node = this.document.createElement('issue')
          node.textContent = String(bibliographyItem.issue)
          citation.appendChild(node)
        }

        if (bibliographyItem['page-first']) {
          const node = this.document.createElement('fpage')
          node.textContent = String(bibliographyItem['page-first'])
          citation.appendChild(node)
        } else if (bibliographyItem.page) {
          const pageString = String(bibliographyItem.page)

          if (/^\d+$/.test(pageString)) {
            const node = this.document.createElement('fpage')
            node.textContent = pageString
            citation.appendChild(node)
          } else if (/^\d+-\d+$/.test(pageString)) {
            const [fpage, lpage] = pageString.split('-')

            const fpageNode = this.document.createElement('fpage')
            fpageNode.textContent = fpage
            citation.appendChild(fpageNode)

            const lpageNode = this.document.createElement('lpage')
            lpageNode.textContent = lpage
            citation.appendChild(lpageNode)
          } else {
            // TODO: check page-range contents?
            const node = this.document.createElement('page-range')
            node.textContent = pageString
            citation.appendChild(node)
          }
        }

        if (bibliographyItem.issued) {
          const dateParts = bibliographyItem.issued['date-parts']

          if (dateParts && dateParts.length) {
            const [[year, month, day]] = dateParts

            if (year) {
              const node = this.document.createElement('year')
              node.textContent = String(year)
              citation.appendChild(node)
            }

            if (month) {
              const node = this.document.createElement('month')
              node.textContent = String(month)
              citation.appendChild(node)
            }

            if (day) {
              const node = this.document.createElement('day')
              node.textContent = String(day)
              citation.appendChild(node)
            }
          }
        }

        ref.appendChild(citation)
        refList.appendChild(ref)
      }
    }

    return back
  }

  private createSerializer = () => {
    const getModel = <T extends Model>(id?: string) =>
      id ? (this.modelMap.get(id) as T | undefined) : undefined

    const nodes: NodeSpecs = {
      bibliography_element: () => '',
      bibliography_section: node => [
        'ref-list',
        { id: normalizeID(node.attrs.id) },
        0,
      ],
      blockquote_element: () => ['disp-quote', { 'content-type': 'quote' }, 0],
      bullet_list: () => ['list', { 'list-type': 'bullet' }, 0],
      caption: () => ['caption', ['p', 0]],
      citation: node => {
        if (!node.attrs.rid) {
          warn(`${node.attrs.id} has no rid`)
          return node.attrs.label
        }

        const citation = getModel<Citation>(node.attrs.rid)

        if (!citation) {
          warn(`Missing citation ${node.attrs.rid}`)
          return ''
        }

        const rids = citation.embeddedCitationItems.filter(item => {
          if (!this.modelMap.has(item.bibliographyItem)) {
            warn(
              `Missing ${item.bibliographyItem} referenced by ${citation._id}`
            )
            return false
          }

          return true
        })

        if (!rids.length) {
          warn(`${citation._id} has no confirmed rids`)
          return ''
        }

        const xref = this.document.createElement('xref')
        xref.setAttribute('ref-type', 'bibr')

        // NOTE: https://www.ncbi.nlm.nih.gov/pmc/pmcdoc/tagging-guidelines/article/tags.html#el-xref
        xref.setAttribute(
          'rid',
          rids.map(item => normalizeID(item.bibliographyItem)).join(' ')
        )

        if (node.attrs.contents) {
          // TODO: convert markup to JATS?
          // xref.innerHTML = node.attrs.contents
          const text = textFromHTML(node.attrs.contents)

          if (text !== null && text.length) {
            xref.textContent = text
          }
        }

        return xref
      },
      cross_reference: node => {
        if (!node.attrs.rid) {
          warn(`${node.attrs.id} has no rid`)
          return node.attrs.label
        }

        const auxiliaryObjectReference = getModel<AuxiliaryObjectReference>(
          node.attrs.rid
        )

        if (!auxiliaryObjectReference) {
          warn(`Missing model ${node.attrs.rid}`)
          return node.attrs.label
        }

        const xref = this.document.createElement('xref')
        xref.setAttribute('ref-type', 'fig')

        xref.setAttribute(
          'rid',
          normalizeID(auxiliaryObjectReference.referencedObject)
        )

        xref.textContent = node.attrs.label

        return xref
      },
      doc: () => '',
      equation: node => {
        const formula = this.document.createElement('disp-formula')
        formula.setAttribute('id', normalizeID(node.attrs.id))

        const math = this.document.createElement('tex-math')
        math.textContent = node.attrs.TeXRepresentation
        formula.appendChild(math)

        return formula
      },
      equation_element: node =>
        createFigureElement(node, 'fig', node.type.schema.nodes.equation),
      figcaption: node => {
        if (!node.textContent) {
          return ''
        }

        return ['caption', ['p', 0]]
      },
      figure: node => {
        const fig = this.document.createElement('fig')
        fig.setAttribute('id', normalizeID(node.attrs.id))

        if (node.attrs.label) {
          const label = this.document.createElement('label')
          label.textContent = node.attrs.label
          fig.appendChild(label)
        }

        const figcaptionNodeType = node.type.schema.nodes.figcaption

        node.forEach(childNode => {
          if (childNode.type === figcaptionNodeType) {
            fig.appendChild(this.serializeNode(childNode))
          }
        })

        const graphic = this.document.createElement('graphic')
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
      footnotes_element: node => [
        'fn-group',
        { id: normalizeID(node.attrs.id) },
      ],
      hard_break: () => ['break'],
      highlight_marker: () => '',
      inline_equation: node => {
        const formula = this.document.createElement('inline-formula')

        const math = this.document.createElement('tex-math')
        math.textContent = node.attrs.TeXRepresentation
        formula.appendChild(math)

        return formula
      },
      inline_footnote: node => {
        const xref = this.document.createElement('xref')
        xref.setAttribute('ref-type', 'fn')
        xref.setAttribute('rid', normalizeID(node.attrs.rid))
        xref.textContent = node.attrs.contents

        return xref
      },
      keywords_element: () => '',
      keywords_section: () => '',
      link: node => {
        const text = node.textContent

        if (!text) {
          return ''
        }

        if (!node.attrs.href) {
          return text
        }

        const linkNode = this.document.createElement('ext-link')
        linkNode.setAttribute('ext-link-type', 'uri')
        linkNode.setAttributeNS(XLINK_NAMESPACE, 'xlink:href', node.attrs.href)
        linkNode.textContent = text

        if (node.attrs.title) {
          linkNode.setAttributeNS(
            XLINK_NAMESPACE,
            'xlink:title',
            node.attrs.title
          )
        }

        return linkNode
      },
      list_item: () => ['list-item', 0],
      listing: node => {
        const code = this.document.createElement('code')
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
        if (!node.childCount) {
          return ''
        }

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
      pullquote_element: () => [
        'disp-quote',
        { 'content-type': 'pullquote' },
        0,
      ],
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
      table_element: node =>
        createFigureElement(node, 'table-wrap', node.type.schema.nodes.table),
      table_cell: () => ['td', 0],
      table_row: () => ['tr', 0],
      text: node => node.text!,
      toc_element: () => '',
      toc_section: () => '',
    }

    const marks: MarkSpecs = {
      bold: () => ['bold'],
      code: () => ['code', { position: 'anchor' }], // TODO: inline?
      italic: () => ['italic'],
      smallcaps: () => ['sc'],
      strikethrough: () => ['strike'],
      superscript: () => ['sup'],
      subscript: () => ['sub'],
      underline: () => ['underline'],
    }

    this.serializer = new DOMSerializer<ManuscriptSchema>(nodes, marks)

    // tslint:disable-next-line:cyclomatic-complexity
    const createFigureElement = (
      node: ManuscriptNode,
      nodeName: string,
      contentNodeType: ManuscriptNodeType
    ) => {
      const element = this.document.createElement(nodeName)
      element.setAttribute('id', normalizeID(node.attrs.id))

      if (node.attrs.label) {
        const label = this.document.createElement('label')
        label.textContent = node.attrs.label
        element.appendChild(label)
      }

      const figcaptionNode = findChildNodeOfType(
        node,
        node.type.schema.nodes.figcaption
      )

      if (figcaptionNode) {
        element.appendChild(this.serializeNode(figcaptionNode))
      }

      node.forEach(childNode => {
        if (childNode.type === contentNodeType) {
          if (childNode.attrs.id) {
            element.appendChild(this.serializeNode(childNode))
          }
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
            const listing = this.document.createElement('fig')
            listing.setAttribute('specific-use', 'source')
            element.appendChild(listing)

            const code = this.document.createElement('code')
            code.setAttribute('executable', 'true')
            code.setAttribute('language', languageKey)
            code.textContent = contents
            listing.appendChild(code)

            // TODO: something more appropriate than "caption"?
            const caption = this.document.createElement('caption')
            listing.appendChild(caption)

            // TODO: real data
            const attachments: Array<{ id: string; type: string }> = []

            for (const attachment of attachments) {
              const p = this.document.createElement('p')
              caption.appendChild(p)

              const filename = generateAttachmentFilename(
                `${listingNode.attrs.id}:${attachment.id}`,
                attachment.type
              )

              const supp = this.document.createElement('supplementary-material')

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
  }

  private fixBody = (body: Element, fragment: ManuscriptFragment) => {
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
                    tableElement.insertBefore(
                      childNode,
                      tableElement.firstChild
                    )
                  }
                  break
                }

                case 'table': {
                  this.fixTable(childNode, node)
                  break
                }
              }
            }
          }
        }

        if (isNodeType<FigureElementNode>(node, 'figure_element')) {
          const figureGroup = body.querySelector(
            `#${normalizeID(node.attrs.id)}`
          )

          if (figureGroup) {
            const figures = body.querySelectorAll(
              `#${normalizeID(node.attrs.id)} > fig`
            )

            const caption = body.querySelector(
              `#${normalizeID(node.attrs.id)} > caption`
            )

            // replace a single-figure fig-group with the figure
            if (figures.length === 1) {
              const figure = figures[0]

              // move any caption into the figure
              if (caption) {
                figure.insertBefore(caption, figure.firstChild)
              }

              // replace the figure element with the figure
              if (figureGroup.parentElement) {
                figureGroup.parentElement.replaceChild(figure, figureGroup)
              }
            }

            // remove empty figure group
            if (figures.length === 0 && !caption) {
              const parent = figureGroup.parentNode

              if (parent) {
                parent.removeChild(figureGroup)
              }
            }
          }
        }
      }
    })
  }

  private fixTable = (table: ChildNode, node: ManuscriptNode) => {
    const rows = Array.from(table.childNodes)

    const theadRows = rows.splice(0, 1)
    const tfootRows = rows.splice(-1, 1)

    // thead
    if (node.attrs.suppressHeader) {
      for (const row of theadRows) {
        table.removeChild(row)
      }
    } else {
      const thead = this.document.createElement('thead')

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
      const tfoot = this.document.createElement('tfoot')

      for (const row of tfootRows) {
        tfoot.appendChild(row)
      }

      table.appendChild(tfoot)
    }

    // tbody
    const tbody = this.document.createElement('tbody')

    for (const row of rows) {
      tbody.appendChild(row)
    }

    table.appendChild(tbody)
  }

  private moveAbstract = (front: HTMLElement, body: HTMLElement) => {
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
      const abstractNode = this.document.createElement('abstract')

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
}
