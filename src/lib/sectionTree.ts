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

import { Model, ObjectTypes } from '@manuscripts/manuscripts-json-schema'
import _isEqual from 'lodash.isequal'

interface SectionLike extends Model {
  path?: string[]
  priority?: number
  elementIDs?: string[]
}

interface ScheduledChange {
  nextParentModel?: SectionLike | null
  blocksToUpdate: string[]
}

export const walkSectionTree = (modelMap: Map<string, SectionLike>) => ({
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
    const children: SectionLike[] = []
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

export const mergeElementIDs = (model: SectionLike, nextChildren: string[]) => {
  const elementIDs = model.elementIDs || []
  const nonSectionElementIDs = elementIDs.filter(
    id => id.indexOf('MPSection:') !== 0
  )
  return [...nonSectionElementIDs, ...nextChildren]
}

export const isTreeChange = (
  model: SectionLike,
  modelMap: Map<string, SectionLike>
) => {
  if (model.objectType !== ObjectTypes.Section) return false

  const currentModel = modelMap.get(model._id)
  if (!currentModel) return true

  if (currentModel.priority !== model.priority!) return true

  if (!_isEqual(currentModel.path, model.path)) return true

  return false
}

export const treeUpdateQueue = (
  callback: (...changes: ScheduledChange[]) => void
) => {
  let queue: Set<string | null> = new Set()
  let timer: NodeJS.Timer

  const emptyQueue = (modelMap: Map<string, SectionLike>) => {
    const changes: ScheduledChange[] = []
    queue.forEach(id => {
      const nextChildren = walkSectionTree(modelMap)
        .children(id)
        .map(model => model._id)

      const parent = id ? modelMap.get(id) : null
      if (parent) {
        parent.elementIDs = mergeElementIDs(parent, nextChildren)
      }

      changes.push({
        nextParentModel: parent,
        blocksToUpdate: nextChildren,
      })
    })

    callback(...changes)

    queue = new Set()
  }

  return (model: SectionLike, modelMap: Map<string, SectionLike>) => {
    const parent = walkSectionTree(modelMap).parent(model._id)
    queue.add(parent && parent._id)

    modelMap.set(model._id, model)

    const newParent = walkSectionTree(modelMap).parent(model._id)
    queue.add(newParent && newParent._id)

    clearTimeout(timer)
    timer = setTimeout(() => emptyQueue(modelMap), 1000)
  }
}
