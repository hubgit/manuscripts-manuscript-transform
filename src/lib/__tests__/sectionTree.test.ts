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

import projectDump3 from '@manuscripts/examples/data/project-dump-3.json'
import { Model } from '@manuscripts/manuscripts-json-schema'
import sectionTree from '../sectionTree'
const deepFreeze = require('deep-freeze') // tslint:disable-line:no-var-requires

interface ContainedModel extends Model {
  containerID: string
  manuscriptID?: string
  // [key: string]: any
}

const withRequiredProperties = <T extends ContainedModel>(
  model: Partial<T>
): T =>
  ({
    createdAt: 0,
    updatedAt: 0,
    containerID: 'MPProject:project-1',
    manuscriptID: 'MPManuscript:manuscript-1',
    ...model,
  } as T) // tslint:disable-line:no-object-literal-type-assertion

const data: ContainedModel[] = [
  {
    objectType: 'MPSection',
    _id: 'MPSection:top-level-1',
    priority: 1,
    path: ['MPSection:top-level-1'],
  },
  {
    objectType: 'MPSection',
    _id: 'MPSection:top-level-2',
    priority: 2,
    path: ['MPSection:top-level-2'],
  },
  {
    objectType: 'MPSection',
    _id: 'MPSection:child-2',
    priority: 2,
    path: ['MPSection:top-level-2', 'MPSection:child-2'],
  },
  {
    objectType: 'MPSection',
    _id: 'MPSection:child-1',
    priority: 1,
    path: ['MPSection:top-level-2', 'MPSection:child-1'],
  },
  {
    objectType: 'MPCitation',
    _id: 'MPCitation:not-a-section',
  },
].map(withRequiredProperties)

const modelMap = new Map(
  data.map(model => {
    return [model._id, model]
  })
)
deepFreeze(modelMap)

describe('sectionTree', () => {
  describe('parent', () => {
    it('should find a sections parent', () => {
      const result = sectionTree(modelMap).parent('MPSection:child-1')
      expect(result).toHaveProperty('_id', 'MPSection:top-level-2')
    })

    it('should return null for top-level parents', () => {
      const result = sectionTree(modelMap).parent('MPSection:top-level-2')
      expect(result).toBeNull()
    })

    it('should throw if called with a non-section', () => {
      expect(() => {
        sectionTree(modelMap).parent('MPCitation:not-a-section')
      }).toThrow()
    })
  })

  describe('children', () => {
    it('should find all children in order', () => {
      const result = sectionTree(modelMap).children('MPSection:top-level-2')
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('_id', 'MPSection:child-1')
      expect(result[1]).toHaveProperty('_id', 'MPSection:child-2')
    })
  })

  describe('siblings', () => {
    it('should find a sections siblings in order', () => {
      const result = sectionTree(modelMap).siblings('MPSection:child-1')
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('_id', 'MPSection:child-1')
      expect(result[1]).toHaveProperty('_id', 'MPSection:child-2')
    })

    it('should work for the top-level sections', () => {
      const result = sectionTree(modelMap).siblings('MPSection:top-level-1')
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('_id', 'MPSection:top-level-1')
      expect(result[1]).toHaveProperty('_id', 'MPSection:top-level-2')
    })

    it('should throw if called on a non-section', () => {
      expect(() => {
        sectionTree(modelMap).siblings('MPCitation.not-a-section')
      }).toThrow()
    })

    it('should match snapshot', () => {
      /* tslint:disable-next-line:no-any */
      const modelMap: any = new Map(
        projectDump3.data.map(model => {
          return [model._id, model]
        })
      )
      deepFreeze(modelMap)
      const result = sectionTree(modelMap).siblings(
        'MPSection:786116A4-364C-428B-9B05-FE447B1AEEFB'
      )
      expect(result).toMatchSnapshot()
    })
  })
})
