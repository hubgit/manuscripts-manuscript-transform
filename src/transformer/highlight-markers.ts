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
  HighlightMarker,
  Model,
  ObjectTypes,
} from '@manuscripts/manuscripts-json-schema'

export type HighlightableField = 'title' | 'caption' | 'contents'

const highlightableFields: HighlightableField[] = [
  'caption',
  'contents',
  'title',
]

export const isHighlightableModel = (
  model: Model
): model is HighlightableModel => {
  for (const field of highlightableFields) {
    if (field in model) {
      return true
    }
  }

  return false
}

export interface HighlightableModel extends Model {
  contents?: string
  title?: string
  caption?: string
  highlightMarkers: HighlightMarker[]
}

// tslint:disable-next-line:cyclomatic-complexity
export const extractHighlightMarkers = (model: HighlightableModel) => {
  const highlightMarkers: HighlightMarker[] = []

  for (const field of highlightableFields) {
    let html = model[field]

    if (html === undefined) {
      continue
    }

    const template = document.createElement('template')
    template.innerHTML = `<div>${html}</div>` // ensure a wrapper

    const element = template.content.firstChild

    if (!(element instanceof Element)) {
      continue
    }

    const markers = element.querySelectorAll('span.highlight-marker')

    if (markers.length) {
      // splice the markers out in order
      for (const marker of markers) {
        const markerHTML = marker.outerHTML

        const offset: number = html.indexOf(markerHTML) // TODO: ensure this is reliable

        if (offset === -1) {
          continue
        }

        const _id = marker.getAttribute('id')
        const highlightID = marker.getAttribute('data-reference-id')

        if (_id && highlightID) {
          const start = marker.getAttribute('data-position') === 'start'

          highlightMarkers.push({
            _id,
            objectType: ObjectTypes.HighlightMarker,
            highlightID,
            field,
            start,
            offset,
          })
        }

        // splice out the marker
        html = html.substr(0, offset) + html.substr(offset + markerHTML.length)
      }

      model[field] = html
    }
  }

  if (highlightMarkers.length) {
    model.highlightMarkers = highlightMarkers
  }
}

export const insertHighlightMarkers = (
  field: string,
  contents: string,
  highlightMarkers: HighlightMarker[]
): string => {
  let output = contents

  const relevantHighlightMarkers = highlightMarkers
    // only use markers in this field
    .filter(highlightMarker => highlightMarker.field === field)
    // sort highest offset first, for splicing
    .sort((a, b) => b.offset - a.offset)

  for (const highlightMarker of relevantHighlightMarkers) {
    const element = document.createElement('span')
    element.className = 'highlight-marker'
    element.setAttribute('id', highlightMarker._id)
    element.setAttribute('data-reference-id', highlightMarker.highlightID)
    element.setAttribute(
      'data-position',
      highlightMarker.start ? 'start' : 'end'
    )

    const parts = [
      output.substring(0, highlightMarker.offset),
      element.outerHTML,
      output.substring(highlightMarker.offset),
    ]

    output = parts.join('')
  }

  return output
}
