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
import {
  isTreeChange,
  mergeElementIDs,
  treeUpdateQueue,
  walkSectionTree,
} from '../sectionTree'
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
    elementIDs: ['MPParagraphElement:para-1'],
  },
  {
    objectType: 'MPSection',
    _id: 'MPSection:top-level-2',
    priority: 2,
    path: ['MPSection:top-level-2'],
    elementIDs: [
      'MPParagraphElement:para-2',
      'MPSection:child-1',
      'MPSection:child-2',
    ],
  },
  {
    objectType: 'MPSection',
    _id: 'MPSection:child-2',
    priority: 2,
    path: ['MPSection:top-level-2', 'MPSection:child-2'],
    elementIDs: ['MPParagraphElement:para-3'],
  },
  {
    objectType: 'MPSection',
    _id: 'MPSection:child-1',
    priority: 1,
    path: ['MPSection:top-level-2', 'MPSection:child-1'],
    elementIDs: ['MPParagraphElement:para-4'],
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

describe('walkSectionTree', () => {
  describe('parent', () => {
    it('should find a sections parent', () => {
      const result = walkSectionTree(modelMap).parent('MPSection:child-1')
      expect(result).toHaveProperty('_id', 'MPSection:top-level-2')
    })

    it('should return null for top-level parents', () => {
      const result = walkSectionTree(modelMap).parent('MPSection:top-level-2')
      expect(result).toBeNull()
    })

    it('should throw if called with a non-section', () => {
      expect(() => {
        walkSectionTree(modelMap).parent('MPCitation:not-a-section')
      }).toThrow()
    })
  })

  describe('children', () => {
    it('should find all children in order', () => {
      const result = walkSectionTree(modelMap).children('MPSection:top-level-2')
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('_id', 'MPSection:child-1')
      expect(result[1]).toHaveProperty('_id', 'MPSection:child-2')
    })
  })

  describe('siblings', () => {
    it('should find a sections siblings in order', () => {
      const result = walkSectionTree(modelMap).siblings('MPSection:child-1')
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('_id', 'MPSection:child-1')
      expect(result[1]).toHaveProperty('_id', 'MPSection:child-2')
    })

    it('should work for the top-level sections', () => {
      const result = walkSectionTree(modelMap).siblings('MPSection:top-level-1')
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('_id', 'MPSection:top-level-1')
      expect(result[1]).toHaveProperty('_id', 'MPSection:top-level-2')
    })

    it('should throw if called on a non-section', () => {
      expect(() => {
        walkSectionTree(modelMap).siblings('MPCitation.not-a-section')
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
      const result = walkSectionTree(modelMap).siblings(
        'MPSection:786116A4-364C-428B-9B05-FE447B1AEEFB'
      )
      expect(result).toMatchSnapshot()
    })
  })
})

describe('mergeElementIDs', () => {
  it('should merge non-section with the ordered next children', () => {
    const section = modelMap.get('MPSection:top-level-2')
    // reorder the child sections
    const result = mergeElementIDs(section, [
      'MPSection:child-2',
      'MPSection:child-1',
    ])
    expect(result).toEqual([
      'MPParagraphElement:para-2',
      'MPSection:child-2',
      'MPSection:child-1',
    ])
  })
})

describe('isTreeChange', () => {
  it('should be true if the sections priority has changed', () => {
    const result = isTreeChange(
      {
        objectType: 'MPSection',
        _id: 'MPSection:child-2',
        priority: 1,
        path: ['MPSection:top-level-2', 'MPSection:child-2'],
        elementIDs: ['MPParagraphElement:para-3'],
        createdAt: 0,
        updatedAt: 0,
      },
      modelMap
    )
    expect(result).toBeTruthy()
  })

  it('should be true if the sections path has changed', () => {
    const result = isTreeChange(
      {
        objectType: 'MPSection',
        _id: 'MPSection:child-2',
        priority: 2,
        path: ['MPSection:top-level-1', 'MPSection:child-2'],
        elementIDs: ['MPParagraphElement:para-3'],
        createdAt: 0,
        updatedAt: 0,
      },
      modelMap
    )
    expect(result).toBeTruthy()
  })

  it('should be false if the sections path and priority are the same', () => {
    const result = isTreeChange(
      {
        objectType: 'MPSection',
        _id: 'MPSection:child-2',
        priority: 2,
        path: ['MPSection:top-level-2', 'MPSection:child-2'],
        elementIDs: ['MPParagraphElement:para-3'],
        createdAt: 0,
        updatedAt: 0,
      },
      modelMap
    )
    expect(result).toBeFalsy()
  })

  it('should be false if the element is not a section', () => {
    const result = isTreeChange(
      {
        objectType: 'MPCitation',
        _id: 'MPCitation:a-new-citation',
        createdAt: 0,
        updatedAt: 0,
      },
      modelMap
    )
    expect(result).toBeFalsy()
  })

  it('should always be true for a new section', () => {
    const result = isTreeChange(
      {
        objectType: 'MPSection',
        _id: 'MPSection:a-new-section',
        priority: 2,
        path: ['MPSection:top-level-2', 'MPSection:a-new-section'],
        elementIDs: ['MPParagraphElement:para-3'],
        createdAt: 0,
        updatedAt: 0,
      },
      modelMap
    )
    expect(result).toBeTruthy()
  })
})

describe('queueTreeChanges', () => {
  it('should call back with data needed for the update', done => {
    const updatedSection = {
      objectType: 'MPSection',
      _id: 'MPSection:child-1',
      priority: 3,
      path: ['MPSection:top-level-2', 'MPSection:child-1'],
      elementIDs: ['MPParagraphElement:para-4'],
      createdAt: 0,
      updatedAt: 0,
    }
    const callback = change => {
      expect(change.nextParentModel).toHaveProperty(
        '_id',
        'MPSection:top-level-2'
      )
      expect(change.blocksToUpdate).toEqual([
        'MPSection:child-2',
        'MPSection:child-1',
      ])
      done()
    }
    treeUpdateQueue(callback)(updatedSection, modelMap)
  })

  it('should batch updates that affect sibling sections', done => {
    const updatedSection1 = {
      objectType: 'MPSection',
      _id: 'MPSection:child-1',
      priority: 2,
      path: ['MPSection:top-level-2', 'MPSection:child-1'],
      elementIDs: ['MPParagraphElement:para-4'],
      createdAt: 0,
      updatedAt: 0,
    }
    const updatedSection2 = {
      objectType: 'MPSection',
      _id: 'MPSection:child-2',
      priority: 1,
      path: ['MPSection:top-level-2', 'MPSection:child-2'],
      elementIDs: ['MPParagraphElement:para-3'],
      createdAt: 0,
      updatedAt: 0,
    }

    const callback = change => {
      expect(change.nextParentModel).toHaveProperty(
        '_id',
        'MPSection:top-level-2'
      )
      expect(change.blocksToUpdate).toEqual([
        'MPSection:child-2',
        'MPSection:child-1',
      ])
      done()
    }

    const queue = treeUpdateQueue(callback)
    queue(updatedSection1, modelMap)
    queue(updatedSection2, modelMap)
  })

  it('should call with multiple arguments when more than one parent is affected', done => {
    const updatedSection = {
      objectType: 'MPSection',
      _id: 'MPSection:child-1',
      priority: 1,
      path: ['MPSection:child-1'],
      elementIDs: ['MPParagraphElement:para-4'],
      createdAt: 0,
      updatedAt: 0,
    }

    const callback = (change1, change2) => {
      expect(change1.nextParentModel).toHaveProperty(
        '_id',
        'MPSection:top-level-2'
      )
      expect(change2.nextParentModel).toBeNull()
      expect(change2.blocksToUpdate).toContain('MPSection:child-1')

      done()
    }

    treeUpdateQueue(callback)(updatedSection, modelMap)
  })
})
