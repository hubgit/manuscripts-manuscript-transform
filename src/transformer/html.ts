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
  Citation,
  Contributor,
  Figure,
  InlineStyle,
  Model,
  ObjectTypes,
} from '@manuscripts/manuscripts-json-schema'
import { DOMOutputSpec, DOMSerializer } from 'prosemirror-model'
import serializeToXML from 'w3c-xmlserializer'

import { buildStyledContentClass } from '../lib/styled-content'
import {
  CitationNode,
  CrossReferenceNode,
  FigureElementNode,
  FigureNode,
  ListingNode,
  ManuscriptFragment,
  ManuscriptMark,
  ManuscriptNode,
  Marks,
  Nodes,
  schema,
} from '../schema'
import { IDGenerator, MediaPathGenerator } from '../types'
import { generateAttachmentFilename } from './filename'
import { createCounter } from './jats-exporter'
import { isNodeType } from './node-types'
import { hasObjectType } from './object-types'
import { findManuscript } from './project-bundle'
import { chooseSecType, SectionCategory } from './section-category'

const chooseNodeName = (element: Element) => {
  const nodeName = element.nodeName.toLowerCase()

  if (nodeName === 'figure') {
    if (element.classList.contains('table')) {
      return 'figure-table'
    }

    if (element.classList.contains('listing')) {
      return 'figure-listing'
    }

    if (element.classList.contains('equation')) {
      return 'figure-equation'
    }

    // TODO: handle figure panels

    return 'figure'
  } else if (nodeName === 'section') {
    const sectionCategory = element.getAttribute('data-category')

    if (sectionCategory) {
      const secType = chooseSecType(sectionCategory as SectionCategory)

      if (secType) {
        return secType
      }
    }
  } else if (element.classList.length === 1) {
    const className = element.classList.item(0)

    if (className && !className.startsWith('MP')) {
      return className
    }
  }

  return nodeName
}

const createDefaultIdGenerator = (): IDGenerator => {
  const counter = createCounter()

  return async (element: Element) => {
    const nodeName = chooseNodeName(element)

    // TODO: remove index suffix from singular ids?

    const index = counter.increment(nodeName)

    return `${nodeName}-${index}`
  }
}

export interface HTMLExporterOptions {
  idGenerator?: IDGenerator
  mediaPathGenerator?: MediaPathGenerator
}

export class HTMLTransformer {
  private document: Document
  private modelMap: Map<string, Model>

  public serializeToHTML = async (
    fragment: ManuscriptFragment,
    modelMap: Map<string, Model>,
    options: HTMLExporterOptions = {}
  ) => {
    const { idGenerator, mediaPathGenerator } = options

    this.modelMap = modelMap

    this.document = document.implementation.createDocument(
      'http://www.w3.org/1999/xhtml',
      'html',
      document.implementation.createDocumentType('html', '', '')
    )

    const article = this.document.createElement('article')
    this.document.documentElement.appendChild(article)

    article.appendChild(this.buildFront())
    article.appendChild(this.buildBody(fragment))
    // article.appendChild(this.buildBack())

    // TODO: turn inline citation spans (with data-reference-ids attribute) into links?

    // TODO: move abstract to header
    this.fixBody(fragment)

    await this.rewriteIDs(idGenerator)
    if (mediaPathGenerator) {
      await this.rewriteMediaPaths(mediaPathGenerator)
    }

    return serializeToXML(this.document)
  }

  protected rewriteMediaPaths = async (
    mediaPathGenerator: MediaPathGenerator
  ) => {
    for (const image of this.document.querySelectorAll('figure > img')) {
      const parentFigure = image.parentNode

      if (parentFigure) {
        const parentID = (parentFigure as Element).getAttribute('data-uuid')
        if (parentID) {
          const newSrc = await mediaPathGenerator(image, parentID)
          image.setAttribute('src', newSrc)
        }
      }
    }
  }

