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

import * as Models from '@manuscripts/manuscripts-json-schema'
import { RxAttachment, RxAttachmentCreator } from 'rxdb'
import { ManuscriptNode } from '../schema/types'

// export interface Model extends Models.Model {
//   _deleted?: boolean
//   objectType: string
// }

export interface Attachment {
  id: string
  data: Blob | ArrayBuffer
  type: string
}

export interface Attachments {
  _attachments: Array<RxAttachment<Models.Model>>
}

export interface ModelAttachment {
  attachment?: RxAttachmentCreator
  src?: string
}

export type ModelWithAttachment = Models.Model & ModelAttachment

export interface UserProfileWithAvatar extends Models.UserProfile {
  avatar?: string
}

export interface ContainedProps {
  containerID: string
}

export type ContainedModel = Models.Model & ContainedProps

export interface ManuscriptProps {
  manuscriptID: string
}

export type ManuscriptModel = ContainedModel & ManuscriptProps

export interface AuxiliaryObjectReference extends ContainedModel {
  containingObject: string
  referencedObject: string
  auxiliaryObjectReferenceStyle?: string
}

export interface CommentSelector {
  from: number
  to: number
  text: string
}

export interface CommentAnnotation extends ManuscriptModel {
  contents: string
  selector?: CommentSelector
  target: string
  userID: string
}

export interface PlaceholderElement extends ContainedModel {
  elementType: 'p'
}

export interface Selected {
  pos: number
  node: ManuscriptNode
}
