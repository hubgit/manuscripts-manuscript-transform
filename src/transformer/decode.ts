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
  BibliographyElement,
  Element,
  Equation,
  EquationElement,
  Figure,
  FigureElement,
  FootnotesElement,
  HighlightMarker,
  KeywordsElement,
  ListElement,
  Listing,
  ListingElement,
  Model,
  ObjectTypes,
  ParagraphElement,
  QuoteElement,
  Section,
  Table,
  TableElement,
  TOCElement,
} from '@manuscripts/manuscripts-json-schema'
import debug from 'debug'
import { DOMParser, ParseOptions } from 'prosemirror-model'
import { RxDocument } from 'rxdb'
import {
  BibliographyElementNode,
  BlockquoteElementNode,
  BulletListNode,
  EquationElementNode,
  EquationNode,
  FigCaptionNode,
  FigureElementNode,
  FigureNode,
  FootnotesElementNode,
  ListingElementNode,
  ListingNode,
  ManuscriptNode,
  OrderedListNode,
  ParagraphNode,
  PlaceholderElementNode,
  PlaceholderNode,
  PullquoteElementNode,
  schema,
  SectionNode,
  SectionTitleNode,
  TableElementNode,
  TableNode,
  TOCElementNode,
} from '../schema'
import { insertHighlightMarkers } from './highlight-markers'
import { generateNodeID } from './id'
import { PlaceholderElement } from './models'
import {
  ExtraObjectTypes,
  hasObjectType,
  isFigure,
  isManuscript,
  isUserProfile,
} from './object-types'
import { chooseSectionNodeType, guessSectionCategory } from './section-category'
import { timestamp } from './timestamp'

const warn = debug('manuscripts-transform')

const parser = DOMParser.fromSchema(schema)

interface NodeCreatorMap {
  [key: string]: (data: Model) => ManuscriptNode
}

export const getModelData = <T extends Model>(model: Model): T => {
  const { _rev, _deleted, updatedAt, createdAt, sessionID, ...data } = model

  return data as T
}

export const getAttachment = async (doc: RxDocument<Model>, key: string) => {
  const attachment = doc.getAttachment(key)
  if (!attachment) return undefined

  const data = await attachment.getData()
  if (!data) return undefined

  return window.URL.createObjectURL(data)
}

export const buildModelMap = async (
  docs: Array<RxDocument<Model>>
): Promise<Map<string, Model>> => {
  const items: Map<string, RxDocument<Model>> = new Map()
  const output: Map<string, Model> = new Map()

  await Promise.all(
    docs.map(async doc => {
      items.set(doc._id, doc)
      output.set(doc._id, getModelData(doc.toJSON()))
    })
  )

  for (const model of output.values()) {
    if (isFigure(model)) {
      if (model.listingAttachment) {
        const { listingID, attachmentKey } = model.listingAttachment
        const listingDoc = items.get(listingID)

        if (listingDoc) {
          model.src = await getAttachment(listingDoc, attachmentKey)
        }
      } else {
        const figureDoc = items.get(model._id)!
        model.src = await getAttachment(figureDoc, 'image')
      }
    }
    // TODO: enable once tables can be images
    // else if (isTable(model)) {
    //   if (model.listingAttachment) {
    //     const { listingID, attachmentKey } = model.listingAttachment
    //     const listingDoc = items.get(listingID)
    //
    //     if (listingDoc) {
    //       model.src = await getAttachment(listingDoc, attachmentKey)
    //     }
    //   } else {
    //     const tableDoc = items.get(model._id)!
    //     model.src = await getAttachment(tableDoc, 'image')
    //   }
    // }
    else if (isUserProfile(model)) {
      const userProfileDoc = items.get(model._id)!
      model.avatar = await getAttachment(userProfileDoc, 'image')
    }
  }

  return output
}

export const getModelsByType = <T extends Model>(
  modelMap: Map<string, Model>,
  objectType: string
): T[] => {
  const output: T[] = []

  for (const model of modelMap.values()) {
    if (model.objectType === objectType) {
      output.push(model as T)
    }
  }

  return output
}

export const sortSectionsByPriority = (a: Section, b: Section) =>
  a.priority === b.priority ? 0 : Number(a.priority) - Number(b.priority)

// TODO: include bibliography and toc sections
const getSections = (modelMap: Map<string, Model>) =>
  getModelsByType<Section>(modelMap, ObjectTypes.Section).sort(
    sortSectionsByPriority
  )

export const isManuscriptNode = (
  model: ManuscriptNode | null
): model is ManuscriptNode => model !== null

const isParagraphElement = hasObjectType<ParagraphElement>(
  ObjectTypes.ParagraphElement
)

const hasParentSection = (id: string) => (section: Section) =>
  section.path &&
  section.path.length > 1 &&
  section.path[section.path.length - 2] === id