  protected rewriteIDs = async (
    idGenerator: IDGenerator = createDefaultIdGenerator()
  ) => {
    const idMap = new Map<string, string | null>()

    for (const element of this.document.querySelectorAll('[id]')) {
      const previousID = element.getAttribute('id')

      if (previousID && !previousID.match(/^MP[a-z]+:[a-z0-9-]+$/i)) {
        continue
      }

      const newID = await idGenerator(element)

      if (newID) {
        element.setAttribute('id', newID)
        if (previousID) {
          element.setAttribute('data-uuid', previousID)
        }
      } else {
        element.removeAttribute('id')
      }

      if (previousID) {
        idMap.set(previousID, newID)
      }
    }

    for (const node of this.document.querySelectorAll('[data-reference-ids]')) {
      const rids = node.getAttribute('data-reference-ids')

      if (rids) {
        const newRIDs = rids
          .split(/\s+/)
          .filter(Boolean)
          .map((previousRID) => idMap.get(previousRID))
          .filter(Boolean) as string[]

        if (newRIDs.length) {
          node.setAttribute('data-reference-ids', newRIDs.join(' '))
        }
      }
    }
  }

  private buildFront = () => {
    // at this point we assume that there is only one manuscript - resources
    // associated with others should have been stripped out via parseProjectBundle
    const manuscript = findManuscript(this.modelMap)

    if (!manuscript) {
      throw new Error('Manuscript not found in project modelMap')
    }

    const front = this.document.createElement('header')

    if (manuscript.headerFigure) {
      const figure = this.modelMap.get(manuscript.headerFigure) as
        | Figure
        | undefined

      if (figure) {
        const headerFigure = document.createElement('figure')
        headerFigure.setAttribute('id', figure._id)
        front.appendChild(headerFigure)

        const filename = generateAttachmentFilename(
          figure._id,
          figure.contentType
        )

        const img = this.document.createElement('img')
        img.setAttribute('src', filename)
        headerFigure.appendChild(img)

        // TODO: title, credit
      }
    }

    const articleMeta = this.document.createElement('div')
    front.appendChild(articleMeta)

    const articleTitle = this.document.createElement('h1')
    if (manuscript.title) {
      articleTitle.innerHTML = manuscript.title
    }
    articleMeta.appendChild(articleTitle)

    this.buildContributors(articleMeta)

    // if (manuscript.keywordIDs) {
    //   this.buildKeywords(articleMeta, manuscript.keywordIDs)
    // }

    return front
  }

  private buildContributors(articleMeta: HTMLDivElement) {
    const contributors = Array.from(this.modelMap.values()).filter(
      hasObjectType<Contributor>(ObjectTypes.Contributor)
    )

    const affiliationIDs: string[] = []

    if (contributors && contributors.length) {
      const contribGroup = this.document.createElement('div')
      contribGroup.classList.add('contrib-group')
      articleMeta.appendChild(contribGroup)

      contributors.sort((a, b) => Number(a.priority) - Number(b.priority))

      contributors.forEach((contributor) => {
        const contrib = this.document.createElement('span')
        contrib.classList.add('contrib')
        contrib.setAttribute('id', contributor._id)

        if (contributor.isCorresponding) {
          contrib.setAttribute('data-corresp', 'yes')
        }

        const name = this.document.createElement('span')
        name.classList.add('contrib-name')
        contrib.appendChild(name)

        const { given, family } = contributor.bibliographicName

        if (given) {
          const givenNames = this.document.createElement('span')
          givenNames.classList.add('contrib-given-names')
          givenNames.textContent = given
          name.appendChild(givenNames)
        }

        if (family) {
          if (given) {
            const separator = document.createTextNode(' ')
            name.appendChild(separator)
          }

          const surname = this.document.createElement('span')
          surname.classList.add('contrib-surname')
          surname.textContent = family
          name.appendChild(surname)
        }

        if (contributor.email) {
          const link = this.document.createElement('a')
          link.href = `mailto:${contributor.email}`
          contrib.appendChild(link)
        }

        if (contributor.affiliations) {
          contributor.affiliations.forEach((rid) => {
            const link = this.document.createElement('a')
            link.setAttribute('data-ref-type', 'aff')
            link.setAttribute('href', '#' + rid)

            const affiliationIndex = affiliationIDs.indexOf(rid)

            if (affiliationIndex > -1) {
              // affiliation already seen
              link.textContent = String(affiliationIndex + 1)
            } else {
              // new affiliation
              affiliationIDs.push(rid)
              link.textContent = String(affiliationIDs.length)
            }

            contrib.appendChild(link)
          })
        }

        contribGroup.appendChild(contrib)
      })
    }

    if (affiliationIDs.length) {
      // TODO: use label and tabular layout?
      const affiliationList = this.document.createElement('ol')
      affiliationList.classList.add('affiliations-list')
      articleMeta.appendChild(affiliationList)

      for (const affiliationID of affiliationIDs) {
        const affiliation = this.modelMap.get(affiliationID) as
          | Affiliation
          | undefined

        if (affiliation) {
          const affiliationItem = this.document.createElement('li')
          affiliationItem.classList.add('affiliation')
          affiliationItem.setAttribute('id', affiliation._id)

          // TODO: all the institution fields
          if (affiliation.institution) {
            affiliationItem.textContent = affiliation.institution
          }

          affiliationList.appendChild(affiliationItem)
        }
      }
    }
  }

