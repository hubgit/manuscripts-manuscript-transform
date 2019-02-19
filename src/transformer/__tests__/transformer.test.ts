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

import { Decoder } from '../decode'
import { encode } from '../encode'
import { createTestModelMap } from './__helpers__/doc'

test('transformer', async () => {
  const input = createTestModelMap()
  const decoder = new Decoder(input)
  const doc = decoder.createArticleNode()
  const output = encode(doc)

  for (const [id, item] of input.entries()) {
    if (output.has(id)) {
      output.set(id, {
        ...item,
        ...output.get(id),
      })
    } else {
      output.set(id, item)
    }
  }

  for (const [id, item] of output.entries()) {
    expect(item).toEqual(input.get(id))
  }
})
