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

import { Model, ObjectTypes } from '@manuscripts/manuscripts-json-schema'

import { buildManuscript } from './builders'
import { encode } from './encode'
import { generateID } from './id'
import { parseJATSBody } from './jats-importer'

// https://www.niso-sts.org/TagLibrary/niso-sts-TL-1-0-html/index.html

// TODO: STS-specific rules

export const parseSTSBody = (doc: Document) => {
  return parseJATSBody(doc)
}

export const parseSTSFront = (doc: Document) => {
  const front = doc.querySelector('front')

  if (!front) {
    throw new Error('No front element found!')
  }

  const modelMap = new Map<string, Model>()

  const addModel = <T extends Model>(data: Partial<T>) => {
    data._id = generateID(data.objectType as ObjectTypes)

    modelMap.set(data._id, data as T)
  }

  // manuscript

  const titleNode = front.querySelector(
    'std-doc-meta > title-wrap > main-title-wrap > main'
  )

  addModel(buildManuscript(titleNode?.innerHTML))

  return modelMap
}

export const parseSTSStandard = (doc: Document): Model[] => {
  const front = parseSTSFront(doc)

  const node = parseSTSBody(doc)

  if (!node.firstChild) {
    throw new Error('No content was parsed from the article body')
  }

  const body = encode(node.firstChild)

  return [...front.values(), ...body.values()]
}
