/**
 * @module transformation
 * @desc Transformation framework.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */

define(/** @lends module:transformation */function (require, exports, module) {
"use strict";

var util = require("./util");
var domutil = require("./domutil");
var indexOf = domutil.indexOf;
var Action = require("./action").Action;
var oop = require("./oop");
var icon = require("./gui/icon");
var _ = require("lodash");

var TYPE_TO_KIND = _.extend(Object.create(null), {
    // These are not actually type names. It is possible to use a kind
    // name as a type name if the transformation is not more
    // specific. In this case the kind === type.
    add: "add",
    "delete": "delete",
    transform: "transform",

    insert: "add",
    "delete-element": "delete",
    "delete-parent": "delete",
    wrap: "wrap",
    "merge-with-next": "transform",
    "merge-with-previous": "transform",
    "swap-with-next": "transform",
    "swap-with-previous": "transform",
    "split": "transform",
    append: "add",
    prepend: "add",
    unwrap: "unwrap",
    "add-attribute": "add",
    "delete-attribute": "delete"
});

var TYPE_TO_NODE_TYPE = _.extend(Object.create(null), {
    // These are not actually type names. These are here to handle the
    // case where the type is actually a kind name. Since they are not
    // more specific, the node type is set to "other". Note that
    // "wrap" and "unwrap" are always about elements so there is no
    // way to have a "wrap/unwrap" which has "other" for the node
    // type.
    add: "other",
    "delete": "other",
    transform: "other",

    insert: "element",
    "delete-element": "element",
    "delete-parent": "element",
    wrap: "element",
    "merge-with-next": "element",
    "merge-with-previous": "element",
    "swap-with-next": "element",
    "swap-with-previous": "element",
    "split": "element",
    append: "element",
    prepend: "element",
    unwrap: "element",
    "add-attribute": "attribute",
    "delete-attribute": "attribute"
});

/**
 * @classdesc An operation that transforms the data tree.
 * @extends module:action~Action
 *
 * @constructor
 *
 * @param {module:wed~Editor} editor The editor for which this
 * transformation must be created.
 * @param {string} type The type of transformation.
 * @param {string} desc The description of this transformation. A
 * transformation's {@link
 * module:transformation~Transformation#getDescriptionFor
 * getDescriptionFor} method will replace ``<name>`` with the name
 * of the node actually being processed. So a string like ``Remove
 * <name>`` would become ``Remove foo`` when the transformation is
 * called for the element ``foo``.
 * @param {string} [abbreviated_desc] An abbreviated description of this
 * transformation.
 * @param {string} [icon_html] An HTML representation of the icon
 * associated with this transformation.
 * @param {boolean} [needs_input=false] Indicates whether this action
 * needs input from the user. For instance, an action which brings up
 * a modal dialog to ask something of the user must have this
 * parameter set to ``true``. It is important to record whether an
 * action needs input because, to take one example, the ``autoinsert``
 * logic will try to insert automatically any element it can. However,
 * doing this for elements that need user input will just confuse the
 * user (or could cause a crash). Therefore, it is important that the
 * insertion operations for such elements be marked with
 * ``needs_input`` set to ``true`` so that the ``autoinsert`` logic
 * backs off from trying to insert these elements.
 * @param {module:transformation~Transformation~handler} handler
 * The handler to call when this
 * transformation is executed.
 */
function Transformation(editor, type, desc, abbreviated_desc, icon_html,
                        needs_input, handler) {
    switch(arguments.length) {
    case 4:
        handler = abbreviated_desc;
        abbreviated_desc = undefined;
        break;
    case 5:
        handler = icon_html;
        icon_html = undefined;
        break;
    case 6:
        handler = needs_input;
        needs_input = undefined;
        break;
    }
    this.handler = handler;
    this.type = type;
    this.kind = TYPE_TO_KIND[type];
    this.node_type = TYPE_TO_NODE_TYPE[type];

    if (icon_html === undefined && this.kind)
        icon_html = icon.makeHTML(this.kind);
    Action.call(this, editor, desc, abbreviated_desc, icon_html, needs_input);
}

/**
 * <p>The transformation types expect the following values for the
 * parameters passed to a handler. For all these types
 * <code>transformation_data</code> is unused.</p>
 *
 * Transformation Type | `node` is | `name` is the name of the:
 * ------------------|--------|---------------------------------
 * insert | undefined (we insert at caret position) | element to insert
 * delete-element | element to delete | element to delete
 * delete-parent | element to delete | element to delete
 * wrap | undefined (we wrap the current selection) | wrapping element
 * merge-with-next | element to merge | element to merge
 * merge-with-previous | element to merge | element to merge
 * swap-with-next | element to swap | element to swap
 * swap-with-previous | element to swap | element to swap
 * append | element after which to append | element after which to append
 * prepend | element before which to prepend | element before which to append
 * unwrap | node to unwrap | node to unwrap
 * add-attribute | node to which an attribute is added | attribute to add
 * delete-attribute | attribute to delete | attribute to delete
 * insert-text | node to which text is added | text to add
 *
 * @callback module:transformation~Transformation~handler
 *
 * @param {module:wed~Editor} editor The editor.
 * @param {Object} transformation_data Data for the
 * transformation. Some fields are reserved by wed, but
 * transformations are free to use additional fields. The following
 * fields are reserved *and* set by wed. **Do not set them yourself.**
 *
 * - ``e``: The JavaScript event that triggered the transformation, if
 *   any.
 *
 * The following fields are reserved but should be set by code which
 * invokes a transformation. See the table above to know what values
 * the built-in types of transformations known to wed expect.
 *
 * - ``node``: The node to operate on.
 *
 * - ``name``: The name of the node to add, remove, etc.  (Could be
 *   different from the name of the node that ``node`` refers to.)
 *
 * - ``move_caret_to``: A position to which the caret is moved before
 *   the transformation is fired. **Wed performs the move.**
 */

oop.inherit(Transformation, Action);

// Documented by method in parent class.
Transformation.prototype.getDescriptionFor = function (data) {
    return this._desc.replace(/<name>/, data.name);
};

/**
 * Calls the <code>fireTransformation</code> method on this
 * transformation's editor.
 *
 * @param {Object} data The data object to pass.
 */
Transformation.prototype.execute = function (data) {
    data = data || {};
    this._editor.fireTransformation(this, data);
};

/**
 * Insert an element in a wed data tree.
 *
 * @param {module:tree_updater~TreeUpdater} data_updater A tree
 * updater through which to update the DOM tree.
 * @param {Node} parent Parent of the new node.
 * @param {integer} index Offset in the parent where to insert the new node.
 * @param {string} ns The URI of the namespace to use for the new element.
 * @param {string} name Name of the new element.
 * @param {Object} [attrs] An object whose fields will become
 * attributes for the new element.
 *
 * @returns {Node} The new element.
 */
function insertElement(data_updater, parent, index, ns, name, attrs) {
    var el = makeElement(parent.ownerDocument, ns, name, attrs);
    data_updater.insertAt(parent, index, el);
    return el;
}

/**
 * Makes an element appropriate for a wed data tree.
 *
 * @param {string} doc The document for which to make the element.
 * @param {string} ns The URI of the namespace to use for the new element.
 * @param {string} name Name of the new element.
 * @param {Object} [attrs] An object whose fields will become
 * attributes for the new element.
 *
 * @returns {Node} The new element.
 */
function makeElement(doc, ns, name, attrs) {
    var e = doc.createElementNS(ns, name);
    if (attrs !== undefined)
    {
        // Create attributes
        var keys = Object.keys(attrs).sort();
        for(var keys_ix = 0, key; (key = keys[keys_ix++]) !== undefined; ) {
            e.setAttribute(key, attrs[key]);
        }
    }
    return e;
}

/**
 * Wraps a span of text in a new element.
 *
 * @param {module:tree_updater~TreeUpdater} data_updater A tree
 * updater through which to update the DOM tree.
 * @param {Node} node The DOM node where to wrap. Must be a text node.
 * @param {integer} offset Offset in the node. This parameter
 * specifies where to start wrapping.
 * @param {integer} end_offset Offset in the node. This parameter
 * specifies where to end wrapping.
 * @param {string} ns The URI of the namespace to use for the new element.
 * @param {string} name Name of the wrapping element.
 * @param {Object} [attrs] An object whose fields will become
 * attributes for the new element.
 *
 * @returns {Node} The new element.
 */
function wrapTextInElement (data_updater, node, offset, end_offset,
                            ns, name, attrs) {
    var text_to_wrap = node.data.slice(offset, end_offset);

    var parent = node.parentNode;
    var node_offset = indexOf(parent.childNodes, node);

    data_updater.deleteText(node, offset, text_to_wrap.length);
    var new_element = makeElement(node.ownerDocument, ns, name, attrs);

    if (text_to_wrap !== "") {
        // It is okay to manipulate the DOM directly as long as the DOM
        // tree being manipulated is not *yet* inserted into the data
        // tree. That is the case here.
        new_element.appendChild(
            node.ownerDocument.createTextNode(text_to_wrap));
    }

    if (!node.parentNode)
        // The entire node was removed.
        data_updater.insertAt(parent, node_offset, new_element);
    else
        data_updater.insertAt(node, offset, new_element);

    return new_element;
}

/**
 * Utility function for {@link module:transformation~wrapInElement
 * wrapInElement}.
 *
 * @private
 * @param {module:tree_updater~TreeUpdater} data_updater A tree
 * updater through which to update the DOM tree.
 * @param {Node} container The text node to split.
 * @param {integer} offset Where to split the node
 *
 * @returns {Array} Returns a caret location marking where the split
 * occurred.
 */
function _wie_splitTextNode(data_updater, container, offset) {
    var parent = container.parentNode;
    var container_offset = indexOf(parent.childNodes, container);
    // The first two cases here just move the start outside of the
    // text node rather than make a split that will create a
    // useless empty text node.
    if (offset === 0)
        offset = container_offset;
    else if (offset >= container.length)
        offset = container_offset + 1;
    else {
        var text = container.data.slice(offset);
        data_updater.setTextNode(container, container.data.slice(0, offset));
        data_updater.insertNodeAt(
            parent, container_offset + 1,
            container.ownerDocument.createTextNode(text));

        offset = container_offset + 1;
    }
    container = parent;
    return [container, offset];
}

/**
 * Wraps a well-formed span in a new element. This span can contain
 * text and element nodes.
 *
 * @param {module:tree_updater~TreeUpdater} data_updater A tree
 * updater through which to update the DOM tree.
 * @param {Node} start_container The node where to start wrapping.
 * @param {integer} start_offset The offset where to start wrapping.
 * @param {Node} end_container The node where to end wrapping.
 * @param {integer} end_offset The offset where to end wrapping.
 * @param {string} ns The URI of the namespace to use for the new element.
 * @param {string} name The name of the new element.
 * @param {Object} [attrs] An object whose fields will become
 * attributes for the new element.
 *
 * @returns {Node} The new element.
 * @throws {Error} If the range is malformed or if there is an
 * internal error.
 */
function wrapInElement (data_updater, start_container, start_offset,
                        end_container, end_offset, ns, name, attrs) {
    if (!domutil.isWellFormedRange({startContainer: start_container,
                                    startOffset: start_offset,
                                    endContainer: end_container,
                                    endOffset: end_offset}))
        throw new Error("malformed range");

    var pair; // damn hoisting
    if (start_container.nodeType === Node.TEXT_NODE) {
        // We already have an algorithm for this case.
        if (start_container === end_container)
            return wrapTextInElement(data_updater, start_container,
                                     start_offset, end_offset,
                                     ns, name, attrs);

        pair = _wie_splitTextNode(data_updater, start_container, start_offset);
        start_container = pair[0];
        start_offset = pair[1];
    }

    if (end_container.nodeType === Node.TEXT_NODE) {
        pair = _wie_splitTextNode(data_updater, end_container, end_offset);
        end_container = pair[0];
        end_offset = pair[1];
    }

    if (start_container !== end_container)
        throw new Error("start_container and end_container are not the same;" +
                        "probably due to an algorithmic mistake");

    var new_element = makeElement(start_container.ownerDocument, ns,
                                  name, attrs);
    while(--end_offset >= start_offset) {
        var end_node = end_container.childNodes[end_offset];
        data_updater.deleteNode(end_node);
        // Okay to change a tree which is not yet connected to the data tree.
        new_element.insertBefore(end_node, new_element.firstChild);
    }

    data_updater.insertAt(start_container, start_offset, new_element);

    return new_element;
}

/**
 * Replaces an element with its contents.
 *
 * @param {module:tree_updater~TreeUpdater} data_updater A tree
 * updater through which to update the DOM tree.
 * @param {Node} node The element to unwrap.
 *
 * @returns {Array.<Node>} The contents of the element.
 */
function unwrap(data_updater, node) {
    var parent = node.parentNode;
    var children = Array.prototype.slice.call(node.childNodes);
    var prev = node.previousSibling;
    var next = node.nextSibling;
    // This does not merge text nodes, which is what we want. We also
    // want to remove it first so that we don't generate so many
    // update events.
    data_updater.deleteNode(node);

    // We want to calculate this index *after* removal.
    var next_ix = next ? indexOf(parent.childNodes, next):
            parent.childNodes.length;

    var last_child = node.lastChild;

    // This also does not merge text nodes.
    while(node.firstChild)
        data_updater.insertNodeAt(parent, next_ix++, node.firstChild);

    // The order of the next two calls is important. We start at the
    // end because going the other way around could cause last_child
    // to leave the DOM tree.

    // Merge possible adjacent text nodes: the last child of the node
    // that was removed in the unwrapping and the node that was after
    // the node that was removed in the unwrapping.
    data_updater.mergeTextNodes(last_child);

    // Merge the possible adjacent text nodes: the one before the
    // start of the children we unwrapped and the first child that was
    // unwrapped. There may not be a prev so we use the NF form of the
    // call.
    data_updater.mergeTextNodesNF(prev);

    return children;
}

/**
 * This function splits a node at the position of the caret. If the
 * caret is not inside the node or its descendants, an exception is
 * raised.
 *
 * @param {module:wed~Editor} editor The editor on which we are to
 * perform the transformation.
 * @param {Node} node The node to split.
 * @throws {Error} If the caret is not inside the node or its descendants.
 */
function splitNode(editor, node) {
    var caret = editor.getDataCaret();

    if (!node.contains(caret.node))
        throw new Error("caret outside node");

    var pair = editor.data_updater.splitAt(node, caret);
    // Find the deepest location at the start of the 2nd
    // element.
    editor.setDataCaret(domutil.firstDescendantOrSelf(pair[1]), 0);
}

/**
 * This function merges an element with a previous element of the same
 * name. For the operation to go forward, the element must have a
 * previous sibling and this sibling must have the same name as the
 * element being merged.
 *
 * @param {module:wed~Editor} editor The editor on which we are to
 * perform the transformation.
 * @param {Node} node The element to merge with previous.
 */
function mergeWithPreviousHomogeneousSibling (editor, node) {
    var prev = node.previousElementSibling;
    if (!prev)
        return;

    if (prev.localName !== node.localName ||
        prev.namespace !== node.namespace)
        return;

    // We need to record these to set the caret to a good position.
    var caret_pos = prev.childNodes.length;
    var last_child = prev.lastChild;
    var was_text = last_child && (last_child.nodeType === Node.TEXT_NODE);
    var text_len = was_text ? last_child.length : 0;

    var insertion_point = prev.childNodes.length;
    // Reverse order
    for (var i = node.childNodes.length - 1; i >= 0; --i)
        editor.data_updater.insertAt(prev, insertion_point,
                                     node.childNodes[i].cloneNode(true));

    if (was_text)
        editor.data_updater.mergeTextNodes(last_child);

    if (was_text)
        editor.setDataCaret(prev.childNodes[caret_pos - 1], text_len);
    else
        editor.setDataCaret(prev, caret_pos);
    editor.data_updater.removeNode(node);
}

/**
 * This function merges an element with a next element of the same
 * name. For the operation to go forward, the element must have a
 * next sibling and this sibling must have the same name as the
 * element being merged.
 *
 * @param {module:wed~Editor} editor The editor on which we are to
 * perform the transformation.
 * @param {Node} node The element to merge with next.
 */
function mergeWithNextHomogeneousSibling(editor, node) {
    var next = node.nextElementSibling;
    if (!next)
        return;

    mergeWithPreviousHomogeneousSibling(editor, next);
}

/**
 * This function swaps an element with a previous element of the same
 * name. For the operation to go forward, the element must have a
 * previous sibling and this sibling must have the same name as the
 * element being merged.
 *
 * @param {module:wed~Editor} editor The editor on which we are to
 * perform the transformation.
 * @param {Node} node The element to swap with previous.
 */
function swapWithPreviousHomogeneousSibling (editor, node) {
    var prev = node.previousElementSibling;
    if (!prev)
        return;

    if (prev.tagName !== node.tagName)
        return;

    var parent = prev.parentNode;
    editor.data_updater.removeNode(node);
    editor.data_updater.insertBefore(parent, node, prev);
    editor.setDataCaret(parent, indexOf(parent.childNodes, node));
}

/**
 * This function swaps an element with a next element of the same
 * name. For the operation to go forward, the element must have a next
 * sibling and this sibling must have the same name as the element
 * being merged.
 *
 * @param {module:wed~Editor} editor The editor on which we are to
 * perform the transformation.
 * @param {Node} node The element to swap with next.
 */
function swapWithNextHomogeneousSibling(editor, node) {
    var next = node.nextElementSibling;
    if (!next)
        return;

    swapWithPreviousHomogeneousSibling(editor, next);
}

exports.Transformation = Transformation;
exports.wrapTextInElement = wrapTextInElement;
exports.wrapInElement = wrapInElement;
exports.insertElement = insertElement;
exports.makeElement = makeElement;
exports.unwrap = unwrap;
exports.splitNode = splitNode;
exports.mergeWithPreviousHomogeneousSibling =
        mergeWithPreviousHomogeneousSibling;
exports.mergeWithNextHomogeneousSibling =
        mergeWithNextHomogeneousSibling;
exports.swapWithPreviousHomogeneousSibling =
        swapWithPreviousHomogeneousSibling;
exports.swapWithNextHomogeneousSibling =
        swapWithNextHomogeneousSibling;
});

//  LocalWords:  concat prepend refman endOffset endContainer DOM oop
//  LocalWords:  startOffset startContainer html Mangalam MPL Dubeau
//  LocalWords:  previousSibling nextSibling insertNodeAt deleteNode
//  LocalWords:  mergeTextNodes lastChild prev deleteText Prepend lt
//  LocalWords:  domutil util
