import { NodeSpec } from 'prosemirror-model'


export const rmq_pos_start:NodeSpec = {
  attrs:{
    commentId:{},
    access: {},
    groupId: {}
  },toDOM: node=> {
    let access = node.attrs.access;
    let commentId = node.attrs.commentId;
    let groupId = node.attrs.groupId;
    return ["rmq_pos_end", {
      "data-rmq-access":access,
      "data-rmq-comment-id":commentId,
      "data-rmq-group-id":groupId,
    }]
  },
  inline :true,
  atom:true,
  group: "inline"
};


export const rmq_pos_end:NodeSpec = {
  attrs:{
    commentId:{},
    access: {},
    groupId: {}
  },toDOM: node=> {
    let access = node.attrs.access;
    let commentId = node.attrs.commentId;
    let groupId = node.attrs.groupId;
    return ["rmq_pos_end", {
      "data-rmq-access":access,
      "data-rmq-comment-id":commentId,
      "data-rmq-group-id":groupId,
    }]
  },
  inline :true,
  atom:true,
  group: "inline"
};
