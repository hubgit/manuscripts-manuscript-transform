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
  Fragment,
  Mark as ProsemirrorMark,
  MarkType,
  Node as ProsemirrorNode,
  NodeType,
  Schema,
  Slice,
} from 'prosemirror-model'
import {
  EditorState,
  NodeSelection,
  Plugin,
  TextSelection,
  Transaction,
} from 'prosemirror-state'
import { EditorView, NodeView } from 'prosemirror-view'

export type Marks =
  | 'bold'
  | 'code'
  | 'italic'
  | 'smallcaps'
  | 'strikethrough'
  | 'subscript'
  | 'superscript'
  | 'underline'
  | 'rmq'

export type Nodes =
  | 'bibliography_element'
  | 'bibliography_section'
  | 'bullet_list'
  | 'caption'
  | 'citation'
  | 'cross_reference'
  | 'doc'
  | 'equation'
  | 'equation_element'
  | 'figcaption'
  | 'figure'
  | 'figure_element'
  | 'footnote'
  | 'footnotes_element'
  | 'hard_break'
  | 'inline_equation'
  | 'inline_footnote'
  | 'link'
  | 'list_item'
  | 'listing'
  | 'listing_element'
  | 'manuscript'
  | 'ordered_list'
  | 'paragraph'
  | 'placeholder'
  | 'placeholder_element'
  | 'section'
  | 'section_title'
  | 'table'
  | 'table_cell'
  | 'table_element'
  | 'table_row'
  | 'text'
  | 'toc_element'
  | 'toc_section'
  | 'rmq_pos_start'
  | 'rmq_pos_end'

export type ManuscriptSchema = Schema<Nodes, Marks>

export type ManuscriptEditorState = EditorState<ManuscriptSchema>
export type ManuscriptEditorView = EditorView<ManuscriptSchema>
export type ManuscriptFragment = Fragment<ManuscriptSchema>
export type ManuscriptMark = ProsemirrorMark<ManuscriptSchema>
export type ManuscriptNode = ProsemirrorNode<ManuscriptSchema>
export type ManuscriptNodeSelection = NodeSelection<ManuscriptSchema>
export type ManuscriptTextSelection = TextSelection<ManuscriptSchema>
export type ManuscriptMarkType = MarkType<ManuscriptSchema>
export type ManuscriptNodeType = NodeType<ManuscriptSchema>
export type ManuscriptNodeView = NodeView<ManuscriptSchema>
export type ManuscriptPlugin = Plugin<ManuscriptSchema>
export type ManuscriptSlice = Slice<ManuscriptSchema>
export type ManuscriptTransaction = Transaction<ManuscriptSchema>
