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
  Affiliation,
  Contributor,
  Manuscript,
  Model,
} from '@manuscripts/manuscripts-json-schema'
import {
  Build,
  buildAffiliation,
  buildBibliographicDate,
  buildBibliographicName,
  buildBibliographyItem,
  buildContributor,
  buildManuscript,
} from './builders'
import { AddModel, addModelToMap } from './model-map'

// https://grobid.readthedocs.io/en/latest/TEI-encoding-of-results/
// https://github.com/kermitt2/grobid/blob/master/grobid-home/schemas/dtd/Grobid.dtd
// https://github.com/kermitt2/grobid/blob/master/grobid-home/schemas/doc/Grobid_doc.html

const iterateSnapshot = function*<T extends Node>(
  snapshot: XPathResult
): Generator<T> {
  for (let i = 0; i < snapshot.snapshotLength; i++) {
    yield snapshot.snapshotItem(i) as T
  }
}

const namespaceResolverDoc = new DOMParser().parseFromString(
  `<TEI xmlns="http://www.tei-c.org/ns/1.0"/>`,
  'application/xml'
)

const namespaceResolver = namespaceResolverDoc.createNSResolver(
  namespaceResolverDoc
)

export const parseFront = (doc: Document, addModel: AddModel): void => {
  const headerNode = doc.evaluate(
    '/TEI/teiHeader',
    doc,
    namespaceResolver,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue

  if (!headerNode) {
    throw new Error('No header element found!')
  }

  // manuscript

  const title = doc.evaluate(
    'fileDesc/titleStmt/title', // TODO: rich text?
    headerNode,
    namespaceResolver,
    XPathResult.STRING_TYPE
  ).stringValue

  const manuscript = buildManuscript(title)

  addModel<Manuscript>(manuscript)

  // affiliations
  const affiliationsMap = new Map<string, Build<Affiliation>>()

  // authors

  const authorNodes = doc.evaluate(
    'fileDesc/sourceDesc/biblStruct/analytic/author',
    headerNode,
    namespaceResolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
  )

  for (const authorNode of iterateSnapshot<Element>(authorNodes)) {
    const name = buildBibliographicName({})

    name.given = doc.evaluate(
      'persName/forename',
      authorNode,
      namespaceResolver,
      XPathResult.STRING_TYPE
    ).stringValue

    name.family = doc.evaluate(
      'persName/surname',
      authorNode,
      namespaceResolver,
      XPathResult.STRING_TYPE
    ).stringValue

    const contributor = buildContributor(name, 'author', 1) // TODO: priority

    contributor.affiliations = []

    const affiliationNodes = doc.evaluate(
      'affiliation',
      authorNode,
      namespaceResolver,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
    )

    for (const affiliationNode of iterateSnapshot<Element>(affiliationNodes)) {
      const key = affiliationNode.getAttribute('key')

      if (key) {
        const affiliation = affiliationsMap.get(key)

        if (affiliation) {
          contributor.affiliations.push(affiliation._id)
        } else {
          const affiliation = buildAffiliation('', 1) // TODO: priority

          affiliation.institution = doc.evaluate(
            'orgName[@type="institution"]',
            affiliationNode,
            namespaceResolver,
            XPathResult.STRING_TYPE
          ).stringValue

          affiliation.department = doc.evaluate(
            'orgName[@type="department"]',
            affiliationNode,
            namespaceResolver,
            XPathResult.STRING_TYPE
          ).stringValue

          // TODO: address

          addModel<Affiliation>(affiliation)

          affiliationsMap.set(key, affiliation)

          contributor.affiliations.push(affiliation._id)
        }
      }
    }

    addModel<Contributor>(contributor)
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

export const parseBack = (doc: Document, addModel: AddModel): void => {
  const backNode = doc.evaluate(
    '/TEI/text/back',
    doc,
    namespaceResolver,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue

  if (!backNode) {
    return
  }

  // references

  const referenceNodes = doc.evaluate(
    'div[@type="references"]/listBibl/biblStruct',
    backNode,
    namespaceResolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
  )

  for (const referenceNode of iterateSnapshot<Element>(referenceNodes)) {
    const bibliographyItem = buildBibliographyItem({
      type: chooseBibliographyItemType(null), // TODO
    })

    bibliographyItem.title = doc.evaluate(
      'analytic/title',
      referenceNode,
      namespaceResolver,
      XPathResult.STRING_TYPE
    ).stringValue

    bibliographyItem.source = doc.evaluate(
      'monogr/title', // TODO: not abbr?
      referenceNode,
      namespaceResolver,
      XPathResult.STRING_TYPE
    ).stringValue

    bibliographyItem.volume = doc.evaluate(
      'monogr/imprint/biblScope[unit="volume"]',
      referenceNode,
      namespaceResolver,
      XPathResult.STRING_TYPE
    ).stringValue

    const fpage = doc.evaluate(
      'monogr/imprint/biblScope[unit="page"]/@from',
      referenceNode,
      namespaceResolver,
      XPathResult.STRING_TYPE
    ).stringValue

    const lpage = doc.evaluate(
      'monogr/imprint/biblScope[unit="page"]/@to',
      referenceNode,
      namespaceResolver,
      XPathResult.STRING_TYPE
    ).stringValue

    if (fpage) {
      bibliographyItem.page = lpage ? `${fpage}-${lpage}` : fpage
    }

    const date = doc.evaluate(
      'monogr/imprint/date[type="published"]/@when',
      referenceNode,
      namespaceResolver,
      XPathResult.STRING_TYPE
    ).stringValue

    if (date) {
      bibliographyItem.issued = buildBibliographicDate({
        'date-parts': [date.split(/-/)],
      })
    }

    const authorNodes = doc.evaluate(
      'analytic/author',
      referenceNode,
      namespaceResolver,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
    )

    bibliographyItem.author = []

    for (const authorNode of iterateSnapshot<Element>(authorNodes)) {
      const name = buildBibliographicName({})

      name.given = doc.evaluate(
        'persName/forename',
        authorNode,
        namespaceResolver,
        XPathResult.STRING_TYPE
      ).stringValue

      name.family = doc.evaluate(
        'persName/surname',
        authorNode,
        namespaceResolver,
        XPathResult.STRING_TYPE
      ).stringValue

      bibliographyItem.author.push(name)
    }

    addModel(bibliographyItem)
  }
}

export const parseTEIGROBIDArticle = (doc: Document): Model[] => {
  const modelMap = new Map<string, Model>()
  const addModel = addModelToMap(modelMap)

  parseFront(doc, addModel)
  parseBack(doc, addModel)

  return [...modelMap.values()]
}
