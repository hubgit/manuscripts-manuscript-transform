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

import { MarkSpec } from 'prosemirror-model'

export const bold: MarkSpec = {
  parseDOM: [
    {
      // Google Docs can produce content wrapped in <b style="fontWeight:normal">, which isn't actually bold. This workaround is copied from prosemirror-schema-basic.
      getAttrs: dom =>
        (dom as HTMLElement).style.fontWeight !== 'normal' && null,
      tag: 'b',
    },
    { tag: 'strong' },
    {
      // This regex, copied from prosemirror-schema-basic, matches all the possible "font-weight" values that can mean "bold".
      getAttrs: value =>
        /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
      style: 'font-weight',
    },
  ],
  toDOM: () => ['b'],
}

export const code: MarkSpec = {
  parseDOM: [{ tag: 'code' }],
  toDOM: () => ['code'],
}

export const italic: MarkSpec = {
  parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
  toDOM: () => ['i'],
}

export const smallcaps: MarkSpec = {
  parseDOM: [
    { style: 'font-variant=small-caps' },
    { style: 'font-variant-caps=small-caps' }, // TODO: all the other font-variant-caps options?
  ],
  toDOM: () => [
    'span',
    {
      style: 'font-variant:small-caps',
    },
  ],
}

export const strikethrough: MarkSpec = {
  parseDOM: [
    { tag: 'strike' },
    { style: 'text-decoration=line-through' },
    { style: 'text-decoration-line=line-through' },
  ],
  toDOM: () => [
    'span',
    {
      style: 'text-decoration-line:line-through',
    },
  ],
}

export const subscript: MarkSpec = {
  excludes: 'superscript',
  group: 'position',
  parseDOM: [{ tag: 'sub' }, { style: 'vertical-align=sub' }],
  toDOM: () => ['sub'],
}

export const superscript: MarkSpec = {
  excludes: 'subscript',
  group: 'position',
  parseDOM: [{ tag: 'sup' }, { style: 'vertical-align=super' }],
  toDOM: () => ['sup'],
}

export const underline: MarkSpec = {
  parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
  toDOM: () => ['u'],
}


export const rmq:MarkSpec = {
  attrs:{
    commentId:{},
    access: {},
    groupId: {}
  },
  toDOM: node=> {
    let access = node.attrs.access;
    let commentId = node.attrs.commentId;
    let groupId = node.attrs.groupId;

    let accessClass = 'rmq-annotator-hl='+access;
    if (!groupId){
      return ["span", {
        class: 'rmq-annotator-hl '+accessClass,
        "data-rmq-access":access,
        "data-rmq-comment-id":commentId,

      }]
    }else{
      return ["span", {
        class: 'rmq-annotator-hl '+accessClass,
        "data-rmq-access":access,
        "data-rmq-comment-id":commentId,
        "data-rmq-group-id":groupId,
      }]
    }
  },

  parseDOM: [
    {
      tag: "span",
      getAttrs: dom=>{
        let access = parseInt((dom as any).getAttribute("data-rmq-access"));
        let commentId = (dom as any).getAttribute("data-rmq-comment-id");
        let groupId = (dom as any).getAttribute("data-rmq-group-id");
        return {access,commentId,groupId};
      }
    }]
}
