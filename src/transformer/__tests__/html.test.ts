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
import { serializeToHTML } from '../html'
import { parseProjectBundle, ProjectBundle } from '../project-bundle'
import ProjectBundle2 from './data/project-bundle-2.json'
import projectBundle3 from './data/project-bundle-3.json'

describe('html', () => {
  test('export', () => {
    const { doc, modelMap } = parseProjectBundle(
      projectDump as ProjectBundle,
      JSDOM.fragment
    )

    const result = serializeToHTML(doc.content, modelMap)

    expect(result).toMatchSnapshot('html-export')
  })

  test('export with citations to fix', () => {
    const { doc, modelMap } = parseProjectBundle(
      ProjectBundle2 as ProjectBundle,
      JSDOM.fragment
    )

    const result = serializeToHTML(doc.content, modelMap)

    expect(result).toMatchSnapshot('html-export-citations')
  })

  test('export one manuscript from a bundle with multiple', () => {
    const { doc, modelMap } = parseProjectBundle(
      projectBundle3 as ProjectBundle,
      JSDOM.fragment,
      'MPManuscript:BCEB682E-C475-4BF7-9470-D6194D3EF0D8'
    )

    const result = serializeToHTML(doc.content, modelMap)

    expect(result).toMatchSnapshot('multi-manuscript-html-export')
  })
})
