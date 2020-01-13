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

import projectDump2 from '@manuscripts/examples/data/project-dump-2.json'
import projectDump3 from '@manuscripts/examples/data/project-dump-3.json'
import projectDump from '@manuscripts/examples/data/project-dump.json'
// import { Keyword, Manuscript } from '@manuscripts/manuscripts-json-schema'
import { HTMLTransformer } from '../html'
// import { isManuscript } from '../object-types'
import { parseProjectBundle, ProjectBundle } from '../project-bundle'

describe('html', () => {
  test('export', () => {
    const { doc, modelMap } = parseProjectBundle(projectDump as ProjectBundle)

    const transformer = new HTMLTransformer()
    const result = transformer.serializeToHTML(doc.content, modelMap)

    expect(result).toMatchSnapshot('html-export')
  })

  test('export with citations to fix', () => {
    const { doc, modelMap } = parseProjectBundle(projectDump2 as ProjectBundle)

    const transformer = new HTMLTransformer()
    const result = transformer.serializeToHTML(doc.content, modelMap)

    expect(result).toMatchSnapshot('html-export-citations')
  })

  test('export one manuscript from a bundle with multiple', () => {
    const { doc, modelMap } = parseProjectBundle(
      projectDump3 as ProjectBundle,
      'MPManuscript:BCEB682E-C475-4BF7-9470-D6194D3EF0D8'
    )

    const transformer = new HTMLTransformer()
    const result = transformer.serializeToHTML(doc.content, modelMap)

    expect(result).toMatchSnapshot('multi-manuscript-html-export')
  })

  test('custom attachment URL', () => {
    const { doc, modelMap } = parseProjectBundle(
      (projectDump as unknown) as ProjectBundle
    )

    const transformer = new HTMLTransformer()
    const result = transformer.serializeToHTML(
      doc.content,
      modelMap,
      'http://example.com/'
    )

    expect(result).toMatchSnapshot('html-export-custom-url')
  })

  // test('handle keywords', () => {
  //   const { doc, modelMap } = parseProjectBundle(
  //     (projectDump as unknown) as ProjectBundle
  //   )
  //
  //   const keywords: Keyword[] = [
  //     {
  //       _id: 'MPKeyword:1',
  //       objectType: 'MPKeyword',
  //       createdAt: 0,
  //       updatedAt: 0,
  //       name: 'Foo',
  //       containerID: 'MPProject:1',
  //       sessionID: 'foo',
  //       priority: 0,
  //     },
  //     {
  //       _id: 'MPKeyword:2',
  //       objectType: 'MPKeyword',
  //       createdAt: 0,
  //       updatedAt: 0,
  //       name: 'Bar',
  //       containerID: 'MPProject:1',
  //       sessionID: 'foo',
  //       priority: 0,
  //     },
  //   ]
  //
  //   for (const keyword of keywords) {
  //     modelMap.set(keyword._id, keyword)
  //   }
  //
  //   const manuscript = Array.from(modelMap.values()).find(
  //     isManuscript
  //   ) as Manuscript
  //
  //   manuscript.keywordIDs = keywords.map(keyword => keyword._id)
  //
  //   const transformer = new HTMLTransformer()
  //   const result = transformer.serializeToHTML(
  //     doc.content,
  //     modelMap,
  //     'http://example.com/'
  //   )
  //
  //   expect(result).toMatchSnapshot('html-export-keywords')
  // })
})