  // private buildKeywords(articleMeta: Node, keywordIDs: string[]) {
  //   const keywords = keywordIDs
  //     .map(id => this.modelMap.get(id) as Keyword | undefined)
  //     .filter(model => model && model.name) as Keyword[]
  //
  //   if (keywords.length) {
  //     const keywordsList = this.document.createElement('ol')
  //     keywordsList.classList.add('keywords-list')
  //     articleMeta.appendChild(keywordsList)
  //
  //     for (const keyword of keywords) {
  //       const kwd = this.document.createElement('li')
  //       kwd.classList.add('keywords-list-item')
  //       kwd.textContent = keyword.name
  //       keywordsList.appendChild(kwd)
  //     }
  //   }
  // }

  private buildBody = (fragment: ManuscriptFragment) => {
    const getModel = <T extends Model>(id?: string) =>
      id ? (this.modelMap.get(id) as T | undefined) : undefined

    const nodes: { [key: string]: (node: ManuscriptNode) => DOMOutputSpec } = {}

    for (const [name, node] of Object.entries(schema.nodes)) {
      if (node.spec.toDOM) {
        nodes[name as Nodes] = node.spec.toDOM
      }
    }

    nodes.citation = (node) => {
      const citationNode = node as CitationNode

      const element = this.document.createElement('span')
      element.setAttribute('class', 'citation')

      const citation = getModel<Citation>(citationNode.attrs.rid)

      if (citation) {
        element.setAttribute(
          'data-reference-ids',
          citation.embeddedCitationItems
            .map((item) => item.bibliographyItem)
            .join(' ')
        )
      }

      if (citationNode.attrs.contents) {
        element.innerHTML = citationNode.attrs.contents
      }

      return element
    }

    nodes.cross_reference = (node) => {
      const crossReferenceNode = node as CrossReferenceNode

      const element = this.document.createElement('a')
      element.classList.add('cross-reference')

      const auxiliaryObjectReference = getModel<AuxiliaryObjectReference>(
        crossReferenceNode.attrs.rid
      )

      if (auxiliaryObjectReference) {
        element.setAttribute(
          'href',
          `#${auxiliaryObjectReference.referencedObject}`
        )

        element.setAttribute('data-reference-ids', crossReferenceNode.attrs.rid)
      }

      element.textContent = crossReferenceNode.attrs.label

      return element
    }

    nodes.listing = (node) => {
      const listingNode = node as ListingNode

      const pre = this.document.createElement('pre')
      if (listingNode.attrs.id) {
        pre.setAttribute('id', listingNode.attrs.id)
      }
      pre.classList.add('listing')

      const code = this.document.createElement('code')
      if (listingNode.attrs.languageKey) {
        code.setAttribute('data-language', listingNode.attrs.languageKey)
      }
      code.textContent = listingNode.attrs.contents
      pre.appendChild(code)

      return pre
    }

    nodes.text = (node) => node.text as string

    const marks: {
      [key: string]: (mark: ManuscriptMark, inline: boolean) => DOMOutputSpec
    } = {}

    for (const [name, mark] of Object.entries(schema.marks)) {
      if (mark.spec.toDOM) {
        marks[name as Marks] = mark.spec.toDOM
      }
    }

    marks.styled = (mark) => {
      const inlineStyle = getModel<InlineStyle>(mark.attrs.rid)

      const attrs = {
        class: buildStyledContentClass(mark.attrs, inlineStyle),
      }

      return ['span', attrs]
    }

    const serializer = new DOMSerializer(nodes, marks)

    return serializer.serializeFragment(fragment, { document })
  }

