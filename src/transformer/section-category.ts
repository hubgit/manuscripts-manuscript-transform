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

import { Element, ObjectTypes } from '@manuscripts/manuscripts-json-schema'

import { ManuscriptNode, ManuscriptNodeType, schema } from '../schema'

const sectionNodeTypes: ManuscriptNodeType[] = [
  schema.nodes.bibliography_section,
  schema.nodes.keywords_section,
  schema.nodes.section,
  schema.nodes.toc_section,
]

export const isAnySectionNode = (node: ManuscriptNode): boolean =>
  sectionNodeTypes.includes(node.type)

export type SectionCategory =
  | 'MPSectionCategory:abstract'
  | 'MPSectionCategory:acknowledgment'
  | 'MPSectionCategory:bibliography'
  | 'MPSectionCategory:keywords'
  | 'MPSectionCategory:toc'

export const chooseSectionNodeType = (
  category?: SectionCategory
): ManuscriptNodeType => {
  switch (category) {
    case 'MPSectionCategory:bibliography':
      return schema.nodes.bibliography_section

    case 'MPSectionCategory:keywords':
      return schema.nodes.keywords_section

    case 'MPSectionCategory:toc':
      return schema.nodes.toc_section

    default:
      return schema.nodes.section
  }
}

// deprecated, every custom section should have a category
export const guessSectionCategory = (
  elements: Element[]
): SectionCategory | undefined => {
  if (!elements.length) {
    return undefined
  }

  switch (elements[0].objectType) {
    case ObjectTypes.BibliographyElement:
      return 'MPSectionCategory:bibliography'

    case ObjectTypes.KeywordsElement:
      return 'MPSectionCategory:keywords'

    case ObjectTypes.TOCElement:
      return 'MPSectionCategory:toc'

    default:
      return undefined
  }
}

export const buildSectionCategory = (
  node: ManuscriptNode
): SectionCategory | undefined => {
  switch (node.type) {
    case schema.nodes.bibliography_section:
      return 'MPSectionCategory:bibliography'

    case schema.nodes.keywords_section:
      return 'MPSectionCategory:keywords'

    case schema.nodes.toc_section:
      return 'MPSectionCategory:toc'

    default:
      return node.attrs.category || undefined
  }
}

export const sectionCategorySuffix = (category: SectionCategory) =>
  category.replace(/^MPSectionCategory:/, '')
