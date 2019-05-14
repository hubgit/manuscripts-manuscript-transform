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

import { Manuscript, ObjectTypes } from '@manuscripts/manuscripts-json-schema'
import { hasObjectType } from '../object-types'
import { findLatestManuscriptSubmission } from '../project-bundle'
import { createTestModelMap } from './__helpers__/doc'
import { submissions } from './__helpers__/submissions'

const isManuscript = hasObjectType<Manuscript>(ObjectTypes.Manuscript)

test('find latest manuscript submission', () => {
  const modelMap = createTestModelMap()

  for (const submission of submissions) {
    modelMap.set(submission._id, submission)
  }

  const manuscript = Array.from(modelMap.values()).find(isManuscript)

  if (!manuscript) {
    throw new Error('No manuscript found in project bundle')
  }

  const result = findLatestManuscriptSubmission(modelMap, manuscript)

  expect(result!._id).toBe('MPSubmission:2')
})