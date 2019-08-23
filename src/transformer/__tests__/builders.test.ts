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
  BibliographicName,
  BibliographyItem,
  ObjectTypes,
} from '@manuscripts/manuscripts-json-schema'
import { CSL } from '../../types/csl'
import {
  buildAffiliation,
  buildAuxiliaryObjectReference,
  buildBibliographicDate,
  buildBibliographicName,
  buildBibliographyItem,
  buildCitation,
  buildContributor,
  buildFigure,
  buildKeyword,
  buildLibraryCollection,
  buildManuscript,
  buildProject,
} from '../builders'
import { ExtraObjectTypes } from '../object-types'

describe('commands', () => {
  it('buildProject', () => {
    const proj = buildProject('Mr Derp')
    expect(proj._id).toMatch(/MPProject:\S+/)
    expect(proj.objectType).toEqual(ObjectTypes.Project)
    expect(proj.owners).toEqual(['Mr Derp'])
    expect(proj.writers).toEqual([])
    expect(proj.viewers).toEqual([])
    expect(proj.title).toEqual('')
  })

  it('buildManuscript', () => {
    const manuscriptA = buildManuscript('Teh title')
    expect(manuscriptA._id).toMatch(/MPManuscript:\S+/)
    expect(manuscriptA.objectType).toEqual(ObjectTypes.Manuscript)
    expect(manuscriptA.title).toEqual('Teh title')

    const manuscriptB = buildManuscript()
    expect(manuscriptB._id).toMatch(/MPManuscript:\S+/)
    expect(manuscriptB.objectType).toEqual(ObjectTypes.Manuscript)
    expect(manuscriptB.title).toEqual('')
  })

  it('buildContributor', () => {
    const name: BibliographicName = {
      _id: 'contributor-a',
      objectType: ObjectTypes.BibliographicName,
      nonDroppingParticle: 'van der',
      family: 'Derp',
    }
    const contributor = buildContributor(name, 'author', 3)
    expect(contributor.objectType).toEqual(ObjectTypes.Contributor)
    expect(contributor.priority).toEqual(3)
    expect(contributor.role).toEqual('author')
    expect(contributor.affiliations).toEqual([])
    expect(contributor.bibliographicName.nonDroppingParticle).toEqual(
      name.nonDroppingParticle
    )
    expect(contributor.bibliographicName.family).toEqual(name.family)
    expect(contributor.bibliographicName.objectType).toEqual(
      ObjectTypes.BibliographicName
    )
  })

  it('buildBibliographyItem', () => {
    const data: Partial<BibliographyItem> = {
      title: 'Bibliography item title',
      DOI: 'xyz',
      URL: 'https://humdi.net/evo/',
    }
    const item = buildBibliographyItem(data)
    expect(item._id).toMatch(/MPBibliographyItem:\S+/)
    expect(item.objectType).toMatch(ObjectTypes.BibliographyItem)
    expect(item.title).toMatch(data.title!)
    expect(item.DOI).toMatch(data.DOI!)
    expect(item.URL).toMatch(data.URL!)
  })

  it('buildBibliographicName', () => {
    const name = {
      given: 'Herp',
      family: 'Derp',
    }
    const bibName = buildBibliographicName(name)
    expect(bibName.given).toMatch(name.given)
    expect(bibName.family).toMatch(name.family)
    expect(bibName._id).toMatch(/MPBibliographicName:\S+/)
    expect(bibName.objectType).toMatch(ObjectTypes.BibliographicName)
  })

  it('buildBibliographicDate', () => {
    const cslDate = { 'date-parts': [['1998', '20', '1']] }
    const date = buildBibliographicDate(cslDate as Partial<CSL.Date>)
    expect(date._id).toMatch(/MPBibliographicDate:\S+/)
    expect(date.objectType).toMatch(ObjectTypes.BibliographicDate)
    expect(date['date-parts']).toEqual(cslDate['date-parts'])
  })

  it('buildAuxiliaryObjectReference', () => {
    const auxRef = buildAuxiliaryObjectReference('x', 'y')
    expect(auxRef._id).toMatch(/MPAuxiliaryObjectReference:\S+/)
    expect(auxRef.objectType).toMatch(ExtraObjectTypes.AuxiliaryObjectReference)
    expect(auxRef.containingObject).toMatch('x')
    expect(auxRef.referencedObject).toMatch('y')
  })

  it('buildCitation', () => {
    const citation = buildCitation('x', ['y'])
    expect(citation._id).toMatch(/MPCitation:\S+/)
    expect(citation.containingObject).toMatch('x')
    expect(citation.embeddedCitationItems.length).toEqual(1)
    expect(citation.embeddedCitationItems[0].objectType).toEqual(
      ObjectTypes.CitationItem
    )
  })

  it('buildKeyword', () => {
    const keyword = buildKeyword('foo')
    expect(keyword.name).toMatch('foo')
    expect(keyword._id).toMatch(/MPKeyword:\S+/)
    expect(keyword.objectType).toMatch(ObjectTypes.Keyword)
  })

  it('buildLibraryCollection', () => {
    const libraryCollection = buildLibraryCollection('Mr Derp', 'foo')
    expect(libraryCollection.owners).toEqual(['Mr Derp'])
    expect(libraryCollection.writers).toEqual([])
    expect(libraryCollection.viewers).toEqual([])
    expect(libraryCollection.name).toMatch('foo')
    expect(libraryCollection._id).toMatch(/MPLibraryCollection:\S+/)
    expect(libraryCollection.objectType).toMatch(ObjectTypes.LibraryCollection)
  })

  it('buildFigure', () => {
    const file = new Blob(['foo'], {
      type: 'image/png',
    })

    const fig = buildFigure(file as File)
    expect(fig._id).toMatch(/MPFigure:\S+/)
    expect(fig.objectType).toMatch(ObjectTypes.Figure)
    expect(fig.contentType).toMatch(file.type)
    expect(fig.src).toMatch(
      /^blob:https:\/\/localhost\/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/
    )
  })

  it('buildAffiliation', () => {
    const aff = buildAffiliation('x')
    expect(aff._id).toMatch(/MPAffiliation:\S+/)
    expect(aff.objectType).toMatch(ObjectTypes.Affiliation)
    expect(aff.institution).toMatch('x')
  })
})
