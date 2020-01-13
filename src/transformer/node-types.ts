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

import { ObjectTypes } from '@manuscripts/manuscripts-json-schema'
import { ManuscriptNode, ManuscriptNodeType, Nodes, schema } from '../schema'

export const nodeTypesMap: Map<ManuscriptNodeType, string> = new Map([
  [schema.nodes.bibliography_element, ObjectTypes.BibliographyElement],
  [schema.nodes.bibliography_section, ObjectTypes.Section],
  [schema.nodes.bullet_list, ObjectTypes.ListElement],
  [schema.nodes.citation, ObjectTypes.Citation],
  [schema.nodes.cross_reference, ObjectTypes.AuxiliaryObjectReference],
  [schema.nodes.equation, ObjectTypes.Equation],
  [schema.nodes.equation_element, ObjectTypes.EquationElement],
  [schema.nodes.figure, ObjectTypes.Figure],
  [schema.nodes.figure_element, ObjectTypes.FigureElement],
  [schema.nodes.footnote, ObjectTypes.Footnote],
  [schema.nodes.footnotes_element, ObjectTypes.FootnotesElement],
  [schema.nodes.highlight_marker, ObjectTypes.HighlightMarker],
  [schema.nodes.inline_equation, ObjectTypes.InlineMathFragment],
  [schema.nodes.keywords_element, ObjectTypes.KeywordsElement],
  [schema.nodes.keywords_section, ObjectTypes.Section],
  [schema.nodes.listing, ObjectTypes.Listing],
  [schema.nodes.listing_element, ObjectTypes.ListingElement],
  [schema.nodes.ordered_list, ObjectTypes.ListElement],
  [schema.nodes.paragraph, ObjectTypes.ParagraphElement],
  [schema.nodes.section, ObjectTypes.Section],
  [schema.nodes.table, ObjectTypes.Table],
  [schema.nodes.table_element, ObjectTypes.TableElement],
  [schema.nodes.toc_element, ObjectTypes.TOCElement],
  [schema.nodes.toc_section, ObjectTypes.Section],
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

const executableNodeTypes: ManuscriptNodeType[] = [
  schema.nodes.figure_element,
  schema.nodes.table_element,
]

export const isElementNode = (node: ManuscriptNode) =>
  elementNodeTypes.includes(node.type)

export const isExecutableNode = (node: ManuscriptNode) =>
  executableNodeTypes.includes(node.type)

export const isNodeType = <T extends ManuscriptNode>(
  node: ManuscriptNode,
  type: Nodes
): node is T => node.type === node.type.schema.nodes[type]