export class Decoder {
  private readonly modelMap: Map<string, Model>

  private creators: NodeCreatorMap = {
    [ObjectTypes.BibliographyElement]: data => {
      const model = data as BibliographyElement

      return schema.nodes.bibliography_element.create({
        id: model._id,
        contents: model.contents
          ? model.contents.replace(/\s+xmlns=".+?"/, '')
          : '',
      }) as BibliographyElementNode
    },
    [ExtraObjectTypes.PlaceholderElement]: data => {
      const model = data as PlaceholderElement

      return schema.nodes.placeholder_element.create({
        id: model._id,
      }) as PlaceholderElementNode
    },
    [ObjectTypes.FigureElement]: data => {
      const model = data as FigureElement

      const figcaptionNode: FigCaptionNode = schema.nodes.figcaption.create()

      const figcaption: FigCaptionNode = model.caption
        ? this.parseContents(
            'caption',
            model.caption,
            'figcaption',
            model.highlightMarkers,
            {
              topNode: figcaptionNode,
            }
          )
        : figcaptionNode

      // TODO: use layout to prefill figures?

      const figures: Array<FigureNode | PlaceholderNode> = model
        .containedObjectIDs.length
        ? model.containedObjectIDs.map(id => {
            const figcaptionNode: FigCaptionNode = schema.nodes.figcaption.create()

            if (!id) {
              return schema.nodes.figure.createAndFill() as FigureNode
            }

            const figureModel = this.getModel<Figure>(id)

            if (!figureModel) {
              return schema.nodes.placeholder.create({
                id,
                label: 'A figure',
              }) as PlaceholderNode
            }

            const figcaption: FigCaptionNode = figureModel.title
              ? this.parseContents(
                  'title',
                  figureModel.title,
                  'figcaption',
                  figureModel.highlightMarkers,
                  {
                    topNode: figcaptionNode,
                  }
                )
              : figcaptionNode

            return schema.nodes.figure.create(
              {
                id: figureModel._id,
                contentType: figureModel.contentType,
                src: figureModel.src,
                listingAttachment: figureModel.listingAttachment,
                embedURL: figureModel.embedURL,
              },
              [figcaption]
            ) as FigureNode
          })
        : [schema.nodes.figure.createAndFill() as FigureNode]

      const content = [...figures, figcaption]

      if (model.listingID) {
        const listingModel = this.getModel<Listing>(model.listingID)

        const listing = listingModel
          ? (schema.nodes.listing.create({
              id: listingModel._id,
              contents: listingModel.contents,
              language: listingModel.language,
              languageKey: listingModel.languageKey,
            }) as ListingNode)
          : (schema.nodes.placeholder.create({
              id: model.listingID,
              label: 'A listing',
            }) as PlaceholderNode)

        content.push(listing)
      } else {
        const listing = schema.nodes.listing.create()
        content.push(listing)
      }

      return schema.nodes.figure_element.createChecked(
        {
          id: model._id,
          figureLayout: model.figureLayout,
          figureStyle: model.figureStyle,
          sizeFraction: model.sizeFraction,
          suppressCaption: Boolean(model.suppressCaption),
        },
        content
      ) as FigureElementNode
    },
    [ObjectTypes.EquationElement]: data => {
      const model = data as EquationElement

      const equationModel = this.getModel<Equation>(model.containedObjectID)

      const equation: EquationNode | PlaceholderNode = equationModel
        ? (schema.nodes.equation.create({
            id: equationModel._id,
            SVGStringRepresentation: equationModel.SVGStringRepresentation,
            TeXRepresentation: equationModel.TeXRepresentation,
          }) as EquationNode)
        : (schema.nodes.placeholder.create({
            id: model.containedObjectID,
            label: 'An equation',
          }) as PlaceholderNode)

      const figcaptionNode: FigCaptionNode = schema.nodes.figcaption.create()

      const figcaption: FigCaptionNode = model.caption
        ? this.parseContents(
            'caption',
            model.caption,
            'figcaption',
            model.highlightMarkers,
            {
              topNode: figcaptionNode,
            }
          )
        : figcaptionNode

      return schema.nodes.equation_element.createChecked(
        {
          id: model._id,
          suppressCaption: model.suppressCaption,
        },
        [equation, figcaption]
      ) as EquationElementNode
    },
    [ObjectTypes.FootnotesElement]: data => {
      const model = data as FootnotesElement

      return schema.nodes.footnotes_element.create({
        id: model._id,
        contents: model.contents,
      }) as FootnotesElementNode
    },
    [ObjectTypes.KeywordsElement]: data => {
      const model = data as KeywordsElement

      return schema.nodes.keywords_element.create({
        id: model._id,
        contents: model.contents,
        paragraphStyle: model.paragraphStyle,
      }) as TOCElementNode
    },
    [ObjectTypes.ListElement]: data => {
      const model = data as ListElement

      switch (model.elementType) {
        case 'ol':
          // TODO: wrap inline text in paragraphs
          return this.parseContents(
            'contents',
            model.contents || '<ol></ol>',
            undefined,
            model.highlightMarkers,
            {
              topNode: schema.nodes.ordered_list.create({
                id: model._id,
                paragraphStyle: model.paragraphStyle,
              }),
            }
          ) as OrderedListNode

        case 'ul':
          // TODO: wrap inline text in paragraphs
          return this.parseContents(
            'contents',
            model.contents || '<ul></ul>',
            undefined,
            model.highlightMarkers,
            {
              topNode: schema.nodes.bullet_list.create({
                id: model._id,
                paragraphStyle: model.paragraphStyle,
              }),
            }
          ) as BulletListNode

        default:
          throw new Error('Unknown list element type')
      }
    },
    [ObjectTypes.ListingElement]: data => {
      const model = data as ListingElement

      const listingModel = this.getModel<Listing>(model.containedObjectID)

      const listing: ListingNode | PlaceholderNode = listingModel
        ? (schema.nodes.listing.create({
            id: listingModel._id,
            contents: listingModel.contents,
            language: listingModel.language,
            languageKey: listingModel.languageKey,
          }) as ListingNode)
        : (schema.nodes.placeholder.create({
            id: model.containedObjectID,
            label: 'A listing',
          }) as PlaceholderNode)

      const figcaptionNode: FigCaptionNode = schema.nodes.figcaption.create()

      const figcaption: FigCaptionNode = model.caption
        ? this.parseContents(
            'caption',
            model.caption,
            'figcaption',
            model.highlightMarkers,
            {
              topNode: figcaptionNode,
            }
          )
        : figcaptionNode

      return schema.nodes.listing_element.createChecked(
        {
          id: model._id,
          suppressCaption: model.suppressCaption,
        },
        [listing, figcaption]
      ) as ListingElementNode
    },
    [ObjectTypes.ParagraphElement]: data => {
      const model = data as ParagraphElement

      return this.parseContents(
        'contents',
        model.contents || '<p></p>',
        undefined,
        model.highlightMarkers,
        {
          topNode: schema.nodes.paragraph.create({
            id: model._id,
            paragraphStyle: model.paragraphStyle,
            placeholder: model.placeholderInnerHTML,
          }),
        }
      ) as ParagraphNode
    },
    [ObjectTypes.QuoteElement]: data => {
      const model = data as QuoteElement

      switch (model.quoteType) {
        case 'block':
          return this.parseContents(
            'contents',
            model.contents || '<p></p>',
            undefined,
            model.highlightMarkers,
            {
              topNode: schema.nodes.blockquote_element.create({
                id: model._id,
                paragraphStyle: model.paragraphStyle,
                placeholder: model.placeholderInnerHTML,
              }),
            }
          ) as BlockquoteElementNode

        case 'pull':
          return this.parseContents(
            'contents',
            model.contents || '<p></p>',
            undefined,
            model.highlightMarkers,
            {
              topNode: schema.nodes.pullquote_element.create({
                id: model._id,
                paragraphStyle: model.paragraphStyle,
                placeholder: model.placeholderInnerHTML,
              }),
            }
          ) as PullquoteElementNode

        default:
          throw new Error('Unknown block type')
      }
    },
    // tslint:disable-next-line:cyclomatic-complexity
    [ObjectTypes.Section]: data => {
      const model = data as Section

      const isKeywordsSection = model.category === 'MPSectionCategory:keywords'

      const elements: Element[] = []

      if (model.elementIDs) {
        for (const id of model.elementIDs) {
          const element = this.getModel<Element>(id)

          if (element) {
            // ignore deprecated editable paragraph elements in keywords sections
            if (isKeywordsSection && isParagraphElement(element)) {
              continue
            }

            elements.push(element)
          } else {
            const placeholderElement: PlaceholderElement = {
              _id: id,
              containerID: model._id,
              elementType: 'p',
              objectType: ExtraObjectTypes.PlaceholderElement,
              createdAt: timestamp(),
              updatedAt: timestamp(),
            }

            elements.push(placeholderElement)
          }
        }
      }

      const elementNodes: ManuscriptNode[] = elements
        .map(this.decode)
        .filter(isManuscriptNode)

      const sectionTitleNode: SectionTitleNode = model.title
        ? this.parseContents(
            'title',
            model.title,
            'h1',
            model.highlightMarkers,
            {
              topNode: schema.nodes.section_title.create(),
            }
          )
        : schema.nodes.section_title.create()

      const nestedSections = getSections(this.modelMap)
        .filter(hasParentSection(model._id))
        .map(this.creators[ObjectTypes.Section]) as SectionNode[]

      const sectionCategory = model.category || guessSectionCategory(elements)

      const sectionNodeType = chooseSectionNodeType(sectionCategory)

      const sectionNode = sectionNodeType.createAndFill(
        {
          id: model._id,
          category: sectionCategory,
          titleSuppressed: model.titleSuppressed,
        },
        [sectionTitleNode].concat(elementNodes).concat(nestedSections)
      )

      if (!sectionNode) {
        console.error(model) // tslint:disable-line:no-console
        throw new Error('Invalid content for section ' + model._id)
      }

      return sectionNode as SectionNode
    },
    [ObjectTypes.TableElement]: data => {
      const model = data as TableElement

      const tableModel = this.getModel<Table>(model.containedObjectID)

      const table: TableNode | PlaceholderNode = tableModel
        ? (this.parseContents(
            'contents',
            tableModel.contents,
            undefined,
            tableModel.highlightMarkers,
            {
              topNode: schema.nodes.table.create({
                id: tableModel._id,
              }),
            }
          ) as TableNode)
        : (schema.nodes.placeholder.create({
            id: model.containedObjectID,
            label: 'A table',
          }) as PlaceholderNode)

      const figcaptionNode: FigCaptionNode = schema.nodes.figcaption.create()

      const figcaption: FigCaptionNode = model.caption
        ? this.parseContents(
            'caption',
            model.caption,
            'figcaption',
            model.highlightMarkers,
            {
              topNode: figcaptionNode,
            }
          )
        : figcaptionNode

      const content = [table, figcaption]

      if (model.listingID) {
        const listingModel = this.getModel<Listing>(model.listingID)

        const listing = listingModel
          ? (schema.nodes.listing.create({
              id: listingModel._id,
              contents: listingModel.contents,
              language: listingModel.language,
              languageKey: listingModel.languageKey,
            }) as ListingNode)
          : (schema.nodes.placeholder.create({
              id: model.listingID,
              label: 'A listing',
            }) as PlaceholderNode)

        content.push(listing)
      } else {
        const listing = schema.nodes.listing.create()
        content.push(listing)
      }

      return schema.nodes.table_element.createChecked(
        {
          id: model._id,
          table: model.containedObjectID,
          suppressCaption: model.suppressCaption,
          suppressFooter: model.suppressFooter,
          suppressHeader: model.suppressHeader,
          tableStyle: model.tableStyle,
          paragraphStyle: model.paragraphStyle,
        },
        content
      ) as TableElementNode
    },
    [ObjectTypes.TOCElement]: data => {
      const model = data as TOCElement

      return schema.nodes.toc_element.create({
        id: model._id,
        contents: model.contents,
        paragraphStyle: model.paragraphStyle,
      }) as TOCElementNode
    },
  }

