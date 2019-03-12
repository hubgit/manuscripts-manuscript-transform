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

import projectDump from '@manuscripts/examples/data/project-dump.json'
import { JSDOM } from 'jsdom'
import { serializeToJATS } from '../jats'
import { parseProjectBundle, ProjectBundle } from '../project-bundle'

const projectBundle = projectDump as ProjectBundle

describe('jats', () => {
  test('export latest version', () => {
    const { doc, modelMap } = parseProjectBundle(projectBundle, JSDOM.fragment)

    const result = serializeToJATS(doc.content, modelMap)

    expect(result).toMatchSnapshot('jats-export')
  })

  test('export v1.1', () => {
    const { doc, modelMap } = parseProjectBundle(projectBundle, JSDOM.fragment)

    const result = serializeToJATS(doc.content, modelMap, '1.1')

    expect(result).toMatchSnapshot('jats-export-1.1')
  })

  test('export unknown version', () => {
    const { doc, modelMap } = parseProjectBundle(projectBundle, JSDOM.fragment)

    expect(() => {
      serializeToJATS(doc.content, modelMap, '1.0')
    }).toThrow()
  })
})
