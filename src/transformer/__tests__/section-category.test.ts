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

import { schema } from '../../schema'
import {
  buildSectionCategory,
  isAnySectionNode,
  sectionCategorySuffix,
} from '../section-category'

describe('section category helpers', () => {
  test('any section node', () => {
    expect(isAnySectionNode(schema.nodes.section.create())).toBe(true)

    expect(isAnySectionNode(schema.nodes.keywords_section.create())).toBe(true)

    expect(isAnySectionNode(schema.nodes.keywords_element.create())).toBe(false)
  })

  test('section category', () => {
    expect(buildSectionCategory(schema.nodes.section.create())).toBeUndefined()

    expect(
      buildSectionCategory(
        schema.nodes.section.create({
          category: 'MPSectionCategory:section',
        })
      )
    ).toBe('MPSectionCategory:section')

    expect(buildSectionCategory(schema.nodes.keywords_section.create())).toBe(
      'MPSectionCategory:keywords'
    )
  })

  test('section category suffix', () => {
    expect(sectionCategorySuffix('MPSectionCategory:keywords')).toBe('keywords')
  })
})
