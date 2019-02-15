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
  Contributor,
  Model,
  ObjectTypes,
} from '@manuscripts/manuscripts-json-schema'
import { DOMSerializer } from 'prosemirror-model'
import {
  ManuscriptFragment,
  ManuscriptSchema,
  schema,
  TableNode,
} from '../schema'
import { hasObjectType } from './object-types'
import { findManuscript } from './project-bundle'
import { xmlSerializer } from './serializer'

const buildFront = (document: Document, modelMap: Map<string, Model>) => {
  const manuscript = findManuscript(modelMap)

  const front = document.createElement('header')

  const articleMeta = document.createElement('div')
  front.appendChild(articleMeta)

  const articleTitle = document.createElement('h1')
  articleTitle.textContent = manuscript.title! // TODO: serialize to HTML from title-editor
  articleMeta.appendChild(articleTitle)

  const contributors = Array.from(modelMap.values()).filter(
    hasObjectType<Contributor>(ObjectTypes.Contributor)
  )

  if (contributors && contributors.length) {
    const contribGroup = document.createElement('div')
    articleMeta.appendChild(contribGroup)

    contributors.sort((a, b) => Number(a.priority) - Number(b.priority))

    contributors.forEach(contributor => {
      const contrib = document.createElement('span')
      contrib.setAttribute('id', contributor._id)

      if (contributor.isCorresponding) {
        contrib.setAttribute('data-corresp', 'yes')
      }

      const name = document.createElement('span')
      contrib.appendChild(name)

      if (contributor.bibliographicName.given) {
        const givenNames = document.createElement('span')
        givenNames.textContent = contributor.bibliographicName.given
        name.appendChild(givenNames)
      }

      if (contributor.bibliographicName.family) {
        const surname = document.createElement('span')
        surname.textContent = contributor.bibliographicName.family
        name.appendChild(surname)
      }

      // if (contributor.email) {
      //   const email = document.createElement('a')
      //   email.href = `mailto:${contributor.email}`
      //   contrib.appendChild(email)
      // }

      // TODO: link to affiliations

      contribGroup.appendChild(contrib)
    })
  }

  const affiliations = Array.from(modelMap.values()).filter(
    hasObjectType<Affiliation>(ObjectTypes.Affiliation)
  )

  // TODO: sort affiliations

  if (affiliations && affiliations.length) {
    const affiliationList = document.createElement('ol')
    articleMeta.appendChild(affiliationList)

    affiliations.forEach(affiliation => {
      const affiliationItem = document.createElement('li')
      affiliationItem.setAttribute('id', affiliation._id)

      // TODO: all the institution fields
      if (affiliation.institution) {
        affiliationItem.textContent = affiliation.institution
      }

      affiliationList.appendChild(affiliationItem)
    })
  }

  return front
}

const buildBody = (document: Document, fragment: ManuscriptFragment) => {
  const serializer = DOMSerializer.fromSchema<ManuscriptSchema>(schema)

  return serializer.serializeFragment(fragment, { document })
}

const idSelector = (id: string) => '#' + id.replace(/:/g, '\\:')

const fixBody = (document: Document, fragment: ManuscriptFragment) => {
  fragment.descendants(node => {
    if (node.attrs.id) {
      if (node.attrs.titleSuppressed) {
        const selector = idSelector(node.attrs.id)

        const title = document.querySelector(`${selector} > h1`)

        if (title && title.parentNode) {
          title.parentNode.removeChild(title)
        }
      }

      if (node.attrs.suppressCaption) {
        const selector = idSelector(node.attrs.id)

        // TODO: need to query deeper?
        const caption = document.querySelector(`${selector} > figcaption`)

        if (caption && caption.parentNode) {
          caption.parentNode.removeChild(caption)
        }
      }
    }
  })
}

const buildBack = (document: Document) => {
  const back = document.createElement('footer')

  // TODO: reference list

  return back
}

export const serializeToHTML = (
  fragment: ManuscriptFragment,
  modelMap: Map<string, Model>
) => {
  const doc = document.implementation.createDocument(
    'http://www.w3.org/1999/xhtml',
    'html',
    document.implementation.createDocumentType('html', '', '')
  )

  const article = doc.createElement('article')
  doc.documentElement.appendChild(article)

  const front = buildFront(doc, modelMap)
  article.appendChild(front)

  const body = buildBody(doc, fragment)
  article.appendChild(body)

  const back = buildBack(doc)
  article.appendChild(back)

  fixBody(doc, fragment)

  return xmlSerializer.serializeToString(doc)
}

export const serializeTableToHTML = (node: TableNode) => {
  const doc = document.implementation.createDocument(
    'http://www.w3.org/1999/xhtml',
    'html',
    document.implementation.createDocumentType('html', '', '')
  )

  const serializer = DOMSerializer.fromSchema<ManuscriptSchema>(
    node.type.schema
  )

  return serializer.serializeNode(node, { document: doc })
}
