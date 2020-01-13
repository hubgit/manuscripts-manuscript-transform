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
  Figure,
  FigureElement,
  Highlight,
  Manuscript,
  Model,
  ObjectTypes,
  ParagraphElement,
  Project,
  Section,
} from '@manuscripts/manuscripts-json-schema'

export const createTestModelMapWithHighlights = () => {
  const modelMap = new Map<string, Model>()

  const project: Project = {
    objectType: ObjectTypes.Project,
    _id: 'MPProject:1',
    createdAt: 0,
    updatedAt: 0,
    sessionID: 'test',
    owners: [],
    writers: [],
    viewers: [],
  }

  const manuscript: Manuscript = {
    objectType: ObjectTypes.Manuscript,
    _id: 'MPManuscript:1',
    createdAt: 0,
    updatedAt: 0,
    containerID: project._id,
    sessionID: 'test',
  }

  modelMap.set(manuscript._id, manuscript)

  const paragraphHighlight: Highlight = {
    objectType: ObjectTypes.Highlight,
    _id: 'MPHighlight:1',
    createdAt: 0,
    updatedAt: 0,
    manuscriptID: manuscript._id,
    containerID: project._id,
    sessionID: 'test',
  }

  modelMap.set(paragraphHighlight._id, paragraphHighlight)

  const paragraphWithHighlight: ParagraphElement = {
    objectType: ObjectTypes.ParagraphElement,
    _id: 'MPParagraphElement:1',
    createdAt: 0,
    updatedAt: 0,
    manuscriptID: manuscript._id,
    containerID: project._id,
    sessionID: 'test',
    elementType: 'p',
    paragraphStyle: 'MPParagraphStyle:1',
    contents:
      '<p xmlns="http://www.w3.org/1999/xhtml" id="MPParagraphElement:1" class="MPElement MPParagraphStyle_1" data-object-type="MPParagraphElement">This sentence contains a highlight.</p>',
    highlightMarkers: [
      {
        objectType: ObjectTypes.HighlightMarker,
        _id: 'MPHighlightMarker:1',
        highlightID: paragraphHighlight._id,
        start: true,
        field: 'contents',
        offset: 166,
      },
      {
        objectType: ObjectTypes.HighlightMarker,
        _id: 'MPHighlightMarker:2',
        highlightID: paragraphHighlight._id,
        start: false,
        field: 'contents',
        offset: 175,
      },
    ],
  }

  modelMap.set(paragraphWithHighlight._id, paragraphWithHighlight)

  const figureHighlight: Highlight = {
    objectType: ObjectTypes.Highlight,
    _id: 'MPHighlight:4',
    createdAt: 0,
    updatedAt: 0,
    manuscriptID: manuscript._id,
    containerID: project._id,
    sessionID: 'test',
  }

  modelMap.set(figureHighlight._id, figureHighlight)

  const figureWithHighlight: Figure = {
    objectType: ObjectTypes.Figure,
    _id: 'MPFigure:1',
    createdAt: 0,
    updatedAt: 0,
    manuscriptID: manuscript._id,
    containerID: project._id,
    sessionID: 'test',
    title: 'A figure',
    highlightMarkers: [
      {
        objectType: ObjectTypes.HighlightMarker,
        _id: 'MPHighlightMarker:7',
        highlightID: figureHighlight._id,
        start: true,
        field: 'title',
        offset: 0,
      },
      {
        objectType: ObjectTypes.HighlightMarker,
        _id: 'MPHighlightMarker:8',
        highlightID: figureHighlight._id,
        start: false,
        field: 'title',
        offset: 1,
      },
    ],
  }

  modelMap.set(figureWithHighlight._id, figureWithHighlight)

  const figureElementHighlight: Highlight = {
    objectType: ObjectTypes.Highlight,
    _id: 'MPHighlight:3',
    createdAt: 0,
    updatedAt: 0,
    manuscriptID: manuscript._id,
    containerID: project._id,
    sessionID: 'test',
  }

  modelMap.set(figureElementHighlight._id, figureElementHighlight)

  const figureElementWithHighlight: FigureElement = {
    objectType: ObjectTypes.FigureElement,
    _id: 'MPFigureElement:1',
    createdAt: 0,
    updatedAt: 0,
    manuscriptID: manuscript._id,
    containerID: project._id,
    sessionID: 'test',
    elementType: 'figure',
    caption: 'A figure with a caption',
    figureStyle: 'MPFigureStyle:1',
    containedObjectIDs: [figureWithHighlight._id],
    highlightMarkers: [
      {
        objectType: ObjectTypes.HighlightMarker,
        _id: 'MPHighlightMarker:5',
        highlightID: figureElementHighlight._id,
        start: true,
        field: 'caption',
        offset: 16,
      },
      {
        objectType: ObjectTypes.HighlightMarker,
        _id: 'MPHighlightMarker:6',
        highlightID: figureElementHighlight._id,
        start: false,
        field: 'caption',
        offset: 23,
      },
    ],
  }

  modelMap.set(figureElementWithHighlight._id, figureElementWithHighlight)

  const sectionHighlight: Highlight = {
    objectType: ObjectTypes.Highlight,
    _id: 'MPHighlight:2',
    createdAt: 0,
    updatedAt: 0,
    manuscriptID: manuscript._id,
    containerID: project._id,
    sessionID: 'test',
  }

  modelMap.set(sectionHighlight._id, sectionHighlight)

  const sectionWithHighlights: Section = {
    objectType: ObjectTypes.Section,
    _id: 'MPSection:1',
    createdAt: 0,
    updatedAt: 0,
    manuscriptID: manuscript._id,
    containerID: project._id,
    sessionID: 'test',
    priority: 1,
    path: ['MPSection:1'],
    elementIDs: [paragraphWithHighlight._id, figureElementWithHighlight._id],
    title: 'A section title with a highlight',
    highlightMarkers: [
      {
        objectType: ObjectTypes.HighlightMarker,
        _id: 'MPHighlightMarker:3',
        highlightID: sectionHighlight._id,
        start: true,
        field: 'title',
        offset: 23,
      },
      {
        objectType: ObjectTypes.HighlightMarker,
        _id: 'MPHighlightMarker:4',
        highlightID: sectionHighlight._id,
        start: false,
        field: 'title',
        offset: 32,
      },
    ],
  }

  modelMap.set(sectionWithHighlights._id, sectionWithHighlights)

  return modelMap
}