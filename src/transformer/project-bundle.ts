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
  Manuscript,
  Model,
  ObjectTypes,
} from '@manuscripts/manuscripts-json-schema'
import { Decoder } from './decode'
import { hasObjectType } from './object-types'

export interface ProjectBundle {
  version: string
  data: Model[]
}

export const parseProjectBundle = (
  projectBundle: ProjectBundle,
  parseFragment?: (contents: string) => DocumentFragment
) => {
  const manuscript = projectBundle.data.find(
    hasObjectType<Manuscript>(ObjectTypes.Manuscript)
  )

  if (!manuscript) {
    throw new Error('Manuscript not found')
  }

  const modelMap: Map<string, Model> = new Map()

  for (const component of projectBundle.data) {
    modelMap.set(component._id, component)
  }

  const decoder = new Decoder(modelMap, parseFragment)

  const doc = decoder.createArticleNode()

  return { doc, manuscript, modelMap }
}
