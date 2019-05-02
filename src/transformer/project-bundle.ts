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
  Submission,
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
  const modelMap: Map<string, Model> = new Map()

  for (const component of projectBundle.data) {
    modelMap.set(component._id, component)
  }

  const decoder = new Decoder(modelMap, parseFragment)

  const doc = decoder.createArticleNode()

  return { doc, modelMap }
}

const isManuscript = hasObjectType<Manuscript>(ObjectTypes.Manuscript)

export const findManuscript = (modelMap: Map<string, Model>): Manuscript => {
  for (const model of modelMap.values()) {
    if (isManuscript(model)) {
      return model
    }
  }

  throw new Error('No manuscript found')
}

const isSubmission = hasObjectType<Submission>(ObjectTypes.Submission)

const newestFirst = (a: Model, b: Model) => b.createdAt - a.createdAt

export const findLatestManuscriptSubmission = (
  modelMap: Map<string, Model>,
  manuscript: Manuscript
): Submission | undefined => {
  const submissions: Submission[] = []

  for (const model of modelMap.values()) {
    if (isSubmission(model) && model.manuscriptID === manuscript._id) {
      submissions.push(model)
    }
  }

  submissions.sort(newestFirst)

  return submissions.length ? submissions[0] : undefined
}
