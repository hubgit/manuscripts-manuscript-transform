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

import { Nodes, schema } from '../schema'
import { ManuscriptNode, ManuscriptNodeType } from '../schema/types'

export const nodeTypesMap: Map<ManuscriptNodeType, string> = new Map([
  [schema.nodes.bibliography_element, 'MPBibliographyElement'],
  [schema.nodes.bibliography_section, 'MPSection'],
  [schema.nodes.bullet_list, 'MPListElement'],
  [schema.nodes.citation, 'MPCitation'],
  [schema.nodes.cross_reference, 'MPAuxiliaryObjectReference'],
  [schema.nodes.equation, 'MPEquation'],
  [schema.nodes.equation_element, 'MPEquationElement'],
  // [schema.nodes.figure, 'MPFigure'],
  [schema.nodes.figure_element, 'MPFigureElement'],
  [schema.nodes.footnote, 'MPFootnote'],
  [schema.nodes.footnotes_element, 'MPFootnotesElement'],
  [schema.nodes.inline_equation, 'MPInlineMathFragment'],
  [schema.nodes.listing, 'MPListing'],
  [schema.nodes.listing_element, 'MPListingElement'],
  [schema.nodes.ordered_list, 'MPListElement'],
  [schema.nodes.paragraph, 'MPParagraphElement'],
  [schema.nodes.section, 'MPSection'],
  [schema.nodes.table, 'MPTable'],
  [schema.nodes.table_element, 'MPTableElement'],
  [schema.nodes.toc_element, 'MPTOCElement'],
  [schema.nodes.toc_section, 'MPSection'],
])

const elementNodeTypes: ManuscriptNodeType[] = [
  schema.nodes.listing_element,
  schema.nodes.equation_element,
  schema.nodes.figure_element,
  schema.nodes.bullet_list,
  schema.nodes.ordered_list,
  schema.nodes.paragraph,
  schema.nodes.table_element,
]

export const isElementNode = (node: ManuscriptNode) =>
  elementNodeTypes.includes(node.type)

export const isNodeType = <T extends ManuscriptNode>(
  node: ManuscriptNode,
  type: Nodes
): node is T => node.type === node.type.schema.nodes[type]