  // private buildBack = (document: Document) => {
  //   const back = this.document.createElement('footer')
  //
  //   // TODO: reference list
  //
  //   return back
  // }

  private idSelector = (id: string) => '#' + id.replace(/:/g, '\\:')

  private fixFigure = (node: FigureNode) => {
    const figure = this.document.querySelector(`[id="${node.attrs.id}"]`)

    if (figure) {
      if (node.attrs.embedURL) {
        const container = document.createElement('div')
        container.classList.add('figure-embed')

        const object = document.createElement('iframe')
        object.classList.add('figure-embed-object')
        object.setAttribute('src', node.attrs.embedURL)
        object.setAttribute('height', '100%')
        object.setAttribute('width', '100%')
        object.setAttribute('allowfullscreen', 'true')
        object.setAttribute('sandbox', 'allow-scripts allow-same-origin') // TODO: how to secure this?
        container.appendChild(object)

        figure.insertBefore(container, figure.firstChild)
      } else {
        const filename = generateAttachmentFilename(
          node.attrs.id,
          node.attrs.contentType
        )

        const img = this.document.createElement('img')
        img.setAttribute('src', filename)

        if (this.figureHasLicense(node.attrs.id)) {
          img.setAttribute('data-licensed', 'true')
        }

        figure.insertBefore(img, figure.firstChild)
      }
    }
  }

  private figureHasLicense = (id: string): boolean | undefined => {
    const figureModel = this.modelMap.get(id) as Figure | undefined

    if (!figureModel) {
      return undefined
    }

    if (!figureModel.attribution) {
      return false
    }

    return figureModel.attribution.licenseID !== undefined
  }

  private fixBody = (fragment: ManuscriptFragment) => {
    fragment.descendants((node) => {
      if (node.attrs.id) {
        const selector = this.idSelector(node.attrs.id)

        if (node.attrs.titleSuppressed) {
          const title = this.document.querySelector(`${selector} > h1`)

          if (title && title.parentNode) {
            title.parentNode.removeChild(title)
          }
        }

        if (node.attrs.suppressCaption) {
          // TODO: need to query deeper?
          const caption = this.document.querySelector(
            `${selector} > figcaption`
          )

          if (caption && caption.parentNode) {
            caption.parentNode.removeChild(caption)
          }
        }

        if (isNodeType<FigureNode>(node, 'figure')) {
          this.fixFigure(node)
        }

        if (isNodeType<FigureElementNode>(node, 'figure_element')) {
          const figureGroup = this.document.querySelector(`${selector}`)

          if (figureGroup) {
            const figures = this.document.querySelectorAll(
              `${selector} > figure`
            )

            const caption = this.document.querySelector(
              `${selector} > figcaption`
            )

            const listing = this.document.querySelector(
              `${selector} > pre.listing`
            )

            // remove empty listing
            if (listing && !listing.textContent) {
              listing.remove()
            }

            // replace a single-figure fig-group with the figure
            if (figures.length === 1) {
              const [figure] = figures

              figure.setAttribute('data-fig-type', 'figure')

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
              figureGroup.remove()
            }
          }
        }

        // TODO: add labels from plugin state to figures, tables, etc?
      }
    })
  }
}