  constructor(modelMap: Map<string, Model>) {
    this.modelMap = modelMap
  }

  public decode = (model: Model): ManuscriptNode | null => {
    if (!this.creators[model.objectType]) {
      warn(`No converter for ${model.objectType}`)
      return null
    }

    return this.creators[model.objectType](model)
  }

  public getModel = <T extends Model>(id: string): T | undefined =>
    this.modelMap.get(id) as T | undefined

  public createArticleNode = () => {
    const rootSections = getSections(this.modelMap).filter(
      section => !section.path || section.path.length <= 1
    )

    const rootSectionNodes = rootSections
      .map(this.decode)
      .filter(isManuscriptNode) as SectionNode[]

    if (!rootSectionNodes.length) {
      rootSectionNodes.push(
        schema.nodes.section.createAndFill({
          id: generateNodeID(schema.nodes.section),
        }) as SectionNode
      )
    }

    return schema.nodes.manuscript.create(
      {
        id: this.getManuscriptID(),
      },
      rootSectionNodes
    )
  }

  public parseContents = (
    field: string,
    contents: string,
    wrapper?: string,
    highlightMarkers: HighlightMarker[] = [],
    options?: ParseOptions
  ) => {
    const contentsWithHighlightMarkers = highlightMarkers.length
      ? insertHighlightMarkers(field, contents, highlightMarkers)
      : contents

    const wrappedContents = wrapper
      ? `<${wrapper}>${contentsWithHighlightMarkers}</${wrapper}>`
      : contentsWithHighlightMarkers

    const html = wrappedContents.trim()

    if (!html.length) {
      throw new Error('No HTML to parse')
    }

    const template = document.createElement('template')
    template.innerHTML = html

    if (!template.content.firstChild) {
      throw new Error('No content could be parsed')
    }

    return parser.parse(template.content.firstChild, options)
  }

  private getManuscriptID = () => {
    for (const item of this.modelMap.values()) {
      if (isManuscript(item)) {
        return item._id
      }
    }
  }
}
