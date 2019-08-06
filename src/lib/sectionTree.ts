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

import { Model } from '@manuscripts/manuscripts-json-schema'

interface SectionProperties {
  path?: string[]
  priority?: number
}

export default (modelMap: Map<string, Model & SectionProperties>) => ({
  getPath(id: string) {
    const doc = modelMap.get(id)
    if (!doc) {
      throw new Error(`Doc ${id} not found`)
    }
    const path = doc.path
    if (!path) {
      throw new Error(`Doc ${id} is not a Section`)
    }

    return path
  },

  parent(id: string) {
    const path = this.getPath(id)
    const parentId = path[path.length - 2]
    if (!parentId) {
      return null
    }
    return modelMap.get(parentId) || null
  },

  children(id: string | null) {
    const children: Array<Model & SectionProperties> = []
    modelMap.forEach(model => {
      let path
      try {
        path = this.getPath(model._id)
      } catch (e) {
        return
      }

      if (id === null && path.length === 1 && path[0] === model._id) {
        children.push(model)
      }

      if (path[path.length - 2] === id) {
        children.push(model)
      }
    })

    return children.sort((a, b) => a.priority! - b.priority!)
  },

  siblings(id: string) {
    const parent = this.parent(id)
    return this.children(parent && parent._id)
  },
})
