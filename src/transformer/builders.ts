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

import {
  Affiliation,
  BibliographicDate,
  BibliographicName,
  BibliographyItem,
  Citation,
  CitationItem,
  Color,
  Contributor,
  EmbeddedModel,
  Figure,
  Footnote,
  InlineMathFragment,
  Keyword,
  Manuscript,
  ObjectTypes,
  ParagraphElement,
  Project,
  Section,
  UserProfileAffiliation,
} from '@manuscripts/manuscripts-json-schema'
import { CSL } from '..'
import { generateID } from './id'
import {
  AuxiliaryObjectReference,
  CommentAnnotation,
  CommentSelector,
  ManuscriptModel,
  ModelAttachment,
} from './models'
import { ExtraObjectTypes } from './object-types'

export const DEFAULT_BUNDLE = 'MPBundle:www-zotero-org-styles-nature'
export const DEFAULT_PAGE_LAYOUT = 'MPPageLayout:defaultA4'

export type Build<T> = Pick<T, Exclude<keyof T, keyof ManuscriptModel>> & {
  _id: string
  objectType: string
}

// export interface EmbeddedModel {
//   _id: string
//   objectType: string
// }

export type BuildEmbedded<T extends EmbeddedModel, O> = Pick<
  T,
  Exclude<keyof T, keyof ManuscriptModel>
> & {
  _id: string
  objectType: O
}

export const buildProject = (owner: string): Build<Project> => ({
  _id: generateID(ObjectTypes.Project),
  objectType: ObjectTypes.Project,
  owners: [owner],
  writers: [],
  viewers: [],
  title: '',
})

export const buildManuscript = (title: string = ''): Build<Manuscript> => ({
  _id: generateID(ObjectTypes.Manuscript),
  objectType: ObjectTypes.Manuscript,
  title,
})

export type ContributorRole = 'author'

export const buildContributor = (
  bibliographicName: BibliographicName,
  role: ContributorRole = 'author',
  priority: number = 0,
  userID?: string,
  invitationID?: string
): Build<Contributor> => ({
  _id: generateID(ObjectTypes.Contributor),
  objectType: ObjectTypes.Contributor,
  priority,
  role,
  affiliations: [],
  bibliographicName: buildBibliographicName(bibliographicName),
  userID,
  invitationID,
})

export const buildBibliographyItem = (
  data: Partial<Build<BibliographyItem>>
): Build<BibliographyItem> => ({
  ...data,
  type: data.type || 'article-journal',
  _id: generateID(ObjectTypes.BibliographyItem),
  objectType: ObjectTypes.BibliographyItem,
})

export const buildBibliographicName = (
  data: Partial<BibliographicName>
): BuildEmbedded<BibliographicName, ObjectTypes.BibliographicName> => ({
  ...data,
  _id: generateID(ObjectTypes.BibliographicName),
  objectType: ObjectTypes.BibliographicName,
})

export const buildBibliographicDate = (
  data: Partial<CSL.Date>
): BuildEmbedded<BibliographicDate, ObjectTypes.BibliographicDate> => ({
  ...data,
  _id: generateID(ObjectTypes.BibliographicDate),
  objectType: ObjectTypes.BibliographicDate,
})

export const buildAuxiliaryObjectReference = (
  containingObject: string,
  referencedObject: string
): Build<AuxiliaryObjectReference> => ({
  _id: generateID(ExtraObjectTypes.AuxiliaryObjectReference),
  objectType: ExtraObjectTypes.AuxiliaryObjectReference,
  containingObject,
  referencedObject,
})

export const buildEmbeddedCitationItem = (
  bibliographyItem: string
): CitationItem => ({
  _id: generateID(ObjectTypes.CitationItem),
  objectType: ObjectTypes.CitationItem,
  bibliographyItem,
})

export const buildCitation = (
  containingObject: string,
  embeddedCitationItems: string[]
): Build<Citation> => ({
  _id: generateID(ObjectTypes.Citation),
  objectType: ObjectTypes.Citation,
  containingObject,
  embeddedCitationItems: embeddedCitationItems.map(buildEmbeddedCitationItem),
})

export const buildKeyword = (name: string): Build<Keyword> => ({
  _id: generateID(ObjectTypes.Keyword),
  objectType: ObjectTypes.Keyword,
  name,
})

export const buildFigure = (blob: Blob): Build<Figure & ModelAttachment> => ({
  _id: generateID(ObjectTypes.Figure),
  objectType: ObjectTypes.Figure,
  contentType: blob.type,
  src: window.URL.createObjectURL(blob),
  attachment: {
    id: 'image',
    type: blob.type,
    data: blob,
  },
})

export const buildAffiliation = (
  institution: string,
  priority: number = 0
): Build<Affiliation> => ({
  _id: generateID(ObjectTypes.Affiliation),
  objectType: ObjectTypes.Affiliation,
  institution,
  priority,
})

export const buildUserProfileAffiliation = (
  institution: string,
  priority: number = 0
): Build<UserProfileAffiliation> => ({
  _id: generateID(ObjectTypes.UserProfileAffiliation),
  objectType: ObjectTypes.UserProfileAffiliation,
  institution,
  priority,
})

export const buildComment = (
  userID: string,
  target: string,
  contents: string = '',
  selector?: CommentSelector
): Build<CommentAnnotation> => ({
  _id: generateID(ExtraObjectTypes.CommentAnnotation),
  objectType: ExtraObjectTypes.CommentAnnotation,
  userID,
  target,
  selector,
  contents,
})

export const buildInlineMathFragment = (
  containingObject: string,
  TeXRepresentation: string
): Build<InlineMathFragment> => ({
  _id: generateID(ObjectTypes.InlineMathFragment),
  objectType: ObjectTypes.InlineMathFragment,
  containingObject,
  TeXRepresentation,
})

export const buildFootnote = (
  containingObject: string,
  contents: string
): Build<Footnote> => ({
  _id: generateID(ObjectTypes.Footnote),
  objectType: ObjectTypes.Footnote,
  containingObject,
  contents,
})

export const buildSection = (
  priority: number = 0,
  path: string[] = []
): Build<Section> => {
  const id = generateID(ObjectTypes.Section)

  return {
    _id: id,
    objectType: ObjectTypes.Section,
    priority,
    path: path.concat(id),
  }
}

export const buildParagraph = (contents: string): Build<ParagraphElement> => ({
  _id: generateID(ObjectTypes.ParagraphElement),
  objectType: ObjectTypes.ParagraphElement,
  elementType: 'p',
  contents,
})

export const buildColor = (value: string, priority: number): Build<Color> => ({
  _id: generateID(ObjectTypes.Color),
  objectType: ObjectTypes.Color,
  priority,
  value,
})
