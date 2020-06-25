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

// https://github.com/citation-style-language/schema

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CSL {
  export type ItemType =
    | 'article'
    | 'article-journal'
    | 'article-magazine'
    | 'article-newspaper'
    | 'bill'
    | 'book'
    | 'broadcast'
    | 'chapter'
    | 'dataset'
    | 'entry'
    | 'entry-dictionary'
    | 'entry-encyclopedia'
    | 'figure'
    | 'graphic'
    | 'interview'
    | 'legal_case'
    | 'legislation'
    | 'manuscript'
    | 'map'
    | 'motion_picture'
    | 'musical_score'
    | 'pamphlet'
    | 'paper-conference'
    | 'patent'
    | 'personal_communication'
    | 'post'
    | 'post-weblog'
    | 'report'
    | 'review'
    | 'review-book'
    | 'song'
    | 'speech'
    | 'thesis'
    | 'treaty'
    | 'webpage'

  export interface Name {
    family?: string
    given?: string
    'dropping-particle'?: string
    'non-dropping-particle'?: string
    suffix?: string
    'comma-suffix'?: string | number | boolean
    'static-ordering'?: string | number | boolean
    literal?: string
    'parse-names'?: string | number | boolean
  }

  export interface Date {
    'date-parts'?: Array<Array<string | number>>
    season?: string | number
    // NOTE: circa can really be `string | number | boolean`
    // i.e. 'true', 1, or true
    circa?: boolean
    literal?: string
    raw?: string
  }

  export interface RoleFields {
    author?: Name[]
    'collection-editor'?: Name[]
    composer?: Name[]
    'container-author'?: Name[]
    director?: Name[]
    editor?: Name[]
    'editorial-director'?: Name[]
    interviewer?: Name[]
    illustrator?: Name[]
    'original-author'?: Name[]
    recipient?: Name[]
    'reviewed-author'?: Name[]
    translator?: Name[]
  }

  export interface DateFields {
    accessed?: Date
    container?: Date
    'event-date'?: Date
    issued?: Date
    'original-date'?: Date
    submitted?: Date
  }

  export interface StandardFields {
    type?: ItemType
    id?: string | number
    categories?: string[]
    language?: string
    journalAbbreviation?: string
    shortTitle?: string
    abstract?: string
    annote?: string
    archive?: string
    archive_location?: string
    'archive-place'?: string
    authority?: string
    'call-number'?: string
    'chapter-number'?: string
    'citation-number'?: string
    'citation-label'?: string
    'collection-number'?: string
    'collection-title'?: string
    'container-title'?: string
    'container-title-short'?: string
    dimensions?: string
    DOI?: string
    edition?: string | number
    event?: string
    'event-place'?: string
    'first-reference-note-number'?: string
    genre?: string
    ISBN?: string
    ISSN?: string
    issue?: string | number
    jurisdiction?: string
    keyword?: string
    locator?: string
    medium?: string
    note?: string
    number?: string | number
    'number-of-pages'?: string
    'number-of-volumes'?: string | number
    'original-publisher'?: string
    'original-publisher-place'?: string
    'original-title'?: string
    page?: string
    'page-first'?: string
    PMCID?: string
    PMID?: string
    publisher?: string
    'publisher-place'?: string
    references?: string
    'reviewed-title'?: string
    scale?: string
    section?: string
    source?: string
    status?: string
    title?: string
    'title-short'?: string
    URL?: string
    version?: string
    volume?: string | number
    'year-suffix'?: string
  }

  export type Item = StandardFields & DateFields & RoleFields
}
